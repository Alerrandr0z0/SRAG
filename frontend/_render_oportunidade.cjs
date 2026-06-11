const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  await page.goto(`http://localhost:5173/?cache=${Date.now()}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const links = await page.locator('text=Lab').all();
  if (links.length > 0) {
    await links[0].click();
    await page.waitForTimeout(2000);
  }

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const header = page.locator('text=Oportunidade terapêutica').first();
  await header.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);

  // Find the article.panel that contains the Oportunidade terapêutica header
  const section = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('*')).filter(
      (el) => el.textContent && el.textContent.trim() === 'Oportunidade terapêutica',
    );
    if (headers.length === 0) return null;
    let el = headers[0];
    while (el?.parentElement) {
      el = el.parentElement;
      if (el.tagName === 'ARTICLE' && el.className.includes('panel')) {
        const rect = el.getBoundingClientRect();
        return {
          x: Math.max(0, rect.x - 20),
          y: Math.max(0, rect.y - 20),
          width: Math.min(1600, rect.width + 40),
          height: Math.min(900, rect.height + 40),
        };
      }
    }
    return null;
  });

  if (section) {
    await page.screenshot({
      path: '/home/alerrandro/Desktop/SRAG/oportunidade.png',
      clip: section,
    });
    console.log('Panel captured at /home/alerrandro/Desktop/SRAG/oportunidade.png:', section);
  } else {
    console.log('Could not find panel');
  }

  await browser.close();
})();
