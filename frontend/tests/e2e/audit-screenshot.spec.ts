import path from 'node:path';
import { test } from '@playwright/test';

test('captures audit panel screenshots', async ({ page }) => {
  // Navigate to Vite dev server
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');

  console.log('Clicking the Auditoria tab...');
  const auditTab = page.locator('button[aria-label="Auditoria"]');
  await auditTab.click();

  console.log('Waiting for the quality intelligence panel...');
  await page.waitForSelector('text=Central de Inteligência de Qualidade de Dados');
  await page.waitForTimeout(2000); // Allow ECharts animations and API calls to settle

  const artifactDir =
    '/home/alerrandro/.gemini/antigravity/brain/531a7e71-ca36-4580-b8c7-ba569350e18f';

  console.log('Taking light mode screenshot...');
  await page.screenshot({
    path: path.join(artifactDir, 'audit_panel_light.png'),
    fullPage: true,
  });

  console.log('Toggling theme to dark mode...');
  const themeToggle = page.locator('button[aria-label^="Mudar para tema"]');
  await themeToggle.click();
  await page.waitForTimeout(2000); // Allow theme changes and animations to settle

  console.log('Taking dark mode screenshot...');
  await page.screenshot({
    path: path.join(artifactDir, 'audit_panel_dark.png'),
    fullPage: true,
  });

  console.log('Screenshots taken successfully!');
});
