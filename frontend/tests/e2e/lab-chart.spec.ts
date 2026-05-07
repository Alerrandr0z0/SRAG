import { expect, test } from '@playwright/test';

test('captures lab chart screenshot', async ({ page }) => {
  await page.goto('/?path=/story/charts-labchart--default');
  await page.waitForSelector('canvas');
  await expect(page.locator('body')).toHaveScreenshot('lab-chart.png', { animations: 'disabled', fullPage: true });
});
