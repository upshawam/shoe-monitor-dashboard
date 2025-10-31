async function loadStatus() {
  try {
    const res = await fetch('status.json?cacheBust=' + Date.now());
    const data = await res.json();
    document.getElementById('status').innerHTML =
      `<p>Size ${data.target_size}: <strong>${data.status}</strong></p>
       <p>Last check: ${data.last_check}</p>`;
  } catch (e) {
    document.getElementById('status').innerText = 'Error loading status';
  }
}

// Load immediately and refresh every 60s
loadStatus();
setInterval(loadStatus, 60000);
