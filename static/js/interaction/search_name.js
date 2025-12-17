/**
 * search_name.js
 * ------------------------------------------------------------------
 * Name-based Search Logic for 'Find by Name' Functionality of Interactive Search Map.
 * This module handles the "Search by Park Name" input field.
 * * Key Functionality:
 * - Autocomplete: Filters the global park list as the user types.
 * - Navigation: Zooms and pans to the selected park on the map.
 * - State Reset: Clears previous rankings, search circles, or user markers
 * to focus purely on the selected park.
 * - Visual Updates: Resets marker icons to default state and ensures popups
 * are clean (removing stale rank/distance badges) before opening.
 * ------------------------------------------------------------------
 */

const searchInput = document.getElementById("search-box");
const suggestions = document.getElementById("suggestions");

if (searchInput) {
    searchInput.addEventListener("input", function() {
        let val = this.value.toLowerCase();
        suggestions.innerHTML = "";
        if(!val) { suggestions.style.display = "none"; return; }
        
        // Find matching parks (limit to 6 suggestions)
        let matches = parks.filter(p => p.name.toLowerCase().includes(val)).slice(0,6);
        
        if(matches.length > 0) {
            matches.forEach(p => {
                let div = document.createElement("div");
                div.className = "suggestion-item";
                div.textContent = p.name;
                div.onclick = () => {
                    // 1. GLOBAL RESET
                    // Clear previous rankings visuals
                    if(typeof resetMarkers === 'function') resetMarkers();
                    if(typeof closeTieModal === 'function') closeTieModal();
                    
                    // --- UPDATE EXPORT DATA TO THIS SPECIFIC PARK ---
                    window.currentExportData = [p];
                    
                    // Clear user location/search circle from nearby search
                    if(typeof userMarker !== 'undefined' && userMarker) { 
                        map.removeLayer(userMarker); 
                        userMarker = null; 
                    }
                    if(typeof searchCircle !== 'undefined' && searchCircle) { 
                        map.removeLayer(searchCircle); 
                        searchCircle = null; 
                    }
                    
                    // 2. TARGET MARKER LOGIC
                    const key = p.name.toLowerCase();
                    const m = parkMarkers[key];

                    if (m) {
                        // --- CRITICAL FIX START ---
                        // Explicitly reset the popup content to remove any old "Rank #X" badges.
                        if (typeof createPopupContent === 'function') {
                            m.setPopupContent(createPopupContent(p, ""));
                        }

                        // Ensure icon is explicitly set to default blue
                        if (window.icons && window.icons.blue) {
                            m.setIcon(window.icons.blue);
                        }
                        // --- CRITICAL FIX END ---

                        // 3. OFFSET & ZOOM (Shift center up so popup isn't covered)
                        const targetZoom = 16;
                        const markerPoint = map.project([p.lat, p.lon], targetZoom);
                        const newCenterPoint = markerPoint.subtract([0, 150]); // Shift map down / center up
                        const targetLatLng = map.unproject(newCenterPoint, targetZoom);
                        
                        map.flyTo(targetLatLng, targetZoom);

                        // 4. Open the now-clean popup
                        m.openPopup();
                    }
                    
                    suggestions.style.display = "none";
                    searchInput.value = p.name;
                };
                suggestions.appendChild(div);
            });
            suggestions.style.display = "block";
        } else { suggestions.style.display = "none"; }
    });
}