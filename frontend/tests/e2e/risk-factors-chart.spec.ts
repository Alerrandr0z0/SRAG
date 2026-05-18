import { expect, test } from '@playwright/test';

test('captures risk factors chart screenshot', async ({ page }) => {
  await page.goto('/?path=/story/charts-riskfactorschart--default');
  await page.waitForSelector('canvas');
  await expect(page.locator('body')).toHaveScreenshot('risk-factors-chart.png', {
    animations: 'disabled',
    fullPage: true,
  });
});
