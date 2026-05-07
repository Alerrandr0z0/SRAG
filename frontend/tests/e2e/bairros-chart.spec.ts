import { expect, test } from '@playwright/test';

test('captures bairros chart screenshot', async ({ page }) => {
  await page.goto('/?path=/story/charts-bairroschart--default');
  await page.waitForSelector('canvas');
  await expect(page.locator('body')).toHaveScreenshot('bairros-chart.png', { animations: 'disabled', fullPage: true });
});
