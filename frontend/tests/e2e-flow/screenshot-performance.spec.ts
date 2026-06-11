import { test } from '@playwright/test';

test('capture performance diagnostics kpi screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  console.log("Clicking 'Laboratório' tab...");
  await page.locator('button[aria-label="Laboratório"]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('Scrolling to Performance Diagnóstica...');
  const header = page.locator('h3:has-text("Performance Diagnóstica")');
  await header.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  console.log('Taking screenshot of the panel...');
  const panel = page.locator('article.panel:has(h3:has-text("Performance Diagnóstica"))');
  await panel.screenshot({ path: '/home/alerrandro/Desktop/SRAG/performance_diagnostica.png' });
  console.log(
    'Screenshot successfully saved to /home/alerrandro/Desktop/SRAG/performance_diagnostica.png',
  );
});
