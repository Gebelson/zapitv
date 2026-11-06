import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium, type Page } from 'playwright';

// No real backend is started. Authentication and profile delays live only here.
Object.assign(process.env, {
  ZAPITV_DEPLOYMENT_ENV: 'preview',
  ZAPITV_PREVIEW_FIREBASE_PROJECT_ID: 'zapitv-staging-fixture',
  ZAPITV_PREVIEW_FIREBASE_API_KEY: `AIza${'s'.repeat(35)}`,
  ZAPITV_PREVIEW_FIREBASE_APP_ID: '1:222222222:web:abcdef0123456789',
  ZAPITV_PREVIEW_FIREBASE_AUTH_DOMAIN: 'zapitv-staging-fixture.firebaseapp.com',
  ZAPITV_PREVIEW_FIREBASE_DATABASE_ID: '(default)',
  ZAPITV_PREVIEW_FIREBASE_STORAGE_BUCKET: 'zapitv-staging-fixture.firebasestorage.app',
  ZAPITV_PREVIEW_FIREBASE_MESSAGING_SENDER_ID: '222222222',
});

const user = { id: 'tv-gate-user', email: 'tv-gate@example.test', name: 'TV Gate', status: 'Ativo', plan: 'Premium' };
const profile = { id: 'tv-gate-profile', userId: user.id, name: 'Gate Profile', avatarId: 'avatar_1', isDefault: 1, displayOrder: 0 };
const sessions = new Map<string, { selected: boolean }>();
let releaseProfiles = () => {};
let profilesRequested = false;
let profileGate = Promise.resolve();
let loginCount = 0;
let selectCount = 0;

const server = await createServer({
  server: { host: '127.0.0.1', port: 0 }, logLevel: 'error',
  plugins: [{ name: 'tv-gate-server-only-auth', configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      if (!pathname.startsWith('/api/')) return next();
      const token = /(?:^|;\s*)tv_gate_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
      const session = sessions.get(token || '');
      const json = (value: unknown, status = 200) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(value));
      };
      if (pathname === '/api/auth/policy') return json({ mandatoryAuth: true, policyVersion: 1 });
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const credentials = JSON.parse(body);
        if (credentials.email !== user.email || credentials.password !== 'test-only-password') return json({ error: 'Invalid fixture login' }, 401);
        const id = randomUUID();
        sessions.set(id, { selected: false });
        loginCount++;
        res.setHeader('Set-Cookie', `tv_gate_session=${id}; Path=/; HttpOnly; SameSite=Strict`);
        return json({ authenticated: true, user, activeProfile: null });
      }
      if (pathname === '/api/auth/me') return json({ authenticated: !!session, user: session ? user : null, activeProfile: session?.selected ? profile : null, mandatoryAuth: true, policyVersion: 1 }, session ? 200 : 401);
      if (pathname.startsWith('/api/profiles')) {
        if (!session) return json({ error: 'Unauthorized' }, 401);
        if (pathname === `/api/profiles/${profile.id}/select` && req.method === 'POST') {
          session.selected = true; selectCount++;
          return json({ profile });
        }
        if (pathname === '/api/profiles/active') return json({ profile: session.selected ? profile : null });
        if (pathname === '/api/profiles') {
          profilesRequested = true;
          await profileGate;
          return json({ profiles: [profile] });
        }
        return json({ error: 'Unsupported fixture operation' }, 405);
      }
      if (pathname === '/api/device-auth/challenge') return json({ deviceCode: 'fixture-device', userCode: 'GATE-1234', verificationUri: '/tv/ativar', expiresIn: 300, interval: 5 });
      if (pathname === '/api/device-auth/poll') return json({ status: 'pending' });
      if (pathname === '/api/providers/config') return json({ providers: [] });
      if (pathname.startsWith('/api/db/source-memory')) return json({ sources: [] });
      if (pathname.startsWith('/api/db/')) return json({ value: null });
      return json({});
    });
  } }],
});

async function focused(page: Page, key: string) {
  await page.waitForFunction(expected => {
    const el = document.querySelector(`[data-focus-key="${expected}"][data-tv-focused="true"]`);
    return !!el;
  }, key);
  await visibleFocus(page);
}

async function visibleFocus(page: Page) {
  await page.waitForFunction(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>('[data-tv-focused="true"]')];
    return nodes.length === 1 && nodes.every(el => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return false;
      for (let node: HTMLElement | null = el; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (node.hidden || node.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      }
      return !el.matches(':disabled');
    });
  }, undefined, { timeout: 10000 });
}

async function press(page: Page, key: string, expected: string) {
  await page.keyboard.press(key);
  await focused(page, expected);
}

async function focusStyle(page: Page, key: string) {
  return page.locator(`[data-focus-key="${key}"]`).evaluate(el => {
    const style = getComputedStyle(el);
    return { color: style.color, shadow: style.boxShadow, filter: style.filter };
  });
}

await server.listen();
const address = server.httpServer!.address();
assert.ok(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 960, height: 540 }, { width: 1920, height: 1080 }]) {
    console.log(`TV gate ${viewport.width}x${viewport.height}`);
    profilesRequested = false;
    profileGate = new Promise<void>(resolve => { releaseProfiles = resolve; });
    const beforeLogin = loginCount;
    const beforeSelect = selectCount;
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    // Browser may access only the loopback test server; no remote credentials/data.
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${origin}/tv`);
      await page.getByRole('button', { name: 'Entrar pelo controle remoto' }).click();
      await page.locator('input[type="email"]').fill(user.email);
      await page.locator('input[type="password"]').fill('test-only-password');
      await page.getByRole('button', { name: 'Entrar na ZapiTV', exact: true }).click();
      const deadline = Date.now() + 10000;
      while (!profilesRequested && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
      assert.ok(profilesRequested, 'UI login must request profiles from server');
      assert.equal(await page.locator('[data-focus-key="tv-hero-play"]').count(), 0, 'Catalog must wait for asynchronous profile loading');
      releaseProfiles();
      await page.locator(`[data-profile-id="${profile.id}"][data-focused="true"]`).waitFor();
      await page.clock.install();
      // Let the profile-card's intentional 600ms input debounce elapse.
      await page.clock.pauseAt(new Date(Date.now() + 1000));
      await page.keyboard.press('Enter');
      await page.getByTestId('tv-profile-selector').waitFor({ state: 'detached' });
      await page.clock.runFor(70);
      assert.equal(await page.evaluate(() => document.querySelector('[data-tv-focused="true"]')?.getAttribute('data-focus-key') ?? null), 'tv-hero-play', 'The single bootstrap must recover the unmounted profile focus by 60ms');
      await focused(page, 'tv-hero-play');
      assert.equal(loginCount - beforeLogin, 1, 'One real UI login per isolated context');
      assert.equal(selectCount - beforeSelect, 1, 'Enter selects the real fixture profile once');
      assert.ok((await context.cookies()).some(cookie => cookie.name === 'tv_gate_session' && cookie.httpOnly));
      await press(page, 'ArrowRight', 'tv-hero-details');
      // Observe beyond both existing bootstrap deadlines: valid focus must survive.
      await page.clock.runFor(250);
      await focused(page, 'tv-hero-details');
      const inactiveHeroStyle = await focusStyle(page, 'tv-hero-play');
      await page.clock.resume();
      await press(page, 'ArrowLeft', 'tv-hero-play');
      await page.waitForFunction(inactive => getComputedStyle(document.querySelector('[data-focus-key="tv-hero-play"]')!).boxShadow !== inactive, inactiveHeroStyle.shadow);
      const inactiveHeaderStyle = await focusStyle(page, 'tv-nav-home');
      await press(page, 'ArrowUp', 'tv-nav-home');
      await page.waitForFunction(inactive => getComputedStyle(document.querySelector('[data-focus-key="tv-nav-home"]')!).color !== inactive, inactiveHeaderStyle.color);
      await press(page, 'ArrowDown', 'tv-hero-play');
      for (const back of ['Escape', 'Backspace']) {
        await press(page, 'ArrowRight', 'tv-hero-details');
        await page.keyboard.press('Enter');
        await focused(page, 'tv-details-play');
        await press(page, 'ArrowRight', 'tv-details-list');
        // Allow the real transition to finish before comparing focus treatment.
        await page.clock.runFor(250);
        const inactiveModalStyle = await focusStyle(page, 'tv-details-play');
        await press(page, 'ArrowLeft', 'tv-details-play');
        await page.waitForFunction(inactive => getComputedStyle(document.querySelector('[data-focus-key="tv-details-play"]')!).boxShadow !== inactive, inactiveModalStyle.shadow);
        await page.keyboard.press(back);
        await page.locator('[data-focus-key="tv-details-play"]').waitFor({ state: 'detached' });
        await focused(page, 'tv-hero-details');
        await press(page, 'ArrowLeft', 'tv-hero-play');
      }
      await press(page, 'ArrowUp', 'tv-nav-home');
      let previousBody = '[data-focus-key="row-trending"]';
      for (const [tab, body] of [
        ['movies', '[data-focus-key="row-all-filmes"]'],
        ['series', '[data-focus-key="row-all-séries"]'],
        ['animes', '[data-focus-key^="row-anime-"]'],
      ]) {
        await press(page, 'ArrowRight', `tv-nav-${tab}`);
        await page.keyboard.press('Enter');
        await page.locator(`[data-focus-key="tv-nav-${tab}"][data-tv-active="true"]`).waitFor();
        await page.locator(body).first().waitFor({ state: 'attached' });
        await page.locator(previousBody).first().waitFor({ state: 'detached' });
        previousBody = body;
        await page.clock.runFor(100);
        await focused(page, `tv-nav-${tab}`);
        await press(page, 'ArrowDown', 'tv-hero-play');
        await press(page, 'ArrowUp', `tv-nav-${tab}`);
      }
      assert.deepEqual(errors, [], 'No uncaught application exceptions');
      const fallbackPage = await context.newPage();
      await fallbackPage.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
          const style = document.createElement('style');
          style.textContent = '[data-focus-key="tv-hero-play"] { display: none !important; }';
          document.head.appendChild(style);
        }, { once: true });
      });
      await fallbackPage.goto(`${origin}/tv`);
      await focused(fallbackPage, 'tv-nav-home');
      assert.equal(await fallbackPage.locator('[data-focus-key="tv-hero-play"]').isVisible(), false, 'Hidden hero must fall back to a mounted header button');
      await fallbackPage.close();
      if (process.env.TV_FOCUS_ARTIFACT_DIR) {
        await mkdir(process.env.TV_FOCUS_ARTIFACT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.TV_FOCUS_ARTIFACT_DIR, `tv-gate-${viewport.width}.png`) });
      }
      console.log('PASS: UI login, delayed profile, initial focus, arrows, Enter, Escape/Back, restore, actual page selection, visible focus');
    } finally {
      releaseProfiles();
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
