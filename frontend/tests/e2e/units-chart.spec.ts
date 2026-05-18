import { expect, test } from '@playwright/test';

test('captures units chart screenshot', async ({ page }) => {
  await page.goto('/?path=/story/charts-unitschart--default');
  await page.waitForSelector('canvas');
  await expect(page.locator('body')).toHaveScreenshot('units-chart.png', {
    animations: 'disabled',
    fullPage: true,
  });
});
