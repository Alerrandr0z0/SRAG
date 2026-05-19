import { expect, test } from '@playwright/test';

test('captures trend chart screenshot', async ({ page }) => {
  await page.goto('/?path=/story/charts-trendchart--default');
  await page.waitForSelector('canvas');
  await expect(page.locator('body')).toHaveScreenshot('trend-chart.png', {
    animations: 'disabled',
    fullPage: true,
  });
});
