import { expect, test } from '@playwright/test';

test('captures swimmer plot screenshot', async ({ page }) => {
  await page.goto('/?path=/story/charts-aggregatedswimmerplot--default');
  await page.waitForSelector('svg');
  await expect(page.locator('body')).toHaveScreenshot('aggregated-swimmer-plot.png', {
    animations: 'disabled',
    fullPage: true,
  });
});
