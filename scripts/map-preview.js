import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadConfig } from '../lib/config.js';

const config = loadConfig();
const COLORS = { blr: '#c2410c', ggn: '#1d4ed8' };

const cities = Object.values(config.cities).map((city) => ({
  id: city.id,
  name: city.name,
  color: COLORS[city.id] ?? '#047857',
  boundary: city.boundary,
  localities: city.localities,
}));

// "<" escaped so a locality name can never close the script tag
const data = JSON.stringify(cities).replace(/</g, '\\u003c');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Locality coverage preview</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; }
  .loc-label { background: rgba(255,255,255,.85); border: 0; box-shadow: none; font: 11px/1.2 system-ui, sans-serif; padding: 1px 4px; }
  .bar { position: absolute; z-index: 1000; top: 10px; right: 10px; background: #fff; padding: 6px; border-radius: 6px; font: 13px system-ui, sans-serif; box-shadow: 0 1px 4px rgba(0,0,0,.3); }
  .bar button { margin: 0 2px; padding: 4px 10px; cursor: pointer; }
</style>
</head>
<body>
<div id="map"></div>
<div class="bar" id="bar"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const cities = ${data};
const map = L.map('map');
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

const groups = {};
for (const city of cities) {
  const group = L.featureGroup();
  L.geoJSON(city.boundary, { style: { color: city.color, weight: 3, fillOpacity: 0.04 } }).addTo(group);
  for (const loc of city.localities) {
    const { low, high } = loc.rectangle;
    L.rectangle([[low.latitude, low.longitude], [high.latitude, high.longitude]], {
      color: city.color, weight: 1, fillOpacity: 0.12,
    }).bindTooltip(loc.name, { permanent: true, direction: 'center', className: 'loc-label' }).addTo(group);
  }
  groups[city.id] = group;
}

function show(id) {
  const bounds = [];
  for (const [cid, g] of Object.entries(groups)) {
    if (id === 'all' || id === cid) { g.addTo(map); bounds.push(g.getBounds()); } else { map.removeLayer(g); }
  }
  map.fitBounds(bounds.reduce((a, b) => a.extend(b)));
}

const bar = document.getElementById('bar');
for (const [id, label] of [['all', 'Both'], ...cities.map((c) => [c.id, c.name])]) {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = () => show(id);
  bar.appendChild(b);
}
show(cities[0].id);
</script>
</body>
</html>
`;

const out = path.join(ROOT, 'map-preview.html');
fs.writeFileSync(out, html);
console.log(`Wrote ${out}`);
