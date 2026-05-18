import { expect, test } from '@playwright/test';

test('captures pyramid chart screenshot', async ({ page }) => {
  await page.goto('/?path=/story/charts-piramideetariachart--default');
  await page.waitForSelector('canvas');
  await expect(page.locator('body')).toHaveScreenshot('piramide-etaria-chart.png', {
    animations: 'disabled',
    fullPage: true,
  });
});
