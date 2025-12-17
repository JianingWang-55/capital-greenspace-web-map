/**
 * ranking.js
 * ------------------------------------------------------------------
 * Ranking & Statistics Visualization for 'Filter by Score' Functionaliti of Interactive Search Map.
 * This module manages the logic for ranking parks based on different metrics.
 * * Key Functionality:
 * - Sorting: Orders parks by metrics (Quality, Quantity, Safety, Accessibility).
 * - Visual Feedback: Updates markers with rank-specific colors and tooltips.
 * - Tie Handling: Detects score ties and displays them in a detailed modal.
 * - Dynamic Styling: Injects CSS for custom rank tooltips on the fly.
 * - Modal Management: Handles UI for selecting rank types and number of results.
 * ------------------------------------------------------------------
 */

// --- Modal Logic Functions ---
function showSelectRankModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('select-rank-modal');
    if (overlay) overlay.style.display = 'block';
    if (modal) modal.style.display = 'block';
}

function closeSelectRankModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('select-rank-modal');
    if (overlay) overlay.style.display = 'none';
    if (modal) modal.style.display = 'none';
}

function showEnterRankNumModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('enter-rank-num-modal');
    if (overlay) overlay.style.display = 'block';
    if (modal) modal.style.display = 'block';
}

function closeEnterRankNumModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('enter-rank-num-modal');
    if (overlay) overlay.style.display = 'none';
    if (modal) modal.style.display = 'none';
}

// --- UPDATED showTieModal with distinct colors ---
function showTieModal(data, key) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('tie-modal');
    const note = document.getElementById('tie-modal-note');
    const list = document.getElementById('tie-list-content');

    // Check for actual ties
    const scores = data.map(p => p[key]);
    const hasTies = new Set(scores).size !== scores.length;

    if (list) {
        list.innerHTML = data.map((p, i) => {
            // Use displayRank - 1 to get color index (no cycling for up to 20 ranks)
            let colorIndex = (p.displayRank - 1);
            
            // If we exceed 20 colors, fall back to modulo
            if (colorIndex >= rankColorMap.length) {
                colorIndex = colorIndex % rankColorMap.length;
            }
            
            let colorKey = rankColorMap[colorIndex];
            let hexColor = rankHexMap[colorKey];
            let textColor = (colorKey === 'yellow' || colorKey === 'lime' || colorKey === 'cyan') ? '#000' : '#fff';

            return `
            <div class="tie-item" onclick="focusOnPark('${p.name.toLowerCase()}')" style="border-left: 5px solid ${hexColor}; padding-left: 10px; cursor: pointer;">
                <div style="flex: 1;">
                    <span class="badge" style="background:${hexColor}; color:${textColor}; padding:2px 6px; border-radius:4px; font-size:11px; margin-right:6px;">
                        #${p.displayRank}
                    </span>
                    <strong>${p.name}</strong>
                </div>
                <div style="font-weight:bold; color:#555; font-size:13px;">Score: ${p[key]}</div>
            </div>`;
        }).join('');
    }
    
    if (note) {
        if (hasTies) {
            note.textContent = `Note: Some parks share the same score (Tied).`;
            note.style.display = "block";
        } else {
            note.style.display = "none";
        }
    }

    if(overlay) overlay.style.display = 'block';
    if(modal) modal.style.display = 'block';
}

function closeTieModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('tie-modal');
    if(overlay) overlay.style.display = 'none';
    if(modal) modal.style.display = 'none';
}

// Helper function to focus on a park from modal
function focusOnPark(parkNameLower) {
    map.flyTo(parkMarkers[parkNameLower].getLatLng(), 16);
    parkMarkers[parkNameLower].openPopup();
    closeTieModal();
}

// --- UPDATED applyRanking with distinct colors ---
function applyRanking() {
    let type = document.getElementById("rank-type").value;
    let numInput = document.getElementById("rank-number").value;
    let num = parseInt(numInput);
    
    // VALIDATION
    if (!type) { return showSelectRankModal(); }
    
    // --- CHANGED: Clear export data if input is invalid (e.g. 0) ---
    if (!numInput || num < 1 || isNaN(num)) { 
        window.currentExportData = []; // Clear data so Export button shows "No Data"
        return showEnterRankNumModal(); 
    }

    // CLEAR PREVIOUS RESULTS FROM OTHER FUNCTIONS
    resetMarkers(); 
    closeNearbyModal();
    
    // Clear user marker and search circle from nearby search
    if(userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
    }
    if(searchCircle) {
        map.removeLayer(searchCircle);
        searchCircle = null;
    }
    
    showLoader(true);

    setTimeout(() => {
        let field = type.split('_')[0]; 
        let order = type.split('_')[1]; 
        let dataKey = field === 'quantity' ? 'quantity_variety' : field;
        
        let valid = parks.filter(p => p[dataKey] !== null && !isNaN(Number(p[dataKey])));
        valid.sort((a,b) => order === 'highest' ? b[dataKey] - a[dataKey] : a[dataKey] - b[dataKey]);
        
        // Parallel Entry Logic (Ties)
        let topResults = [];
        if (valid.length <= num) {
            topResults = valid;
        } else {
            const cutoffVal = valid[num-1][dataKey];
            topResults = valid.filter(p => {
                if (order === 'highest') return p[dataKey] >= cutoffVal;
                else return p[dataKey] <= cutoffVal;
            });
        }

        // --- UPDATE EXPORT DATA TO FILTERED RESULTS ---
        window.currentExportData = topResults;

        if (topResults.length === 0) { 
            showLoader(false); 
            resetMarkers(); 
            return showToast("No data."); 
        }

        // Rank Calculation
        let currentRank = 1;
        topResults.forEach((p, index) => {
            if (index > 0 && p[dataKey] !== topResults[index-1][dataKey]) {
                currentRank = index + 1;
            }
            p.displayRank = currentRank;
        });

        // Map Bounds
        let bounds = L.latLngBounds();
        topResults.forEach(p => bounds.extend([p.lat, p.lon]));
        map.fitBounds(bounds, { paddingTopLeft: [450, 100], paddingBottomRight: [100, 100], maxZoom: 13 });

        showTieModal(topResults, dataKey);

        let delay = 0;
        topResults.forEach((p, idx) => {
            let m = parkMarkers[p.name.toLowerCase()];
            if(m) {
                let t = setTimeout(() => {
                    // Use displayRank - 1 for color index (distinct colors)
                    let colorIndex = (p.displayRank - 1);
                    
                    // Fallback to modulo if exceeding color palette
                    if (colorIndex >= rankColorMap.length) {
                        colorIndex = colorIndex % rankColorMap.length;
                    }
                    
                    let colorKey = rankColorMap[colorIndex];
                    let hexColor = rankHexMap[colorKey];
                    let isLightColor = (colorKey === 'yellow' || colorKey === 'lime' || colorKey === 'cyan');
                    
                    m.setIcon(icons[colorKey]); 
                    m.setZIndexOffset(10000 - idx); 
                    
                    let tooltipDir = 'top';
                    let tooltipOff = [0, -35];

                    m.unbindTooltip();
                    m.bindTooltip(`#${p.displayRank}`, { 
                        permanent: true, 
                        direction: tooltipDir, 
                        className: `rank-tooltip rank-tooltip-${colorKey}`, 
                        offset: tooltipOff 
                    });
                    
                    let styleId = `style-tooltip-${colorKey}`;
                    if (!document.getElementById(styleId)) {
                        let style = document.createElement('style');
                        style.id = styleId;
                        style.innerHTML = `
                            .rank-tooltip-${colorKey} { 
                                background-color: ${hexColor} !important; 
                                color: ${isLightColor ? 'black' : 'white'} !important; 
                                border: 1px solid white; 
                            }
                            .rank-tooltip-${colorKey}:before { 
                                border-top-color: ${hexColor} !important; 
                            }
                        `;
                        document.head.appendChild(style);
                    }

                    let badge = `<div class="badge" style="background:${hexColor}; color:${isLightColor ? 'black' : 'white'}; padding:5px 10px; border-radius:4px; font-weight:bold;">Rank #${p.displayRank} (Score: ${p[dataKey]})</div>`;
                    
                    m.unbindPopup();
                    m.bindPopup(createPopupContent(p, badge), {
                        maxWidth: 350,
                        minWidth: 350,
                        autoPanPaddingTopLeft: [400, 20],
                        autoPanPaddingBottomRight: [20, 20],
                        autoClose: false,
                        closeOnClick: false
                    });

                    m.addTo(map);

                }, delay);
                animationTimeouts.push(t);
                delay += 250; 
            }
        });
        
        showLoader(false);
    }, 400);
}