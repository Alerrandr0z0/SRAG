import { expect, test } from '@playwright/test';

test('navigate to Auditoria and verify quality panel renders', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.locator('button[aria-label="Auditoria"]').click();

  await expect(page.locator('text=Central de Inteligência de Qualidade de Dados')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator('button[aria-label="Auditoria"].active')).toBeVisible();
});

test('Auditoria renders inconsistencies section', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.locator('button[aria-label="Auditoria"]').click();
  await expect(page.locator('text=Central de Inteligência de Qualidade de Dados')).toBeVisible();

  const header = page.locator('text=Problemas de Preenchimento').first();
  await expect(header).toBeVisible({ timeout: 10_000 });
});

test('all 7 sidebar panels can be navigated to without crashing', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const panels = [
    'Vigilância',
    'Laboratório',
    'Território',
    'Unid. Saúde',
    'Cidadão',
    'Auditoria',
  ];
  for (const label of panels) {
    await page.locator(`button[aria-label="${label}"]`).click();
    await expect(page.locator(`button[aria-label="${label}"].active`)).toBeVisible({
      timeout: 5_000,
    });
  }
});
