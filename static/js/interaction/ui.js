/**
 * ui.js
 * ------------------------------------------------------------------
 * General UI Utilities for Interaction Search Map.
 * This module handles general interface behaviors, modal management, and data export.
 * * Key Functionality:
 * - Dynamic Form Elements: Populates the facility checklist based on server data.
 * - Global Reset: 'clearAllInputs' function to reset form state, map markers, and global variables.
 * - Notifications: Toast messages and loading spinner toggles.
 * - Modal Management: Logic to show/hide ranking ties, nearby search results, and export warnings.
 * - Data Export: Generates and downloads a CSV file of the current dataset (filtered or full).
 * - UI Components: Accordion toggles for the sidebar menu.
 * ------------------------------------------------------------------
 */


// --- FACILITY CHECKLIST INITIALIZATION ---
const checklistContainer = document.getElementById('facility-checklist');
if (typeof facilities !== 'undefined' && facilities.length > 0) {
    facilities.forEach(fac => {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        div.innerHTML = `<input type="checkbox" value="${fac.name}"> <span>${fac.name}</span>`;
        checklistContainer.appendChild(div);
    });
} else { 
    checklistContainer.innerHTML = '<div style="padding:10px; color:red;">No facilities loaded</div>'; 
}

// --- UTILITY FUNCTIONS ---

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function showLoader(show) { 
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none'; 
}

function clearAllInputs() {
    // 1. Text Inputs
    document.getElementById('search-box').value = '';
    document.getElementById('postcode-input').value = '';
    document.getElementById('distance-input').value = '5.0';
    document.getElementById('rank-number').value = '';

    // 2. Selects
    document.getElementById('rank-type').selectedIndex = 0;

    // 3. Checkboxes
    document.querySelectorAll('#facility-checklist input[type="checkbox"]').forEach(cb => cb.checked = false);

    // 4. Toggle Button State (Reset to Distance mode)
    if (typeof setSearchMode === 'function') {
        setSearchMode(false);
    }

    // 5. Suggestions
    document.getElementById('suggestions').style.display = 'none';

    // 6. Map Reset
    if (typeof resetMarkers === 'function') resetMarkers();
    
    // --- RESET EXPORT DATA TO ALL PARKS ---
    if (typeof parks !== 'undefined') {
        window.currentExportData = parks;
    }
    
    // Globals from map.js/config.js
    if(userMarker && map) { map.removeLayer(userMarker); userMarker = null; }
    if(searchCircle && map) { map.removeLayer(searchCircle); searchCircle = null; }
    if(map) map.setView([defaultLat, defaultLon], defaultZoom);
    
    // 7. Close Modals/Popups
    if(map) map.closePopup();
    closeTieModal();
    closeNearbyModal();
    closeNoExportDataModal(); // Ensure this new modal is also closed

    showToast("All inputs cleared and map reset.");
}

function toggleAccordion(header, bodyId) {
    document.querySelectorAll('.accordion-body').forEach(b => b.classList.remove('open'));
    document.querySelectorAll('.accordion-header').forEach(h => h.classList.remove('active'));
    const body = document.getElementById(bodyId);
    if (body.style.display === 'block') { 
        body.style.display = 'none'; 
    } else { 
        document.querySelectorAll('.accordion-body').forEach(b => b.style.display = 'none'); 
        body.style.display = 'block'; 
        header.classList.add('active'); 
    }
}

// --- RANKING MODAL FUNCTIONS ---
function showTieModal(results, dataKey) {
    const modal = document.getElementById('tie-modal');
    const overlay = document.getElementById('modal-overlay');
    const list = document.getElementById('tie-list-content');
    const noteContainer = document.getElementById('tie-modal-note');
    
    let hasTies = false;
    for (let i = 1; i < results.length; i++) {
        if (results[i].displayRank === results[i-1].displayRank) {
            hasTies = true;
            break;
        }
    }

    if (hasTies) {
        noteContainer.style.display = 'block';
        noteContainer.innerText = "* Note: There are ties in the ranking.";
    } else {
        noteContainer.style.display = 'none';
    }
    
    list.innerHTML = "";
    results.forEach(p => {
        let colorKey = rankColorMap[(p.displayRank - 1) % rankColorMap.length];
        let hexColor = rankHexMap[colorKey];
        
        let item = document.createElement('div');
        item.className = 'tie-item';
        item.innerHTML = `
            <span><span style="color:${hexColor}; font-weight:bold; font-size:1.1em;">#${p.displayRank}</span> ${p.name}</span>
            <span style="font-weight:bold; color:#555;">${p[dataKey]}</span>
        `;
        item.onclick = () => {
            map.flyTo([p.lat, p.lon], 16);
            let m = parkMarkers[p.name.toLowerCase()];
            if(m) m.openPopup();
            closeTieModal();
        };
        item.style.cursor = 'pointer';
        list.appendChild(item);
    });
    
    modal.style.display = 'block';
    overlay.style.display = 'block';
}

function closeTieModal() {
    document.getElementById('tie-modal').style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
}

// --- NEARBY PARKS MODAL FUNCTIONS ---
function showNearbyModal(results) {
    const modal = document.getElementById('nearby-modal');
    const overlay = document.getElementById('modal-overlay');
    const list = document.getElementById('nearby-list-content');

    list.innerHTML = "";
    
    results.forEach((p, index) => {
        let item = document.createElement('div');
        item.className = 'tie-item';
        item.innerHTML = `
            <span><span style="color:var(--primary-color); font-weight:bold;">${index + 1}.</span> ${p.name}</span>
            <span style="font-weight:bold; color:#555;">${p.distance.toFixed(2)} km</span>
        `;
        item.onclick = () => {
            closeNearbyModal();
            const fullPark = parks.find(park => String(park.site_id) === String(p.site_id));
            if(fullPark) {
                map.flyTo([fullPark.lat, fullPark.lon], 16);
                const m = parkMarkers[fullPark.name.toLowerCase()];
                if(m) m.openPopup();
            }
        };
        item.style.cursor = 'pointer';
        list.appendChild(item);
    });

    modal.style.display = 'block';
    overlay.style.display = 'block';
}

function closeNearbyModal() {
    document.getElementById('nearby-modal').style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
}

// --- NEW MODAL LOGIC FOR EXPORT (ADDED) ---
function showNoExportDataModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('no-export-data-modal');
    if(overlay) overlay.style.display = 'block';
    if(modal) modal.style.display = 'block';
}

function closeNoExportDataModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('no-export-data-modal');
    if(overlay) overlay.style.display = 'none';
    if(modal) modal.style.display = 'none';
}

// --- NEW EXPORT FUNCTION ---
function exportParksToCSV() {
    // Determine data to export (default to all if not set)
    let exportData = (typeof window.currentExportData !== 'undefined') ? window.currentExportData : parks;

    // Check if we have data to export
    if (!exportData || exportData.length === 0) {
        // CHANGED: Call the central modal instead of the toast
        showNoExportDataModal();
        return;
    }

    // 1. Prepare Data Logic
    const fullData = exportData.map(item => {
        const fullPark = parks.find(p => String(p.site_id) === String(item.site_id));
        return fullPark || item; 
    });

    // 2. Define CSV Headers
    const headers = [
        "Site ID", "Park Name", "Postcode", "Council Area", "Rec Score", 
        "Quality", "Safety", "Accessibility", "Quantity/Variety", 
        "Latitude", "Longitude"
    ];
    
    // 3. Map data to rows
    const rows = fullData.map(p => [
        p.site_id,
        `"${(p.name || "").replace(/"/g, '""')}"`, // Handle quotes
        p.postcode || "",
        `"${(p.community || "")}"`,
        p.recreation || "",
        p.quality || "",
        p.safety || "",
        p.accessibility || "",
        p.quantity_variety || "",
        p.lat,
        p.lon
    ]);

    // 4. Combine headers and rows
    const csvContent = [
        headers.join(","),
        ...rows.map(r => r.join(","))
    ].join("\n");

    // 5. Create Download Link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "edinburgh_parks_export.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Optional: Confirm export started
    showToast("Exporting data...");
}