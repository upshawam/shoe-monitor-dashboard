# Shoe Monitor Dashboard

A real-time shoe availability tracker with automatic alerts.

## Features

- 📊 **Real-time Dashboard** - View tracker status at a glance
- 🔔 **Automated Alerts** - Get GitHub issues when products are found
- ⏰ **Scheduled Checks** - Run tracking on a regular schedule
- 💾 **Smart Caching** - Only alerts on new products

## Trackers

### Geartrade La Sportiva 46.5
Monitors Geartrade for new La Sportiva shoes in size 46.5.

**Link:** https://geartrade.com/search?q=la+sportiva&type=article%2Cpage%2Cproduct&options%5Bprefix%5D=last&sort_by=relevance&filter.v.option.size=46.5

**Check Frequency:** Every 6 hours

### Adidas Adizero Adios Pro (Size 8.5)
Monitors Adidas for Adizero Adios Pro shoes in size 8.5.

**Link:** https://www.adidas.com/us/men-adizero-adizero_adios_pro-running-shoes-sale?v_size_en_us=m_8.5___w_9.5%7C8.5%7C851_8%7C853_8%7C855_8%7C853_4%7C857_8%7C851_4%7C851_2

**Check Frequency:** Every 6 hours

**Note:** Adidas blocks simple HTTP requests (HTTP 403/WAF). The tracker uses Playwright (headless browser) for a more reliable fetch. If you still get `BLOCKED`, try running the tracker locally or save the page HTML from a browser and run with `ADIDAS_HTML_FILE`.

## How It Works

1. **GitHub Action Workflow** runs on a schedule (`.github/workflows/geartrade-tracker.yml`)
2. **Tracker Script** (`scripts/geartrade-tracker.js`) fetches the product page
3. **Cache System** compares current products against previous check
4. **If New Products Found:**
   - Updates `trackers.json` with status
   - Creates a GitHub Issue with alert details
   - Sends email notification (via GitHub Issues)
5. **Dashboard** displays real-time status from `trackers.json`

## Files

- `index.html` - Dashboard UI
- `index.js` - Dashboard logic (loads tracker status)
- `style.css` - Dashboard styling
- `trackers.json` - Current tracker status (updated by workflow)
- `.geartrade-cache.json` - Cache of last known products
- `scripts/geartrade-tracker.js` - Geartrade monitoring script
- `.github/workflows/geartrade-tracker.yml` - Automated check workflow
- `.github/workflows/adidas-tracker.yml` - Automated Adidas check workflow
- `scripts/adidas-tracker.js` - Adidas monitoring script

## Setup

1. **Push to GitHub** - The workflow will auto-run on schedule
2. **Enable Notifications** - Configure GitHub to email you on issues
3. **View Dashboard** - Access `index.html` to see live status

## Manual Trigger

To run the checker manually:
1. Go to Actions → "Check Geartrade for New La Sportiva Shoes"
2. Click "Run workflow"

## Customization

To change the check frequency, edit `.github/workflows/geartrade-tracker.yml`:

```yaml
schedule:
  - cron: '0 */6 * * *'  # Change this to your desired interval
```

Cron examples:
- `0 */3 * * *` - Every 3 hours
- `0 0,6,12,18 * * *` - Four times a day
- `0 * * * *` - Every hour
