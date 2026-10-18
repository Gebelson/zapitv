import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.ZAPITV_BASE_URL || 'http://localhost:4000';
const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  const host = await browser.newPage();
  const guest = await browser.newPage();
  const errors: string[] = [];
  host.on('pageerror', error => errors.push(`host: ${error.message}`));
  guest.on('pageerror', error => errors.push(`guest: ${error.message}`));

  await host.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await host.getByRole('button', { name: 'Filmes', exact: true }).click();
  await host.locator('[data-ui-sound-card]').first().click();
  await host.getByRole('button', { name: 'Grupo', exact: true }).click();
  await host.getByRole('heading', { name: 'Assistir Juntos' }).waitFor();
  await host.getByPlaceholder('Ex: Carlos, Ana...').fill('Anfitrião Teste');
  await host.getByRole('button', { name: 'Criar Sala de Espera' }).click();

  const inviteInput = host.locator('input[readonly]').first();
  await inviteInput.waitFor({ timeout: 15_000 });
  const inviteUrl = await inviteInput.inputValue();
  assert.match(inviteUrl, /\/sala\/zapi-/);

  await guest.goto(inviteUrl, { waitUntil: 'domcontentloaded' });
  await guest.getByRole('heading', { name: 'Assistir Juntos' }).waitFor({ timeout: 20_000 });
  await guest.getByPlaceholder('Ex: Carlos, Ana...').fill('Convidada Teste');
  await guest.getByRole('button', { name: 'Entrar na Sala de Espera' }).click();
  try {
    await guest.getByRole('button', { name: /Participantes \(2\/6\)/ }).waitFor({ timeout: 20_000 });
  } catch (error) {
    const guestView = (await guest.locator('body').innerText()).slice(0, 600);
    throw new Error(`Convidado não entrou na sala. Página: ${guestView}; exceções: ${errors.join('; ')}`, { cause: error });
  }
  await host.getByRole('button', { name: /Participantes \(2\/6\)/ }).waitFor({ timeout: 25_000 });
  await guest.getByText('Anfitrião Teste', { exact: true }).first().waitFor({ timeout: 10_000 });
  await host.getByText('Convidada Teste', { exact: true }).first().waitFor({ timeout: 10_000 });

  await host.getByRole('button', { name: /Chat da Sala/ }).click();
  await guest.getByRole('button', { name: /Chat da Sala/ }).click();
  await host.getByPlaceholder('Digite uma mensagem na sala...').fill('Mensagem do anfitrião');
  await host.getByPlaceholder('Digite uma mensagem na sala...').press('Enter');
  await guest.getByText('Mensagem do anfitrião', { exact: true }).waitFor({ timeout: 20_000 });
  await guest.getByPlaceholder('Digite uma mensagem na sala...').fill('Resposta da convidada');
  await guest.getByPlaceholder('Digite uma mensagem na sala...').press('Enter');
  await host.getByText('Resposta da convidada', { exact: true }).waitFor({ timeout: 20_000 });
  assert.equal(await host.getByText('Resposta da convidada', { exact: true }).count(), 1);
  assert.equal(await guest.getByText('Mensagem do anfitrião', { exact: true }).count(), 1);

  await guest.getByRole('button', { name: 'Sair da Sala' }).click();
  await host.getByRole('button', { name: /Participantes \(1\/6\)/ }).waitFor({ timeout: 20_000 });
  assert.deepEqual(errors, [], `Exceções: ${errors.join('; ')}`);

  console.log('Dois navegadores, presença, chat e saída: OK');
} finally {
  await browser.close();
}
