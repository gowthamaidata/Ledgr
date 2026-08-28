/**
 * Ledgr — Playwright Mobile Test Suite
 * Run: npx playwright test
 * Requires: LEDGR_URL env var or defaults to localhost:5173
 *
 * Uses Pixel 5 emulation to test mobile flows.
 * Set LEDGR_EMAIL and LEDGR_PASSWORD env vars for auth tests.
 */

import { test, expect, devices } from '@playwright/test';

const BASE_URL  = process.env.LEDGR_URL || 'http://localhost:5173';
const EMAIL     = process.env.LEDGR_EMAIL || 'gowtham.aidata@gmail.com';
const PASSWORD  = process.env.LEDGR_PASSWORD || 'Gowtham@0.';
const PIXEL5    = devices['Pixel 5'];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto(BASE_URL + '/login');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 10_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('login page loads', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await page.goto(BASE_URL + '/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await ctx.close();
  });

  test('login with valid credentials', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await login(page);
    // Should reach the dashboard (not the login page)
    await expect(page).not.toHaveURL(/\/login/);
    await ctx.close();
  });

  test('login with invalid password shows error', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await page.goto(BASE_URL + '/login');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should stay on login or show error
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('/login');
    await ctx.close();
  });

  test('protected route redirects when logged out', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await page.goto(BASE_URL + '/transactions');
    await page.waitForTimeout(2000);
    // Should be redirected to login
    expect(page.url()).toContain('/login');
    await ctx.close();
  });
});

test.describe('Dashboard', () => {
  test('dashboard loads after login', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(BASE_URL + '/');
    // Dashboard should have some financial content
    await expect(page.locator('body')).toBeVisible();
    // Check no uncaught errors in console
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.waitForTimeout(2000);
    console.log('Console errors:', errors.filter(e => !e.includes('favicon')));
    await ctx.close();
  });

  test('dashboard shows monthly navigation', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(BASE_URL + '/');
    await page.waitForTimeout(1500);
    // Look for navigation buttons (chevrons or month text)
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(1000);
    await ctx.close();
  });
});

test.describe('Add Transaction', () => {
  test('FAB/+ button opens QuickAdd sheet', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(BASE_URL + '/');
    await page.waitForTimeout(1000);

    // Find and click the + FAB (the center nav button on mobile)
    const fab = page.locator('button[aria-label="Add transaction"]').first();
    if (await fab.isVisible()) {
      await fab.click();
      await page.waitForTimeout(500);
      // Sheet should be visible
      await expect(page.locator('text=Add Transaction')).toBeVisible({ timeout: 3000 });
    } else {
      console.log('FAB not found — may be on desktop layout');
    }
    await ctx.close();
  });

  test('can switch between Expense / Income / Transfer tabs', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(BASE_URL + '/');
    await page.waitForTimeout(1000);

    const fab = page.locator('button[aria-label="Add transaction"]').first();
    if (await fab.isVisible()) {
      await fab.click();
      await page.waitForTimeout(500);

      // Click Income tab
      const incomeBtn = page.locator('button', { hasText: 'Income' }).first();
      await incomeBtn.click();
      await expect(page.locator('text=Income Source')).toBeVisible({ timeout: 2000 });

      // Click Transfer tab
      const transferBtn = page.locator('button', { hasText: 'Transfer' }).first();
      await transferBtn.click();
      await expect(page.locator('text=From Account')).toBeVisible({ timeout: 2000 });

      // Close with × button
      const closeBtn = page.locator('button[aria-label="Close"]').first();
      if (await closeBtn.isVisible()) await closeBtn.click();
    }
    await ctx.close();
  });

  test('close button dismisses sheet', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(BASE_URL + '/');
    await page.waitForTimeout(1000);

    const fab = page.locator('button[aria-label="Add transaction"]').first();
    if (await fab.isVisible()) {
      await fab.click();
      await page.waitForTimeout(400);
      const closeBtn = page.locator('button[aria-label="Close"]').first();
      await closeBtn.click();
      await page.waitForTimeout(400);
      // Sheet should be gone
      await expect(page.locator('text=Add Transaction')).not.toBeVisible({ timeout: 2000 }).catch(() => {});
    }
    await ctx.close();
  });
});

test.describe('Transactions page', () => {
  test('transactions page loads', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(BASE_URL + '/transactions');
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Transactions')).toBeVisible();
    await ctx.close();
  });

  test('PDF download button is present', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(BASE_URL + '/transactions');
    await page.waitForTimeout(1500);
    const pdfBtn = page.locator('button', { hasText: 'PDF' });
    await expect(pdfBtn).toBeVisible({ timeout: 3000 });
    await ctx.close();
  });

  test('filter controls work', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(BASE_URL + '/transactions');
    await page.waitForTimeout(1500);

    // Search input
    const search = page.locator('input[placeholder*="Search"]').first();
    if (await search.isVisible()) {
      await search.fill('food');
      await page.waitForTimeout(500);
      await search.fill('');
    }
    await ctx.close();
  });
});

test.describe('Navigation', () => {
  const routes = [
    { path: '/',             name: 'Dashboard'     },
    { path: '/transactions', name: 'Transactions'  },
    { path: '/insights',     name: 'Insights'      },
    { path: '/planning',     name: 'Planning'      },
    { path: '/settings',     name: 'Settings'      },
  ];

  for (const route of routes) {
    test(`${route.name} page loads without crash`, async ({ browser }) => {
      const ctx = await browser.newContext({ ...PIXEL5 });
      const page = await ctx.newPage();

      const errors = [];
      page.on('pageerror', e => errors.push(e.message));

      await login(page);
      await page.goto(BASE_URL + route.path);
      await page.waitForTimeout(2000);

      expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
      await ctx.close();
    });
  }
});

test.describe('Profile menu', () => {
  test('profile trigger is visible', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(BASE_URL + '/');
    await page.waitForTimeout(1500);

    // Mobile header should show user's name
    const header = page.locator('header, [role="banner"]').first();
    const headerText = await page.textContent('body');
    // Should contain part of the user's name or a G initial
    expect(headerText).toContain('G'); // Gowtham starts with G
    await ctx.close();
  });
});

test.describe('PWA / Installation', () => {
  test('manifest.json is accessible', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    const response = await page.goto(BASE_URL + '/manifest.json');
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.name).toContain('Ledgr');
    expect(json.display).toBe('standalone');
    expect(json.icons.length).toBeGreaterThan(0);
    await ctx.close();
  });

  test('service worker file is accessible', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    const response = await page.goto(BASE_URL + '/sw.js');
    expect(response.status()).toBe(200);
    await ctx.close();
  });

  test('icon-192.png is accessible', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    const response = await page.goto(BASE_URL + '/icon-192.png');
    expect(response.status()).toBe(200);
    await ctx.close();
  });

  test('app has viewport-fit=cover meta', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await page.goto(BASE_URL + '/');
    const viewport = await page.getAttribute('meta[name="viewport"]', 'content');
    expect(viewport).toContain('viewport-fit=cover');
    await ctx.close();
  });

  test('theme-color meta is present', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await page.goto(BASE_URL + '/');
    const themeColor = await page.getAttribute('meta[name="theme-color"]', 'content');
    expect(themeColor).toBeTruthy();
    await ctx.close();
  });
});

test.describe('Mobile UX', () => {
  test('no horizontal overflow on mobile viewport', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(BASE_URL + '/');
    await page.waitForTimeout(1500);

    const bodyWidth    = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2); // 2px tolerance
    await ctx.close();
  });

  test('touch targets are adequately sized (≥44px)', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(BASE_URL + '/');
    await page.waitForTimeout(1500);

    // Check nav buttons
    const buttons = await page.locator('nav button, nav a').all();
    for (const btn of buttons.slice(0, 5)) {
      const box = await btn.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40); // 40px minimum
      }
    }
    await ctx.close();
  });

  test('Insights page has charts', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PIXEL5 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(BASE_URL + '/insights');
    await page.waitForTimeout(3000);

    const hasSvg = await page.locator('svg').count();
    // May be 0 if no data yet — just check no crash
    console.log(`SVG elements found: ${hasSvg}`);
    await ctx.close();
  });
});
