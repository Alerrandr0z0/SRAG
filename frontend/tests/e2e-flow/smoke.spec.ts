import { expect, test } from '@playwright/test';

test('dashboard loads with KPIs and 7 sidebar panels', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const kpiGrid = page.locator('.kpi-grid');
  for (const label of [
    'Total Notificações',
    'Total Internações',
    'Total UTI',
    'Óbitos',
    'Letalidade',
  ]) {
    await expect(kpiGrid.locator('article.panel', { hasText: label })).toBeVisible();
  }

  const kpiValues = await page.locator('.kpi-grid .panel').allTextContents();
  for (const card of kpiValues) {
    expect(card).toMatch(/\d/);
  }

  const expectedPanels = [
    'Vigilância',
    'Laboratório',
    'Território',
    'Unid. Saúde',
    'Cidadão',
    'Auditoria',
    'Notebooks',
  ];
  for (const label of expectedPanels) {
    await expect(page.locator(`button[aria-label="${label}"]`)).toBeVisible();
  }
});

test('api backend is reachable from the dashboard', async ({ page }) => {
  const response = await page.request.get('http://127.0.0.1:8000/health');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { status: string };
  expect(body.status).toBe('ok');
});
