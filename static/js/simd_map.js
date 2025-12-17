/**
 * simd_map.js
 * ------------------------------------------------------------------
 * Greenspace & Deprivation Explorer Map Visualization Logic.
 * * Key Functionality:
 * - Map Initialization: Sets up Leaflet with OpenStreetMap and Satellite base layers.
 * - SIMD Layer: Fetches and renders the SIMD GeoJSON, applying a color scale based on deprivation deciles.
 * - Legend: Generates a dynamic visual legend explaining the SIMD color coding.
 * - Greenspace Overlay: Plots park markers on top of the SIMD layer.
 * - Rich Popups: Creates detailed popups for parks containing:
 * - Image galleries (with navigation controls).
 * - Recreation scores (Quality, Safety, Accessibility).
 * - External gallery links (with specific exclusions for certain parks).
 * ------------------------------------------------------------------
 */

// --- 1. INITIALIZATION ---
const defaultLat = 55.95;
const defaultLon = -3.2;
const defaultZoom = 11;

var map = L.map('map', {
    center: [defaultLat, defaultLon],
    zoom: defaultZoom,
    zoomControl: false 
});
L.control.zoom({ position: 'topright' }).addTo(map);

// --- 2. LAYERS ---
var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
});

var googleSat = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '© Google'
});

osm.addTo(map);

// --- 3. LAYER CONTROL LOGIC ---
document.getElementById('base-osm').addEventListener('change', function() {
    if (this.checked) {
        map.addLayer(osm);
        map.removeLayer(googleSat);
    }
});

document.getElementById('base-sat').addEventListener('change', function() {
    if (this.checked) {
        map.addLayer(googleSat);
        map.removeLayer(osm);
    }
});

// --- 4. SIMD DATA & STYLING ---
function getSimdColor(decile_raw) {
    const d = Number(decile_raw);
    switch(d) {
        case 1: return '#8c001a';
        case 2: return '#c0002f';
        case 3: return '#e06600';
        case 4: return '#f2a900';
        case 5: return '#f7d154';
        case 6: return '#b7e3ed';
        case 7: return '#9ccad9';
        case 8: return '#6aa2ce';
        case 9: return '#405ba7';
        case 10: return '#1d1f7a';
        default: return '#ffffff';
    }
}

function simdStyle(feature) {
    return {
        fillColor: getSimdColor(feature.properties.Decilev2),
        weight: 1,
        opacity: 1,
        color: 'white',
        fillOpacity: 0.6
    };
}

var simdLayer = L.geoJSON(null, {
    style: simdStyle,
    onEachFeature: function (feature, layer) {
        let dz = feature.properties.DataZone;
        let dec = feature.properties.Decilev2;
        layer.bindPopup(
            `<div class="popup-card">
                <div class="popup-card-title">DataZone ${dz}</div>
                <div class="popup-card-content">
                    <span class="popup-row-label">SIMD Decile:</span> ${dec}
                </div>
            </div>`
        );
    }
});

if (typeof SIMD_GEOJSON_URL !== 'undefined') {
    fetch(SIMD_GEOJSON_URL)
        .then(r => r.json())
        .then(d => {
            simdLayer.addData(d);
            const simdCheckbox = document.getElementById('layer-simd');
            if(simdCheckbox.checked) simdLayer.addTo(map);
            document.getElementById('loading-overlay').style.display = 'none';
        })
        .catch(e => {
            console.error(e);
            document.getElementById('loading-overlay').style.display = 'none';
        });
}

document.getElementById('layer-simd').addEventListener('change', function() {
    if (this.checked) {
        simdLayer.addTo(map);
    } else {
        map.removeLayer(simdLayer);
    }
});

// --- 5. LEGEND ---
const legendContainer = document.getElementById('simd-legend-content');
const legendData = [
    {d: 1, color: '#8c001a', label: 'Most Deprived 10%'},
    {d: 2, color: '#c0002f', label: '2nd'},
    {d: 3, color: '#e06600', label: '3rd'},
    {d: 4, color: '#f2a900', label: '4th'},
    {d: 5, color: '#f7d154', label: '5th'},
    {d: 6, color: '#b7e3ed', label: '6th'},
    {d: 7, color: '#9ccad9', label: '7th'},
    {d: 8, color: '#6aa2ce', label: '8th'},
    {d: 9, color: '#405ba7', label: '9th'},
    {d: 10, color: '#1d1f7a', label: 'Least Deprived 10%'}
];

if (legendContainer) {
    legendData.forEach(item => {
        let row = document.createElement('div');
        row.className = 'legend-row';
        row.innerHTML = `<div class="legend-color" style="background:${item.color};"></div><span>${item.label}</span>`;
        legendContainer.appendChild(row);
    });
}

// --- 6. GREENSPACE MARKERS ---
var blackIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-black.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

var greenspaceLayer = L.layerGroup();

// === IMAGE GALLERY FUNCTION ===
function createImageGallery(images, parkId, parkName) {
    if (!images || images.length === 0) {
        return `<div class="no-image-placeholder">No images available</div>`;
    }

    let galleryHtml = '<div class="image-gallery" id="gallery-' + parkId + '">';
    
    images.forEach((imgPath, index) => {
        const activeClass = index === 0 ? 'active' : '';
        
        // 1. Clean Path
        let cleanPath = String(imgPath).replace(/\\/g, '/');
        cleanPath = cleanPath.replace(/^static\//, "").replace(/^\/static\//, "");

        // 2. RENAME FIXES
        if (cleanPath.includes("St Margaret's Park")) {
            cleanPath = cleanPath.replace("St Margaret's Park", "St Margarets Park");
        } 
        else if (cleanPath.includes("St Magaret's Park")) { 
            cleanPath = cleanPath.replace("St Magaret's Park", "St Margarets Park");
        }

        // 3. Encode Path
        cleanPath = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/');

        // 4. Prepend Base URL
        const baseUrl = (typeof STATIC_BASE_URL !== 'undefined') ? STATIC_BASE_URL : 'static/';
        const fullUrl = baseUrl + cleanPath;

        galleryHtml += `<img src="${fullUrl}" class="gallery-image ${activeClass}" 
                             alt="Park image" onerror="this.style.display='none'">`;
    });
    
    if (images.length > 1) {
        galleryHtml += `
            <div class="gallery-controls">
                <button class="gallery-btn" onclick="changeImage(${parkId}, -1)">◀</button>
                <span class="gallery-counter" id="counter-${parkId}">1/${images.length}</span>
                <button class="gallery-btn" onclick="changeImage(${parkId}, 1)">▶</button>
            </div>`;
    }
    galleryHtml += '</div>';
    return galleryHtml;
}

window.currentImageIndex = {};
window.changeImage = function(parkId, direction) {
    const gallery = document.getElementById('gallery-' + parkId);
    if (!gallery) return;
    const images = gallery.querySelectorAll('.gallery-image');
    const counter = document.getElementById('counter-' + parkId);
    
    if (!window.currentImageIndex[parkId]) window.currentImageIndex[parkId] = 0;
    
    images[window.currentImageIndex[parkId]].classList.remove('active');
    window.currentImageIndex[parkId] += direction;
    
    if (window.currentImageIndex[parkId] < 0) window.currentImageIndex[parkId] = images.length - 1;
    else if (window.currentImageIndex[parkId] >= images.length) window.currentImageIndex[parkId] = 0;
    
    images[window.currentImageIndex[parkId]].classList.add('active');
    if (counter) counter.textContent = (window.currentImageIndex[parkId] + 1) + '/' + images.length;
};

if (typeof parksData !== 'undefined') {
    parksData.forEach(park => {
        let imageGalleryHtml = createImageGallery(park.images, park.site_id, park.name);
        
        // === FIX APPLIED HERE: Exclude both "Harrison Park East" AND "Dalry Community Park" ===
        let shouldShowGalleryButton = (
            park.gallery_url && 
            park.name !== "Harrison Park East" && 
            park.name !== "Dalry Community Park"
        );

        let galleryButton = shouldShowGalleryButton
            ? `<a href="${park.gallery_url}" target="_blank" class="gallery-button"> View Online Gallery</a>` 
            : '';

        L.marker([park.lat, park.lon], { icon: blackIcon })
            .bindPopup(
                `<div class="popup-card">
                    ${imageGalleryHtml}
                    <div class="popup-card-title">${park.name}</div>
                    <div class="popup-card-content">
                        <div class="popup-info-row"><span class="popup-row-label">Site ID:</span> ${park.site_id}</div>
                        <div class="popup-info-row"><span class="popup-row-label">Recreation Index:</span> <b>${park.recreation || 'N/A'}</b></div>
                        <div class="popup-info-row"><span class="popup-row-label">Facility Quality:</span> ${park.quality}</div>
                        <div class="popup-info-row"><span class="popup-row-label">Quantity & Variety:</span> ${park.quantity}</div>
                        <div class="popup-info-row"><span class="popup-row-label">Safety:</span> ${park.safety}</div>
                        <div class="popup-info-row"><span class="popup-row-label">Accessibility:</span> ${park.accessibility}</div>
                        <hr style="margin: 8px 0; border:0; border-top:1px solid #eee;">
                        <div class="popup-info-row"><span class="popup-row-label">SIMD Decile:</span> ${park.decile}</div>
                        <div class="popup-info-row"><span class="popup-row-label">Postcode:</span> ${park.postcode}</div>
                        ${galleryButton}
                    </div>
                </div>`,
                { maxWidth: 350 }
            )
            .addTo(greenspaceLayer);
    });
}

greenspaceLayer.addTo(map); 
document.getElementById('layer-green').addEventListener('change', function() {
    if (this.checked) {
        greenspaceLayer.addTo(map);
    } else {
        map.removeLayer(greenspaceLayer);
    }
});