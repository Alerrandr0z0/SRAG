import * as path from 'node:path';
import { test } from '@playwright/test';

const ARTIFACTS_DIR =
  '/home/alerrandro/.gemini/antigravity/brain/09087bea-43c5-4d91-be13-4ee78b8da636/';

test.describe('Responsive Dashboard Checks', () => {
  // Mobile Viewport Size
  test('Mobile Viewport (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take a full page screenshot of the Vigilância tab
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'responsive_vigilance_mobile.png'),
      fullPage: true,
    });

    // Open mobile sidebar
    await page.locator('button.mobile-nav-toggle').click();
    await page.waitForTimeout(500);

    // Go to Laboratório tab
    await page.locator('button[aria-label="Laboratório"]').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'responsive_lab_mobile.png'),
      fullPage: true,
    });
  });

  // Tablet Viewport Size
  test('Tablet Viewport (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'responsive_vigilance_tablet.png'),
      fullPage: true,
    });

    // Open mobile sidebar
    await page.locator('button.mobile-nav-toggle').click();
    await page.waitForTimeout(500);

    await page.locator('button[aria-label="Laboratório"]').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'responsive_lab_tablet.png'),
      fullPage: true,
    });
  });

  // Desktop Viewport Size (No mobile sidebar toggle exists, sidebar is always visible)
  test('Desktop Viewport (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'responsive_vigilance_desktop.png'),
      fullPage: true,
    });

    await page.locator('button[aria-label="Laboratório"]').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'responsive_lab_desktop.png'),
      fullPage: true,
    });
  });
});
