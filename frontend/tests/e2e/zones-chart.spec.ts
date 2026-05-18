import { expect, test } from '@playwright/test';

test('captures zones chart screenshot', async ({ page }) => {
  await page.goto('/?path=/story/charts-zoneschart--default');
  await page.waitForSelector('canvas');
  await expect(page.locator('body')).toHaveScreenshot('zones-chart.png', {
    animations: 'disabled',
    fullPage: true,
  });
});
