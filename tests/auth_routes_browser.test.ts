import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

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
const user = { id: 'auth-route-test-user', name: 'Route Test', email: 'route@example.test', createdAt: 1700000000000, status: 'Ativo' };
const profile = { id: 'auth-route-test-profile', userId: user.id, name: 'Route Profile', avatarId: 'avatar_1', isDefault: 1, displayOrder: 0 };
const sessions = new Set<string>();
let mandatory = true;
let sessionGate = Promise.resolve();
let releaseSession = () => {};
let requestedSession = false;
let logins = 0;
let selections = 0;
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'auth-route-test-server', configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (!url.pathname.startsWith('/api/')) return next();
      const session = /(?:^|;\s*)route_test_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
      const authenticated = sessions.has(session || '');
      const json = (data: unknown, status = 200) => { res.statusCode = status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); };
      if (url.pathname === '/api/auth/policy') return json({ mandatoryAuth: mandatory, policyVersion: 1 });
      if (url.pathname === '/api/auth/me') {
        requestedSession = true;
        await sessionGate;
        return json({ authenticated, user: authenticated ? user : null, activeProfile: authenticated ? profile : null, mandatoryAuth: mandatory, policyVersion: 1 });
      }
      if (url.pathname === '/api/auth/login' && req.method === 'POST') {
        let body = ''; for await (const chunk of req) body += chunk;
        const credentials = JSON.parse(body);
        if (credentials.email !== user.email || credentials.password !== 'local-test-password') return json({ error: 'Invalid fixture credentials' }, 401);
        const id = randomUUID(); sessions.add(id); logins++;
        res.setHeader('Set-Cookie', `route_test_session=${id}; Path=/; HttpOnly; SameSite=Strict`);
        return json({ authenticated: true, user, activeProfile: null });
      }
      if (url.pathname.startsWith('/api/profiles')) {
        if (!authenticated) return json({ error: 'Unauthorized' }, 401);
        if (url.pathname.endsWith('/select')) { selections++; return json({ profile }); }
        return json({ profiles: [profile], profile });
      }
      if (url.pathname === '/api/device-auth/challenge') return json({ deviceCode: 'fixture', userCode: 'TEST-1234', verificationUri: '/tv/ativar', expiresIn: 300, interval: 5 });
      if (url.pathname === '/api/device-auth/poll') return json({ status: 'pending' });
      if (url.pathname === '/api/providers/config') return json({ providers: [] });
      if (url.pathname.startsWith('/api/db/')) return json({ value: null });
      return json({});
    });
  },
}] });
await server.listen();
const address = server.httpServer!.address(); assert.ok(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
    console.log(`Authentication routes ${viewport.width}x${viewport.height}`);
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort('blockedbyclient'));
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    try {
      mandatory = true; requestedSession = false;
      sessionGate = new Promise<void>(resolve => { releaseSession = resolve; });
      await page.goto(`${origin}/login`);
      const deadline = Date.now()+10000;
      while (!requestedSession && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,20));
      assert.ok(requestedSession);
      assert.equal(await page.getByText('Conteúdo fora de órbita', {exact:true}).count(), 0, 'Known auth route must not mount NotFound while resolving session');
      assert.equal(await page.locator('input[type="email"]').count(), 0, 'Wait for session before presenting authentication');
      releaseSession();
      await page.getByRole('button',{name:'Entrar na minha conta',exact:true}).waitFor();
      assert.equal(await page.getByText('Conteúdo fora de órbita',{exact:true}).count(),0,'Login form must not overlay NotFound');
      if(process.env.AUTH_ROUTE_ARTIFACT_DIR){ await mkdir(process.env.AUTH_ROUTE_ARTIFACT_DIR,{recursive:true}); await page.screenshot({path:path.join(process.env.AUTH_ROUTE_ARTIFACT_DIR,`login-${viewport.width}.png`)}); }
      await page.locator('input[type="email"]').fill(user.email);
      await page.locator('input[type="password"]').fill('local-test-password');
      await page.getByRole('button',{name:'Entrar na minha conta',exact:true}).click();
      await page.getByText('Quem está assistindo agora?',{exact:true}).waitFor();
      await page.getByRole('button',{name:profile.name,exact:true}).click();
      await page.waitForURL(`${origin}/`);
      assert.equal(await page.locator('#zapitv-mandatory-auth-overlay').count(),0);
      // A persisted session visiting /login must leave the auth route.
      await page.goto(`${origin}/login`);
      await page.waitForURL(`${origin}/`);
      assert.equal(await page.getByText('Conteúdo fora de órbita',{exact:true}).count(),0);
      await context.clearCookies();
      mandatory = false;
      await page.goto(`${origin}/login`);
      await page.getByRole('button',{name:'Entrar na minha conta',exact:true}).waitFor();
      for (const signupPath of ['/cadastro', '/signup']) {
        await page.goto(`${origin}${signupPath}`);
        await page.getByPlaceholder('Como deseja ser chamado').waitFor();
        await page.getByRole('button',{name:'Concluir cadastro',exact:true}).waitFor();
        assert.equal(await page.getByText('Conteúdo fora de órbita',{exact:true}).count(),0,'Signup is also a known route');
      }
      // A genuinely unknown route still renders the real 404.
      await page.goto(`${origin}/this-route-does-not-exist`);
      if (viewport.width > 768) await page.getByText('Conteúdo fora de órbita',{exact:true}).waitFor();
      assert.deepEqual(errors,[]);
      console.log('PASS: pending session, login shell, UI login, profiles, redirect, optional policy, signup' + (viewport.width > 768 ? ', true desktop 404' : ''));
    } catch (error) {
      console.error(JSON.stringify({ url:page.url(), logins, selections, text:(await page.locator('body').innerText()).slice(-1400) }));
      throw error;
    } finally { releaseSession(); await context.close(); }
  }
  for(const viewport of [{width:960,height:540},{width:1920,height:1080}]) {
    const context=await browser.newContext({viewport,serviceWorkers:'block'});
    await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));
    const page=await context.newPage(); mandatory=true;
    await page.goto(`${origin}/tv`);
    await page.getByRole('button',{name:'Entrar pelo controle remoto'}).waitFor();
    assert.equal(await page.locator('#zapitv-mandatory-auth-overlay').count(),0,'TV retains its dedicated activation flow');
    console.log(`PASS: dedicated TV activation ${viewport.width}x${viewport.height}`);
    await context.close();
  }
  assert.equal(logins,2); assert.equal(selections,2);
} finally { releaseSession(); await browser.close(); await server.close(); }
