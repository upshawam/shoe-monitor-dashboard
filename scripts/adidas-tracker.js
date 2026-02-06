const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// Configuration
const ADIDAS_URL = 'https://www.adidas.com/us/adizero-adios-pro-4-shoes/JR1094.html?forceSelSize=12';
const CACHE_FILE = path.join(__dirname, '../.adidas-cache.json');
const TRACKERS_FILE = path.join(__dirname, '../trackers.json');
const HTML_FILE = process.env.ADIDAS_HTML_FILE;

function normalizeProductUrl(url) {
  try {
    const normalized = new URL(url, 'https://www.adidas.com');
    return normalized.origin + normalized.pathname;
  } catch {
    return url;
  }
}

function collectProductNodes(node, results) {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach(item => collectProductNodes(item, results));
    return;
  }
  if (typeof node === 'object') {
    const productId = node.productId || node.id || node.product_id;
    const url = node.url || node.link || node.productUrl || node.product_url || node.slug;
    if (productId && url) {
      results.push({ productId, url });
    }
    Object.values(node).forEach(value => collectProductNodes(value, results));
  }
}

function extractProductUrls(html) {
  const urls = new Set();

  // 1) Parse Next.js data if present
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const products = [];
      collectProductNodes(nextData, products);
      products.forEach(p => urls.add(normalizeProductUrl(p.url)));
    } catch (e) {
      // Ignore JSON parsing errors and fall back to HTML parsing
    }
  }

  // 2) Parse product cards if present
  const cardRegex = /data-auto-id="product-card"[\s\S]*?href="([^\"]+?\.html)"/g;
  for (const match of html.matchAll(cardRegex)) {
    urls.add(normalizeProductUrl(match[1]));
  }

  // 2b) Parse product card image links (data-testid)
  const testIdLinkRegex = /data-testid="product-card-image-link"[^>]*href="([^\"]+?\.html[^"]*)"/g;
  for (const match of html.matchAll(testIdLinkRegex)) {
    urls.add(normalizeProductUrl(match[1]));
  }

  // 3) Fallback: any adidas product URL in page
  const hrefRegex = /href="(\/us\/[^\"]+?\.html)"/g;
  for (const match of html.matchAll(hrefRegex)) {
    const href = match[1];
    if (!href.includes('/help') && !href.includes('/account') && !href.includes('/terms') && !href.includes('/privacy')) {
      urls.add(normalizeProductUrl(href));
    }
  }

  return [...urls];
}

function isBlockedResponse(html, statusCode) {
  if (statusCode === 403) return true;
  if (!html) return false;
  return html.includes('WAFfailoverassets') || html.includes('HTTP 403') || html.includes('Reference Error');
}

async function fetchProductsWithPlaywright(url) {
  const userDataDir = path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data');
  
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = browser.pages()[0] || await browser.newPage();

  // Human-like navigation with delays
  console.log('Opening page...');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Simulate human behavior - wait and scroll
  console.log('Waiting for content to render...');
  await page.waitForTimeout(2000 + Math.random() * 3000);

  // Scroll to trigger any lazy-loading
  await page.evaluate(() => window.scrollBy(0, window.innerHeight));
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollBy(0, -window.innerHeight));
  await page.waitForTimeout(1000);

  const html = await page.content();

  const productLinks = await page.$$eval(
    '[data-testid="product-card-image-link"]',
    elements => elements.map(el => el.getAttribute('href') || el.href).filter(Boolean)
  ).catch(() => []);

  const cardLinks = await page.$$eval(
    '[data-auto-id="product-card"] a[href$=".html"]',
    elements => elements.map(el => el.getAttribute('href') || el.href).filter(Boolean)
  ).catch(() => []);

  console.log('Browser will stay open for 60 seconds so you can read the page...');
  await page.waitForTimeout(60000);

  await browser.close();

  const combined = [...productLinks, ...cardLinks]
    .filter(Boolean)
    .map(link => {
      try {
        const normalized = new URL(link, 'https://www.adidas.com');
        return normalized.origin + normalized.pathname;
      } catch {
        return link;
      }
    });

  return {
    html,
    productUrls: [...new Set(combined)]
  };
}

async function checkForProducts() {
  try {
    console.log('Fetching Adidas products...');
    let html = '';
    let statusCode = 200;
    let currentProducts = [];

    if (HTML_FILE && fs.existsSync(HTML_FILE)) {
      html = fs.readFileSync(HTML_FILE, 'utf8');
      currentProducts = extractProductUrls(html);
    } else {
      const result = await fetchProductsWithPlaywright(ADIDAS_URL);
      html = result.html;
      currentProducts = result.productUrls;
    }

    if (isBlockedResponse(html, statusCode)) {
      console.log('Blocked by Adidas (HTTP 403 / WAF).');
      const trackers = JSON.parse(fs.readFileSync(TRACKERS_FILE, 'utf8'));
      trackers.adidas_adizero_adios_pro_8_5 = {
        name: 'Adidas - Adizero Adios Pro 8.5',
        status: 'BLOCKED',
        last_check: new Date().toLocaleString(),
        link: ADIDAS_URL,
        product_count: 0
      };
      fs.writeFileSync(TRACKERS_FILE, JSON.stringify(trackers, null, 2));
      process.exit(2);
    }

    let previousProducts = [];
    let previousStatus = 'OUT';

    if (fs.existsSync(CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      previousProducts = cache.products || [];
      previousStatus = cache.status || 'OUT';
    }

    const newProducts = currentProducts.filter(p => !previousProducts.includes(p));
    const status = currentProducts.length > 0 ? 'IN' : 'OUT';

    console.log(`Found ${currentProducts.length} products (${newProducts.length} new)`);

    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      products: currentProducts,
      status: status,
      lastCheck: new Date().toISOString(),
      newProducts: newProducts
    }));

    const trackers = JSON.parse(fs.readFileSync(TRACKERS_FILE, 'utf8'));
    trackers.adidas_adizero_adios_pro_8_5 = {
      name: 'Adidas - Adizero Adios Pro 8.5',
      status: status,
      last_check: new Date().toLocaleString(),
      link: ADIDAS_URL,
      product_count: currentProducts.length
    };
    fs.writeFileSync(TRACKERS_FILE, JSON.stringify(trackers, null, 2));

    if (newProducts.length > 0) {
      console.log('✓ New products found:', newProducts.join(', '));
      process.exit(0);
    } else {
      console.log('✗ No new products');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(2);
  }
}

checkForProducts();
