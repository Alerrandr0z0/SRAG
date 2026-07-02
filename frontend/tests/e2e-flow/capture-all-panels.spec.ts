import * as path from 'node:path';
import { test } from '@playwright/test';

const ARTIFACTS_DIR =
  '/home/alerrandro/.gemini/antigravity/brain/084ff387-b19f-4562-b8c8-a7509f372036/';

test.describe('Capture All Panels', () => {
  test('Capture all tabs at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const tabs = [
      { key: 'vigilancia', label: 'Vigilância' },
      { key: 'laboratorio', label: 'Laboratório' },
      { key: 'territorio', label: 'Território' },
      { key: 'unidades', label: 'Unid. Saúde' },
      { key: 'cidadao', label: 'Cidadão' },
      { key: 'auditoria', label: 'Auditoria' },
    ];

    for (const tab of tabs) {
      console.log(`Navigating to tab: ${tab.label}`);
      // Click on the navigation menu item by selecting button containing the label text or aria-label
      const btn = page.locator(`button:has-text("${tab.label}")`);
      if ((await btn.count()) > 0) {
        await btn.first().click();
      } else {
        const btnAttr = page.locator(`button[aria-label="${tab.label}"]`);
        await btnAttr.first().click();
      }
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // If territory, let's also toggle Rural zone mode to see the rural sectors
      if (tab.key === 'territorio') {
        // Capture default (Urbana)
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, `panel_${tab.key}_urbana.png`),
          fullPage: true,
        });

        // Toggle to Rural
        try {
          const select = page.locator('.filters label select');
          if ((await select.count()) > 0) {
            await select.first().selectOption('Rural', { timeout: 1000 });
            await page.waitForTimeout(2000);
            await page.screenshot({
              path: path.join(ARTIFACTS_DIR, `panel_${tab.key}_rural.png`),
              fullPage: true,
            });
            // Switch it back to Urbana for the rest of the flow
            await select.first().selectOption('Urbana');
            await page.waitForTimeout(1000);
          }
        } catch (e) {
          console.warn('Failed to switch to Rural sector:', e);
        }
      } else {
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, `panel_${tab.key}.png`),
          fullPage: true,
        });
      }
    }
  });
});
