async function loadStatus() {
  try {
    const res = await fetch('trackers.json?cacheBust=' + Date.now());
    const trackers = await res.json();
    const container = document.getElementById('trackers');
    
    container.innerHTML = Object.entries(trackers).map(([key, data]) => `
      <div class="tracker-card">
        <h2>${data.name}</h2>
        <p class="tracker-status ${data.status === 'IN' ? 'in-stock' : 'out-of-stock'}">
          Status: <strong>${data.status}</strong>
        </p>
        <p>Last check: ${data.last_check}</p>
        ${data.link ? `<p><a href="${data.link}" target="_blank">View source</a></p>` : ''}
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('trackers').innerHTML = '<p class="error">Error loading tracker status</p>';
  }
}

// Load immediately and refresh every 60s
loadStatus();
setInterval(loadStatus, 60000);
