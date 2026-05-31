import { test } from '@playwright/test';
import path from 'node:path';

test('captures units panel screenshots', async ({ page }) => {
  // Navigate to Vite dev server
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');

  console.log('Clicking the Unid. Saúde tab...');
  const unitsTab = page.locator('button[aria-label="Unid. Saúde"]');
  await unitsTab.click();

  console.log('Waiting for units panel to render...');
  await page.waitForSelector('text=Unidades notificadoras');
  await page.waitForTimeout(2000); // Allow ECharts animations and API calls to settle

  const artifactDir =
    '/home/alerrandro/.gemini/antigravity/brain/531a7e71-ca36-4580-b8c7-ba569350e18f';

  console.log('Taking units panel light mode screenshot...');
  await page.screenshot({
    path: path.join(artifactDir, 'units_panel_light.png'),
    fullPage: true,
  });

  console.log('Toggling theme to dark mode...');
  const themeToggle = page.locator('button[aria-label^="Mudar para tema"]');
  await themeToggle.click();
  await page.waitForTimeout(2000); // Allow theme changes and animations to settle

  console.log('Taking units panel dark mode screenshot...');
  await page.screenshot({
    path: path.join(artifactDir, 'units_panel_dark.png'),
    fullPage: true,
  });

  console.log('Screenshots taken successfully!');
});
