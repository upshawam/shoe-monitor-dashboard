const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const GEARTRADE_URL = 'https://geartrade.com/search?q=la+sportiva&type=article%2Cpage%2Cproduct&options%5Bprefix%5D=last&sort_by=relevance&filter.v.option.size=46.5';
const CACHE_FILE = path.join(__dirname, '../.geartrade-cache.json');
const TRACKERS_FILE = path.join(__dirname, '../trackers.json');

async function fetchProducts() {
  return new Promise((resolve, reject) => {
    https.get(GEARTRADE_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          // Extract product IDs from the page
          const productMatches = data.match(/data-product-id="(\d+)"/g) || [];
          const products = productMatches.map(m => m.match(/\d+/)[0]);
          resolve([...new Set(products)]); // Remove duplicates
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function checkForNewProducts() {
  try {
    console.log('Fetching Geartrade products...');
    const currentProducts = await fetchProducts();
    
    let previousProducts = [];
    let previousStatus = 'OUT';
    
    // Load cache
    if (fs.existsSync(CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      previousProducts = cache.products || [];
      previousStatus = cache.status || 'OUT';
    }
    
    // Find new products
    const newProducts = currentProducts.filter(p => !previousProducts.includes(p));
    const status = currentProducts.length > 0 ? 'IN' : 'OUT';
    
    console.log(`Found ${currentProducts.length} products (${newProducts.length} new)`);
    
    // Update cache
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      products: currentProducts,
      status: status,
      lastCheck: new Date().toISOString(),
      newProducts: newProducts
    }));
    
    // Update trackers.json
    const trackers = JSON.parse(fs.readFileSync(TRACKERS_FILE, 'utf8'));
    trackers.geartrade_la_sportiva_46_5 = {
      name: 'Geartrade - La Sportiva 46.5',
      status: status,
      last_check: new Date().toLocaleString(),
      link: GEARTRADE_URL,
      product_count: currentProducts.length
    };
    fs.writeFileSync(TRACKERS_FILE, JSON.stringify(trackers, null, 2));
    
    // Return info for GitHub Action
    if (newProducts.length > 0) {
      console.log('✓ New products found:', newProducts.join(', '));
      process.exit(0); // Success - new products found
    } else {
      console.log('✗ No new products');
      process.exit(1); // No new products
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(2); // Error state
  }
}

checkForNewProducts();
