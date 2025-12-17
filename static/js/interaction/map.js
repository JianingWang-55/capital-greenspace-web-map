/**
 * map.js
 * ------------------------------------------------------------------
 * Map Initialization and Control Logic for Interactive Search Map.
 * This file handles:
 * - Initializing the Leaflet map instance with default settings.
 * - Configuring tile layers (OpenStreetMap).
 * - Implementing a custom Pan Control (Directional arrows + Center reset).
 * - Utility functions for bulk marker management (hiding/resetting).
 * ------------------------------------------------------------------
 */

// Initialize Map
const map = L.map('map', { center: [defaultLat, defaultLon], zoom: defaultZoom, zoomControl: false });
L.control.zoom({ position: 'topright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);

// --- PAN CONTROL ---
const PanControl = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function(map) {
        const container = L.DomUtil.create('div', 'leaflet-control-pan leaflet-bar');
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        const createBtn = (iconClass, dx, dy, gridClass, title) => {
            const btn = L.DomUtil.create('div', `pan-btn ${gridClass}`, container);
            btn.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
            btn.title = title;
            btn.onclick = (e) => {
                e.preventDefault();
                map.panBy([dx, dy]);
            };
            return btn;
        };

        createBtn('fa-arrow-up', 0, -100, 'pan-up', 'Pan Up');
        createBtn('fa-arrow-left', -100, 0, 'pan-left', 'Pan Left');
        createBtn('fa-arrow-right', 100, 0, 'pan-right', 'Pan Right');
        createBtn('fa-arrow-down', 0, 100, 'pan-down', 'Pan Down');

        const centerBtn = L.DomUtil.create('div', 'pan-btn pan-center', container);
        centerBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
        centerBtn.title = "Reset View";
        centerBtn.onclick = (e) => {
            e.preventDefault();
            map.setView([defaultLat, defaultLon], defaultZoom);
        };

        return container;
    }
});
map.addControl(new PanControl());

// --- MARKER UTILS ---
function hideAllMarkers() {
    parks.forEach(p => {
        let m = parkMarkers[p.name.toLowerCase()];
        if(m) map.removeLayer(m);
        m.unbindTooltip();
    });
    if(userMarker) map.removeLayer(userMarker);
    if(searchCircle) map.removeLayer(searchCircle);
}

function resetMarkers() {
    animationTimeouts.forEach(t => clearTimeout(t));
    animationTimeouts = [];
    parks.forEach(p => {
        let m = parkMarkers[p.name.toLowerCase()];
        if(m) {
            m.setIcon(icons.black);
            m.setZIndexOffset(0);
            m.addTo(map); 
            m.closePopup();
            m.unbindTooltip();
        }
    });
}