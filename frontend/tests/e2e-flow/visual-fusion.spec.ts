import { test } from '@playwright/test';

test('visual: vigilance page shows icu bottleneck + imaging volcano + delay by unit', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Click Vigilância
  await page.locator('button[aria-label="Vigilância"]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/vigilance_with_icu.png', fullPage: true });

  // Click Laboratório to verify imaging volcano
  await page.locator('button[aria-label="Laboratório"]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  // Scroll to imaging section
  await page
    .locator('h3:has-text("Desfecho Clínico")')
    .scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/lab_with_volcano.png', fullPage: true });

  // Click Unid. Saúde to verify delay by unit ridgeline
  await page.locator('button[aria-label="Unid. Saúde"]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  await page.locator('h3:has-text("Atraso de Notificação por Unidade")').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/units_with_ridgeline.png', fullPage: true });
});
