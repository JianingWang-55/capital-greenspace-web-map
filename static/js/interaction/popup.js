/**
 * popup.js
 * ------------------------------------------------------------------
 * Map Popup & Gallery Logic for Interactiv Search Map.
 * This module handles the generation and interactivity of Leaflet popups.
 * * Key Functionality:
 * - HTML Generation: Dynamically creates popup content including Park metadata,
 * SIMD scores, and SVG/PNG bar charts.
 * - Image Gallery: Manages image carousels within popups (navigating between park images).
 * - Path Resolution: Helper functions to handle static asset paths and fix specific
 * folder naming conventions (e.g., handling "St Margaret's" apostrophes).
 * - Routing: Provides external links to Google Maps for navigation.
 * ------------------------------------------------------------------
 */


// Ensure global image index exists
window.currentImageIndex = window.currentImageIndex || {};

// ----- Helper: get correct static base (supports SCRIPT_NAME) -----
function getStaticBase() {
    if (typeof STATIC_BASE !== "undefined" && STATIC_BASE) return STATIC_BASE;
    return "/static/";
}

// ----- Helper: build URL for a relative static path -----
function buildStaticUrl(relativePath) {
    const base = getStaticBase(); 
    let clean = String(relativePath || "").replace(/^\/+/, ""); 
    
    // --- RENAME FIX: "St Margaret's Park" -> "St Margarets Park" ---
    if (clean.includes("St Margaret's Park")) {
        clean = clean.replace("St Margaret's Park", "St Margarets Park");
    }
    else if (clean.includes("St Magaret's Park")) {
        clean = clean.replace("St Magaret's Park", "St Margarets Park");
    }

    // Encode safely
    const encoded = clean.split("/").map(encodeURIComponent).join("/");
    return base + encoded;
}

// Handles image gallery navigation within the popup
window.changeImage = function (parkId, direction) {
    const gallery = document.getElementById("gallery-" + parkId);
    if (!gallery) return;

    const images = gallery.querySelectorAll(".gallery-image");
    const counter = document.getElementById("counter-" + parkId);

    if (!images || images.length === 0) return;

    if (window.currentImageIndex[parkId] === undefined) window.currentImageIndex[parkId] = 0;

    images[window.currentImageIndex[parkId]].classList.remove("active");
    window.currentImageIndex[parkId] += direction;

    if (window.currentImageIndex[parkId] < 0) window.currentImageIndex[parkId] = images.length - 1;
    if (window.currentImageIndex[parkId] >= images.length) window.currentImageIndex[parkId] = 0;

    images[window.currentImageIndex[parkId]].classList.add("active");
    if (counter) counter.textContent = `${window.currentImageIndex[parkId] + 1}/${images.length}`;
};

// Generates the HTML string for the Leaflet Popup
function createPopupContent(p, extraBadge = "") {
    // ---------- 1) IMAGE GALLERY ----------
    let galleryHTML = `
        <div class="no-image-placeholder" style="height:160px; display:flex; align-items:center; justify-content:center; background:#eee; color:#999; font-size:14px;">
            No Image
        </div>`;

    if (p.images && p.images.length > 0) {
        const imgs = p.images.map((src, i) => {
            let normalized = String(src).replace(/^static\//, "").replace(/^\/static\//, "");
            const fullUrl = buildStaticUrl(normalized);

            return `<img src="${fullUrl}" class="gallery-image ${i === 0 ? "active" : ""}"
                        alt="Park image"
                        onerror="this.style.display='none'">`;
        }).join("");

        const controls = p.images.length > 1
            ? `<div class="gallery-controls">
                    <span class="gallery-nav" onclick="changeImage(${p.site_id}, -1)">❮</span>
                    <span class="gallery-count" id="counter-${p.site_id}">1/${p.images.length}</span>
                    <span class="gallery-nav" onclick="changeImage(${p.site_id}, 1)">❯</span>
               </div>`
            : "";

        galleryHTML = `<div class="image-gallery" id="gallery-${p.site_id}">${imgs}${controls}</div>`;
    }

    // ---------- 2) BAR CHART ----------
    const chartSvgUrl = buildStaticUrl(`barchart/${p.site_id}.svg`);
    const chartPngUrl = buildStaticUrl(`barchart/${p.site_id}.png`); 

    const chartHTML = `
        <div class="chart-image-container">
            <img src="${chartSvgUrl}" class="chart-image"
                 alt="Scores for ${p.name}"
                 onerror="
                    this.onerror=null;
                    this.src='${chartPngUrl}';
                    this.onerror=function(){
                        this.style.display='none';
                        this.parentElement.innerHTML='<div style=\'text-align:center;color:red;padding:10px;\'>Chart not available</div>';
                    };
                 ">
        </div>`;

    // ---------- 3) RETURN POPUP ----------
    return `
        <div class="popup-card">
            ${galleryHTML}
            <div class="popup-header">
                <div class="popup-title">${p.name}</div>
                ${extraBadge}
            </div>
            <div class="popup-body">
                <div class="rec-metric">Recreation Metric: ${p.recreation || "N/A"}</div>
                ${chartHTML}
                <div class="meta-info">
                    <strong>Site ID:</strong> ${p.site_id}
                    • <strong>SIMD:</strong> ${p.decile}<br>
                    ${p.community}, ${p.postcode}
                </div>
                <div class="btn-row">
                    <button onclick="showRoute(${p.lat}, ${p.lon})" class="action-btn btn-route">
                        <i class="fa-solid fa-diamond-turn-right"></i> Route
                    </button>
                </div>
            </div>
        </div>
    `;
}

window.createPopupContent = createPopupContent;

// ----- Fixed Route Function -----
window.showRoute = function (lat, lon) {
    if (typeof userMarker !== "undefined" && userMarker) {
        const uPos = userMarker.getLatLng();
        window.open(`https://www.google.com/maps/dir/?api=1&origin=${uPos.lat},${uPos.lng}&destination=${lat},${lon}&travelmode=walking`);
    } else {
        window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`);
    }
};