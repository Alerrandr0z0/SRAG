import { chromium } from 'playwright';

const OUT = '/out/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('http://localhost/', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Close auto-opened drawer first so we can see the clean dashboard
  const closeBtn = page.locator('.gfb-drawer-close-btn');
  try {
    await closeBtn.click({ timeout: 5000 });
    await page.waitForTimeout(500);
  } catch (e) {
    console.log('Drawer close failed initially:', e.message);
  }

  // 1. Initial State: Take screenshot of the 100% clean dashboard (no active filters)
  await page.screenshot({ path: `${OUT}gfb_dashboard_consolidated_initial.png` });

  // 2. Open drawer via sidebar
  try {
    const filterNavBtn = page.locator('button[aria-label="Mostrar Filtros"]');
    await filterNavBtn.click();
    await page.waitForTimeout(500);

    // Toggle COVID-19 filter
    const covidBtn = page.locator('.gfb-pills button', { hasText: 'COVID-19' }).first();
    await covidBtn.click();
    await page.waitForTimeout(500);

    // Toggle a Bairro (focus input, click first option)
    const bairroInput = page.locator('input[placeholder="Buscar bairro..."]');
    await bairroInput.focus();
    await page.waitForTimeout(200);

    const firstBairroOpt = page.locator('#bairro-listbox button').first();
    const secondBairroOpt = page.locator('#bairro-listbox button').nth(1);

    await firstBairroOpt.click();
    await page.waitForTimeout(200);
    await secondBairroOpt.click();
    await page.waitForTimeout(200);

    // Click "Concluído" to close the Bairro dropdown list so we can see the tags below
    const doneBairroBtn = page.locator('.gfb-dropdown-close').first();
    await doneBairroBtn.click();
    await page.waitForTimeout(400);

    // Take screenshot of the drawer showing the selected tags under the Bairro combobox
    await page.screenshot({ path: `${OUT}gfb_drawer_with_inline_chips.png` });

    // Close the drawer
    await closeBtn.click();
    await page.waitForTimeout(500);

    // 3. Take screenshot of the dashboard page with active filters:
    // It should STILL be 100% clean (no filter chips strip) even though COVID-19 and Bairros are selected!
    await page.screenshot({ path: `${OUT}gfb_dashboard_with_active_filters_clean.png` });
  } catch (e) {
    console.log('Failed during drawer consolidation E2E screenshots:', e.message);
  }

  // 4. Dark Mode Drawer consolidated state
  try {
    const filterNavBtn = page.locator('button[aria-label="Mostrar Filtros"]');
    await filterNavBtn.click();
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}gfb_drawer_dark_with_inline_chips.png` });
  } catch (e) {
    console.log('Failed during dark mode E2E screenshot:', e.message);
  }

  await browser.close();
  console.log('Consolidated Filter screenshots saved successfully to', OUT);
})();
