import { expect, test } from '@playwright/test';

test('captures schooling chart screenshot', async ({ page }) => {
  await page.goto('/?path=/story/charts-schoolingchart--default');
  await page.waitForSelector('canvas');
  await expect(page.locator('body')).toHaveScreenshot('schooling-chart.png', {
    animations: 'disabled',
    fullPage: true,
  });
});
