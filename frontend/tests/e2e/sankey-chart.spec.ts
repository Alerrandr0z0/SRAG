import { expect, test } from '@playwright/test';

test('captures sankey chart screenshot', async ({ page }) => {
  await page.goto('/?path=/story/charts-sankeychart--default');
  await page.waitForSelector('.echart-host');
  await expect(page.locator('body')).toHaveScreenshot('sankey-chart.png', {
    animations: 'disabled',
    fullPage: true,
  });
});
