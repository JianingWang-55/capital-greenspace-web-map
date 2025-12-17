/**
 * nearby.js
 * ------------------------------------------------------------------
 * Location-based Search Logic for 'Find Nearby' Functionality of Interactive Search Map.
 * This module handles finding parks relative to a user's location (Postcode).
 * * Core Functionality:
 * - Search Modes: Toggles between 'Nearest Park' and 'Within Distance'.
 * - Geocoding: Converts user postcodes to Lat/Lon via Nominatim API.
 * - Backend Integration: Sends location/facility criteria to the server.
 * - Visualization: Updates map with user marker, search radius, and result highlights.
 * - UI Management: Handles validation modals (Invalid Postcode, No Results, etc.).
 * ------------------------------------------------------------------
 */


function setSearchMode(isNearest) {
    nearestMode = isNearest;
    
    const btnDist = document.getElementById('mode-dist');
    const btnNear = document.getElementById('mode-near');
    const distInput = document.getElementById('distance-input');

    if (nearestMode) {
        // Nearest Mode Selected
        btnDist.classList.remove('active');
        btnNear.classList.add('active');
        distInput.disabled = true;
        distInput.style.opacity = "0.5";
    } else {
        // Distance Mode Selected
        btnNear.classList.remove('active');
        btnDist.classList.add('active');
        distInput.disabled = false;
        distInput.style.opacity = "1";
    }
}

// --- No Results Modal Logic ---
function showNoResultsModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('no-results-modal');
    if(overlay) overlay.style.display = 'block';
    if(modal) modal.style.display = 'block';
}

function closeNoResultsModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('no-results-modal');
    if(overlay) overlay.style.display = 'none';
    if(modal) modal.style.display = 'none';
}

// --- Invalid Postcode Modal Logic ---
function showInvalidPostcodeModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('invalid-postcode-modal');
    if(overlay) overlay.style.display = 'block';
    if(modal) modal.style.display = 'block';
}

function closeInvalidPostcodeModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('invalid-postcode-modal');
    if(overlay) overlay.style.display = 'none';
    if(modal) modal.style.display = 'none';
}

// --- Enter Postcode Modal Logic ---
function showEnterPostcodeModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('enter-postcode-modal');
    if(overlay) overlay.style.display = 'block';
    if(modal) modal.style.display = 'block';
}

function closeEnterPostcodeModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('enter-postcode-modal');
    if(overlay) overlay.style.display = 'none';
    if(modal) modal.style.display = 'none';
}

// --- Select Facility Modal Logic ---
function showSelectFacilityModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('select-facility-modal');
    if(overlay) overlay.style.display = 'block';
    if(modal) modal.style.display = 'block';
}

function closeSelectFacilityModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('select-facility-modal');
    if(overlay) overlay.style.display = 'none';
    if(modal) modal.style.display = 'none';
}

async function applyLocationSearch() {
    const postcode = document.getElementById('postcode-input').value.trim();
    
    // --- CHANGE START: Default distance to 5.0 if empty ---
    let rawDistance = document.getElementById('distance-input').value;
    const distance = rawDistance ? parseFloat(rawDistance) : 5.0;
    // --- CHANGE END ---

    const checkedBoxes = document.querySelectorAll('#facility-checklist input:checked');
    const selectedFacilities = Array.from(checkedBoxes).map(cb => cb.value);

    // 1. Basic Empty Check
    if(!postcode) return showEnterPostcodeModal();

    // 2. VALIDATION: Check for Valid UK Postcode Format
    const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i;

    if (!postcodeRegex.test(postcode)) {
        return showInvalidPostcodeModal();
    }

    // CHANGED: Trigger the central modal for missing facility selection
    if(selectedFacilities.length === 0) return showSelectFacilityModal();

    showLoader(true);
    resetMarkers();

    // CLEAR PREVIOUS SEARCH ARTIFACTS
    if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
    }
    if (searchCircle) {
        map.removeLayer(searchCircle);
        searchCircle = null;
    }

    try {
        // 3. Geocoding
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${postcode},Edinburgh,UK&limit=1`);
        const geoData = await geoRes.json();
        
        // Double check if Nominatim actually found something
        if(!geoData.length) throw new Error("Postcode location not found");
        
        const userLat = parseFloat(geoData[0].lat);
        const userLon = parseFloat(geoData[0].lon);
        
        userMarker = L.marker([userLat, userLon], { icon: icons.blue })
            .bindPopup(`<b>Your Location</b>`).addTo(map);
        userMarker.openPopup();

        // 4. Fetch Search Results
        const res = await fetch(SEARCH_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                facilities: selectedFacilities, 
                user_lat: userLat, 
                user_lon: userLon, 
                distance: nearestMode ? null : distance, // Use default-safe distance
                nearest_only: nearestMode 
            })
        });
        
        const result = await res.json();
        
        // 5. Client-Side Filtering (Strict AND Logic)
        let validMatches = result.parks.filter(match => {
            const fullPark = parks.find(p => String(p.site_id) === String(match.site_id));
            if (!fullPark || !fullPark.facilities) return false;
            return selectedFacilities.every(req => {
                const reqNorm = req.toLowerCase().trim();
                return fullPark.facilities.some(avail => avail.toLowerCase().trim() === reqNorm);
            });
        });

        // 6. Final Selection & UI Logic
        if (nearestMode && validMatches.length > 0) {
            // If Nearest Mode: Keep only the top 1 result
            validMatches = [validMatches[0]];
        }

        // --- UPDATE EXPORT DATA TO FOUND PARKS ---
        window.currentExportData = validMatches;

        if(validMatches.length === 0) { 
            showLoader(false); 
            // Trigger the central "No Results" modal
            return showNoResultsModal(); 
        }

        // LOGIC BRANCH:
        if (!nearestMode) {
            showNearbyModal(validMatches);
        }

        // 7. Display Markers on Map
        let bounds = L.latLngBounds();
        bounds.extend([userLat, userLon]);

        validMatches.forEach(match => {
            const fullPark = parks.find(p => String(p.site_id) === String(match.site_id));
            if(fullPark) {
                let m = parkMarkers[fullPark.name.toLowerCase()];
                if(m) {
                    m.setIcon(icons.green);
                    m.setZIndexOffset(500);
                    let badge = `<div class="badge badge-loc" style="background:#2c3e50; color:white; padding:5px 10px; border-radius:4px; font-weight:bold;">${match.distance.toFixed(2)} km</div>`;
                    let facInfo = `<div style="font-size:11px; color:var(--primary-color); margin-bottom:5px;"><strong>Found:</strong> ${selectedFacilities.join(', ')}</div>`;
                    
                    let content = createPopupContent(fullPark, badge);
                    let parts = content.split('<div class="popup-body">');
                    if (parts.length > 1) {
                         m.setPopupContent(parts[0] + '<div class="popup-body">' + facInfo + parts[1]);
                    } else {
                         m.setPopupContent(content);
                    }
                    
                    // AUTO-OPEN POPUP IF NEAREST MODE
                    if (nearestMode) {
                        m.openPopup();
                    }

                    bounds.extend(m.getLatLng());
                }
            }
        });

        if (!nearestMode) {
            searchCircle = L.circle([userLat, userLon], { radius: distance * 1000, color: '#0288D1', fillColor: '#0288D1', fillOpacity: 0.1, weight: 1 }).addTo(map);
        }

        map.fitBounds(bounds, { 
            paddingTopLeft: [420, 50], 
            paddingBottomRight: [50, 50], 
            maxZoom: 13 
        });
        
        showToast(`Found ${validMatches.length} park(s)!`);
    } catch (e) {
        console.error(e);
        // Show specific error if it was our "Not found" error, otherwise generic
        if (e.message === "Postcode location not found") {
            showToast("Could not locate that postcode. Please check it.");
        } else {
            showToast("Error searching. Please try again.");
        }
    } finally { showLoader(false); }
}