import { expect, test } from '@playwright/test';

async function readKpi(page: import('@playwright/test').Page, label: string): Promise<string> {
  const card = page.locator('.kpi-grid article.panel', { hasText: label });
  await expect(card).toBeVisible();
  return (await card.textContent()) ?? '';
}

async function waitForKpiChange(
  page: import('@playwright/test').Page,
  label: string,
  previous: number,
  predicate: (current: number) => boolean,
): Promise<number> {
  const start = Date.now();
  while (Date.now() - start < 10_000) {
    const text = await readKpi(page, label);
    const current = Number(text.replace(/[^\d]/g, ''));
    if (current !== previous && predicate(current)) {
      return current;
    }
    await page.waitForTimeout(200);
  }
  throw new Error(`KPI "${label}" did not match predicate within 10s (last value: ${previous})`);
}

test('year filter changes KPI totals', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const before = await readKpi(page, 'Total Internações');
  const beforeNumber = Number(before.replace(/[^\d]/g, ''));
  expect(beforeNumber).toBeGreaterThan(0);

  const yearSelect = page.locator('.gfb-group', { has: page.locator('text=Ano') }).locator('select');
  await yearSelect.selectOption('2020');

  const afterNumber = await waitForKpiChange(
    page,
    'Total Internações',
    beforeNumber,
    (n) => n < beforeNumber,
  );
  expect(afterNumber).toBeGreaterThan(0);

  await yearSelect.selectOption('');
  await waitForKpiChange(
    page,
    'Total Internações',
    afterNumber,
    (n) => n === beforeNumber,
  );
});

test('all-filters clear restores original KPI', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const initial = Number((await readKpi(page, 'Total Notificações')).replace(/[^\d]/g, ''));
  expect(initial).toBeGreaterThan(0);

  const yearSelect = page.locator('.gfb-group', { has: page.locator('text=Ano') }).locator('select');
  await yearSelect.selectOption('2024');

  const filtered = await waitForKpiChange(
    page,
    'Total Notificações',
    initial,
    (n) => n < initial,
  );
  expect(filtered).toBeGreaterThan(0);

  await yearSelect.selectOption('');
  const cleared = await waitForKpiChange(
    page,
    'Total Notificações',
    filtered,
    (n) => n === initial,
  );
  expect(cleared).toBe(initial);
});
