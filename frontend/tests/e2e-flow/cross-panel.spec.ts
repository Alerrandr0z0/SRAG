import { expect, test } from '@playwright/test';

test('year filter applied persists when navigating to Citizen panel', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Expand filter bar if collapsed
  const toggleBtn = page.locator('button[aria-label="Mostrar Filtros"]');
  if ((await toggleBtn.count()) > 0) {
    await toggleBtn.first().click();
    await page.waitForTimeout(500);
  }

  const yearSelect = page
    .locator('.gfb-group', { has: page.locator('text=Ano') })
    .locator('select');

  await yearSelect.selectOption('2020');
  await page.waitForLoadState('networkidle');

  await page.locator('button[aria-label="Cidadão"]').click();
  await expect(page.locator('button[aria-label="Cidadão"].active')).toBeVisible({
    timeout: 5_000,
  });
  const yearOnCidadao = await yearSelect.inputValue();
  expect(yearOnCidadao).toBe('2020');
});

test('switching between panels preserves global filter state', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Expand filter bar if collapsed
  const toggleBtn = page.locator('button[aria-label="Mostrar Filtros"]');
  if ((await toggleBtn.count()) > 0) {
    await toggleBtn.first().click();
    await page.waitForTimeout(500);
  }

  const yearSelect = page
    .locator('.gfb-group', { has: page.locator('text=Ano') })
    .locator('select');
  await yearSelect.selectOption('2024');
  await page.waitForLoadState('networkidle');

  for (const panel of ['Cidadão', 'Unid. Saúde', 'Território', 'Auditoria', 'Vigilância']) {
    await page.locator(`button[aria-label="${panel}"]`).click();
    await expect(page.locator(`button[aria-label="${panel}"].active`)).toBeVisible({
      timeout: 5_000,
    });
    const value = await yearSelect.inputValue();
    expect(value).toBe('2024');
  }
});
