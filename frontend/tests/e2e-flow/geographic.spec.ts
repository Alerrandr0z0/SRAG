import { expect, test } from '@playwright/test';

test('Territory panel renders map and toggle controls', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.locator('button[aria-label="Território"]').click();

  await expect(page.locator('h3:has-text("Mapa territorial")').first()).toBeVisible({
    timeout: 10_000,
  });
  const territoryButton = page.locator('button[aria-label="Território"]');
  await expect(territoryButton).toHaveClass(/active/);
});

test('Territory choropleth is reachable via /geo/bairros_choropleth', async ({ page }) => {
  const response = await page.request.get('http://127.0.0.1:8000/geo/bairros_choropleth');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { type: string; features: unknown[] };
  expect(body.type).toBe('FeatureCollection');
  expect(Array.isArray(body.features)).toBe(true);
  expect(body.features.length).toBeGreaterThan(0);
});

test('Territory rural_sectors endpoint returns triangle data', async ({ page }) => {
  const response = await page.request.get('http://127.0.0.1:8000/geo/rural_sectors');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { type: string; features: unknown[] };
  expect(body.type).toBe('FeatureCollection');
});
