/**
 * main.js
 * ------------------------------------------------------------------
 * Main entry point for the Interactive Search Map module.
 * This file handles:
 * - Initialization of global export data.
 * - Iteration through the park data (passed from Flask template).
 * - Creation of Leaflet markers for each park.
 * - Binding of popups to markers using content generators from popup.js.
 * ------------------------------------------------------------------
 */


// Initialize global export data with all parks on load
if (typeof parks !== 'undefined') {
    window.currentExportData = parks;
}

// Main initialization logic
if (typeof parks !== 'undefined' && map) {
    parks.forEach(p => {
        // createPopupContent is defined in popup.js
        let m = L.marker([p.lat, p.lon], { icon: icons.black })
            .bindPopup(createPopupContent(p), { 
                maxWidth: 350, 
                minWidth: 350,
                autoPanPaddingTopLeft: [400, 20],
                autoPanPaddingBottomRight: [20, 20]
            });
        
        parkMarkers[p.name.toLowerCase()] = m;
        m.addTo(map);
    });
}