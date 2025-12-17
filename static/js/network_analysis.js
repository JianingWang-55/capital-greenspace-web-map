/**
 * network_analysis.js
 * ------------------------------------------------------------------
 * Network Analysis Map Logic.
 * * Key Functionality:
 * - Data Management: Fetches and caches GeoJSON data for points, walking zones, driving zones, and bus routes.
 * - Layer Switching: Toggles between different transport modes (Walk, Drive, Bus/Bike) dynamically.
 * - Visual Styling: Applies chloropleth-style coloring for isochrones and distinct markers for transport nodes.
 * - Interactivity: Handles dropdown filtering, auto-zooming to selected parks, and custom legend generation.
 * - Data Export: Flattens complex nested GeoJSON data (like bus stops inside polygons) into exportable files for GIS software.
 * ------------------------------------------------------------------
 */

// 1. Initialization
var initialZoomLevel = 12;
var map = L.map('map', { center: [55.9533, -3.1883], zoom: initialZoomLevel, doubleClickZoom: false });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

// Custom Panes (Z-Index ensures dots appear above polygons)
map.createPane('polygonsPane'); map.getPane('polygonsPane').style.zIndex = 400;
map.createPane('busStopsPane'); map.getPane('busStopsPane').style.zIndex = 500; // Lower than centroids
map.createPane('cycleStopsPane'); map.getPane('cycleStopsPane').style.zIndex = 510; 
map.createPane('pointsPane'); map.getPane('pointsPane').style.zIndex = 800;     // Highest (On Top)

// 2. Data Store
var currentMode = null; 
var currentLegend = null;

var dataStore = {
    points: null,
    walkAreas: null,
    driveAreas: null,
    busData: null
};

// Layer Groups
var layers = {
    areas: L.layerGroup().addTo(map),      
    points: L.layerGroup().addTo(map),     
    busPolygons: L.layerGroup().addTo(map),
    busStops: L.layerGroup().addTo(map),   
    cycleStops: L.layerGroup().addTo(map)
};

// 3. Load Data with Cache Busting
var timestamp = new Date().getTime();

if (typeof DATA_URLS !== 'undefined') {
    Promise.all([
        fetch(DATA_URLS.points + "?v=" + timestamp).then(r => r.json()),
        fetch(DATA_URLS.walk + "?v=" + timestamp).then(r => r.json()),
        fetch(DATA_URLS.drive + "?v=" + timestamp).then(r => r.json()),
        fetch(DATA_URLS.bus + "?v=" + timestamp).then(r => r.json()) 
    ]).then(([points, walk, drive, bus]) => {
        dataStore.points = points;
        dataStore.walkAreas = walk;
        dataStore.driveAreas = drive;
        dataStore.busData = bus;
        console.log("All data loaded successfully.");
    }).catch(err => console.error("Error loading data:", err));
}

// 4. Style Functions
function getWalkColor(val) { return val > 10 ? '#E31A1C' : val > 5 ? '#FD8D3C' : '#228B22'; }
function getDriveColor(val) { return val > 1 ? '#00008B' : '#87CEEB'; }

function styleAreas(feature) {
    var val = feature.properties.ToBreak || feature.properties.break || 0; 
    var color = (currentMode === 'walk') ? getWalkColor(val) : getDriveColor(val);
    return { fillColor: color, weight: 1, opacity: 1, color: 'white', dashArray: '3', fillOpacity: 0.5 };
}

function styleBusPark(feature) {
    return { 
        fillColor: '#E6E6FA', // Lavender
        weight: 2, 
        opacity: 1, 
        color: '#9370DB', // Medium Purple
        fillOpacity: 0.5, 
        pane: 'polygonsPane'
    };
}

// 5. Switching Logic
function switchLayer(mode) {
    var btnMap = { 'walk': 'walkBtn', 'drive': 'driveBtn', 'bus': 'busBtn' };
    var activeClassMap = { 'walk': 'active-walk', 'drive': 'active-drive', 'bus': 'active-bus' };
    var filterPanel = document.getElementById('filterPanel');
    
    // Toggle Off
    if (currentMode === mode) {
        document.getElementById(btnMap[mode]).classList.remove(activeClassMap[mode]);
        currentMode = null;
        clearAllLayers();
        if(currentLegend) map.removeControl(currentLegend);
        filterPanel.style.display = 'none'; 
        map.setView([55.9533, -3.1883], initialZoomLevel);
        map.closePopup();
        return;
    }

    // Switch Mode
    if (currentMode) {
        document.getElementById(btnMap[currentMode]).classList.remove(activeClassMap[currentMode]);
    }
    currentMode = mode;
    document.getElementById(btnMap[mode]).classList.add(activeClassMap[mode]);
    
    filterPanel.style.display = 'block'; 
    document.getElementById("parkDropdown").value = "all";
    map.setView([55.9533, -3.1883], initialZoomLevel);
    map.closePopup();

    renderLayers();
    updateLegend();
}

function clearAllLayers() {
    layers.areas.clearLayers();
    layers.points.clearLayers();
    layers.busPolygons.clearLayers();
    layers.busStops.clearLayers();
    layers.cycleStops.clearLayers();
}

// === MAIN RENDERING FUNCTION ===
function renderLayers(pointsData, areasData, busData) {
    clearAllLayers(); 

    // Determine if we are in "Zoomed/Selected" mode or "Overview" mode
    var selectedId = document.getElementById("parkDropdown").value;
    var isZoomed = (selectedId !== "all");

    // Dynamic Sizing Logic
    var centroidRadius = isZoomed ? 8 : 6;
    var transportRadius = isZoomed ? 6 : 2; 

    if (currentMode === 'bus') {
        // --- BUS MODE ---
        var bData = busData || dataStore.busData;
        if (bData) {
            L.geoJSON(bData, {
                style: styleBusPark,
                pane: 'polygonsPane',
                onEachFeature: function(feature, layer) {
                    
                    // Add stops with dynamic radius
                    addStopsForFeature(feature.properties, transportRadius);

                    // Polygon click: NO ZOOM, just block propagation
                    layer.on('click', function(e) {
                        L.DomEvent.stopPropagation(e);
                    });
                }
            }).addTo(layers.busPolygons);
        }
        
        // Centroids
        var pData = pointsData || dataStore.points;
        if (pData) {
            L.geoJSON(pData, {
                pane: 'pointsPane',
                pointToLayer: function(feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: centroidRadius, 
                        fillColor: '#FF1493', 
                        color: "#fff", 
                        weight: 2, 
                        opacity: 1, 
                        fillOpacity: 1, 
                        pane: 'pointsPane'
                    });
                },
                onEachFeature: function(feature, layer) {
                    var p = feature.properties;
                    
                    var btnColor = '#FF1493'; 
                    var galleryBtn = p.gallery_url ? `<a href="${p.gallery_url}" target="_blank" class="gallery-button" style="background:${btnColor}">View Gallery</a>` : '';
                    var content = `
                        <div class="park-popup">
                            <h3>${p.site_name || p.name}</h3>
                            <div class="info-row"><b>Site ID:</b> ${p.site_id}</div>
                            <div class="info-row"><b>Recreation Index:</b> ${p.recreation_score || 'N/A'}</div>
                            <div class="info-row"><b>SIMD Decile:</b> ${p.simd_decile || 'N/A'}</div>
                            <div class="info-row"><b>Postcode:</b> ${p.postcode || 'N/A'}</div>
                            ${galleryBtn}
                        </div>`;
                    layer.bindPopup(content);

                    layer.on('click', function(e) {
                        L.DomEvent.stopPropagation(e);
                        this.openPopup();
                    });
                }
            }).addTo(layers.points);
        }

    } else {
        // --- WALK/DRIVE MODE ---
        var pData = pointsData || dataStore.points;
        var aData = areasData || ((currentMode === 'walk') ? dataStore.walkAreas : dataStore.driveAreas);
        
        if (aData) L.geoJSON(aData, { style: styleAreas }).addTo(layers.areas);
        if (pData) {
            L.geoJSON(pData, {
                pane: 'pointsPane',
                pointToLayer: function(feature, latlng) {
                    var color = (currentMode === 'walk') ? '#228B22' : '#00008B';
                    return L.circleMarker(latlng, {
                        radius: 8, fillColor: color, color: "#fff", weight: 2, opacity: 1, fillOpacity: 0.9, pane: 'pointsPane'
                    });
                },
                onEachFeature: setupPointInteraction
            }).addTo(layers.points);
        }
    }
}

// Helper function to append markers with dynamic radius
function addStopsForFeature(props, radius) {
    if (props.bus_stops && props.bus_stops.length > 0) {
        props.bus_stops.forEach(stop => {
            var marker = L.circleMarker([stop.lat, stop.lon], {
                radius: radius, 
                fillColor: '#800080', // Purple
                color: '#fff', 
                weight: 1, 
                opacity: 1, 
                fillOpacity: 1, 
                pane: 'busStopsPane'
            });
            marker.bindPopup(`<b>Bus Stop</b><br>${stop.name}`);
            marker.addTo(layers.busStops);
        });
    }

    if (props.cycle_parks && props.cycle_parks.length > 0) {
        props.cycle_parks.forEach(spot => {
            var marker = L.circleMarker([spot.lat, spot.lon], {
                radius: radius, 
                fillColor: '#007BFF', // Blue
                color: '#fff', 
                weight: 1, 
                opacity: 1, 
                fillOpacity: 1, 
                pane: 'cycleStopsPane'
            });
            marker.bindPopup(`<b>Bike Parking</b><br>Capacity: ${spot.capacity || '?'}`);
            marker.addTo(layers.cycleStops);
        });
    }
}

function setupPointInteraction(feature, layer) {
    var p = feature.properties;
    var btnColor = (currentMode === 'walk') ? '#28a745' : '#00008B';
    var galleryBtn = p.gallery_url ? `<a href="${p.gallery_url}" target="_blank" class="gallery-button" style="background:${btnColor}">View Gallery</a>` : '';
    var content = `<div class="park-popup"><h3>${p.site_name || p.name}</h3><div class="info-row"><b>Site ID:</b> ${p.site_id}</div><div class="info-row"><b>Recreation Index:</b> ${p.recreation_score || 'N/A'}</div><div class="info-row"><b>SIMD Decile:</b> ${p.simd_decile || 'N/A'}</div><div class="info-row"><b>Postcode:</b> ${p.postcode || 'N/A'}</div>${galleryBtn}</div>`;
    layer.bindPopup(content);
    layer.on({
        mouseover: function() { this.setStyle({color: '#ffff00', weight: 3}); },
        mouseout: function() { this.setStyle({color: '#ffffff', weight: 2}); },
        click: function(e) { 
            L.DomEvent.stopPropagation(e); 
            this.openPopup(); 
        },
        dblclick: function(e) { L.DomEvent.stopPropagation(e); }
    });
}

// Triggered ONLY by Dropdown
function focusOnPark(shouldZoom = true) {
    var selectedId = document.getElementById("parkDropdown").value;
    
    if (selectedId === "all") {
        renderLayers(); 
        map.setView([55.9533, -3.1883], initialZoomLevel);
        map.closePopup();
        return;
    }

    var filteredPoints = null;
    var filteredAreas = null;
    var filteredBusData = null;

    if (dataStore.points) {
        var pFeatures = dataStore.points.features.filter(f => f.properties.site_id == selectedId);
        filteredPoints = { type: "FeatureCollection", features: pFeatures };
    }

    if (currentMode === 'bus') {
        if (dataStore.busData) {
            var bFeatures = dataStore.busData.features.filter(f => f.properties.site_id == selectedId);
            filteredBusData = { type: "FeatureCollection", features: bFeatures };
        }
    } else {
        var activeAreaData = (currentMode === 'walk') ? dataStore.walkAreas : dataStore.driveAreas;
        if (activeAreaData) {
            var aFeatures = activeAreaData.features.filter(f => 
                f.properties.site_id == selectedId || f.properties.db_site_id == selectedId || f.properties.Park_ID == selectedId
            );
            filteredAreas = { type: "FeatureCollection", features: aFeatures };
        }
    }

    renderLayers(filteredPoints, filteredAreas, filteredBusData);

    var zoomTarget = (currentMode === 'bus') ? filteredBusData : filteredAreas;
    
    // Zoom Logic
    if (shouldZoom) {
        if (zoomTarget && zoomTarget.features.length > 0) {
            var tempLayer = L.geoJSON(zoomTarget);
            map.fitBounds(tempLayer.getBounds(), {padding: [50, 50]});
        } else if (filteredPoints && filteredPoints.features.length > 0) {
            var coords = filteredPoints.features[0].geometry.coordinates;
            map.setView([coords[1], coords[0]], 15);
        }
    }
    
    layers.points.eachLayer(function(layer) {
        layer.openPopup();
    });
}

function resetMap() {
    document.getElementById("parkDropdown").value = "all";
    focusOnPark();
}

function updateLegend() {
    if (currentLegend) map.removeControl(currentLegend);
    currentLegend = L.control({position: 'bottomright'});
    currentLegend.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'legend');
        
        // --- WALK LEGEND ---
        if (currentMode === 'walk') {
            div.innerHTML += '<b>Walking Time (min)</b><br>';
            div.innerHTML += `<i style="background:#228B22; border-radius:50%; width:8px; height:8px; display:inline-block; margin-top:5px;"></i> Park Centroid<br>`;
            var grades = [0, 5, 10]; var labels = ["0-5", "5-10", "10-15"];
            for (var i = 0; i < grades.length; i++) div.innerHTML += `<i style="background:${getWalkColor(grades[i] + 1)}"></i> ${labels[i]}<br>`;
        } 
        
        // --- DRIVE LEGEND ---
        else if (currentMode === 'drive') {
            div.innerHTML += '<b>Drive Distance (km)</b><br>';
            div.innerHTML += `<i style="background:#00008B; border-radius:50%; width:8px; height:8px; display:inline-block; margin-top:5px;"></i> Park Centroid<br>`;
            div.innerHTML += `<i style="background:#87CEEB"></i> 0 - 1<br><i style="background:#00008B"></i> 1 - 2<br>`;
        } 
        
        // --- BUS LEGEND ---
        else if (currentMode === 'bus') {
            div.innerHTML += '<b>Connectivity (5min)</b><br>';
            div.innerHTML += `<i style="background:#FF1493; border-radius:50%; width:8px; height:8px; display:inline-block; margin-top:5px;"></i> Park Centroid<br>`;
            div.innerHTML += `<i style="background:#800080; border-radius:50%; width:8px; height:8px; display:inline-block; margin-top:5px;"></i> Bus Stop<br>`;
            div.innerHTML += `<i style="background:#007BFF; border-radius:50%; width:8px; height:8px; display:inline-block; margin-top:5px;"></i> Bike Parking<br>`;
            div.innerHTML += `<i style="background:#E6E6FA; border:1px solid #9370DB"></i> 5min Walking Isochrone<br>`;
        }
        return div;
    };
    currentLegend.addTo(map);
}

// ==========================================
// EXPORT FUNCTION (Final Version with all Fixes)
// ==========================================
function exportCurrentView() {
    var selectedId = document.getElementById("parkDropdown").value;
    var currentData = null;
    var filename = "network_analysis";

    // 1. Select Source Data based on Active Mode
    if (currentMode === 'bus') {
        currentData = dataStore.busData;
        filename = "bus_and_bike_connectivity"; 
    } else if (currentMode === 'walk') {
        currentData = dataStore.walkAreas;
        filename = "walking_isochrones";
    } else if (currentMode === 'drive') {
        currentData = dataStore.driveAreas;
        filename = "drive_distance";
    } else {
        // If no mode selected, export the Park Centroids (points)
        currentData = dataStore.points;
        filename = "park_centroids";
    }

    if (!currentData) {
        alert("No data available to export. Please wait for data to load.");
        return;
    }

    // 2. Filter data if a specific park is selected
    var filteredFeatures = currentData.features;
    if (selectedId !== "all") {
        filteredFeatures = currentData.features.filter(function(f) {
            return f.properties.site_id == selectedId || 
                   f.properties.db_site_id == selectedId || 
                   f.properties.Park_ID == selectedId;
        });

        if (filteredFeatures.length === 0) {
            alert("No data found for this park.");
            return;
        }
        filename += "_park_" + selectedId;
    } else {
        filename += "_full_dataset";
    }

    // 3. FLATTEN DATA: Explode Points for GIS Software
    var exportFeatures = [];

    if (currentMode === 'bus') {
        filteredFeatures.forEach(function(feature) {
            // A. Add the Polygon (The 5min Zone)
            exportFeatures.push(feature);

            // B. Extract Bus Stops as separate Points
            if (feature.properties.bus_stops) {
                feature.properties.bus_stops.forEach(function(stop) {
                    exportFeatures.push({
                        "type": "Feature",
                        "geometry": { 
                            "type": "Point", 
                            "coordinates": [stop.lon, stop.lat] 
                        },
                        "properties": {
                            "Type": "Bus Stop",
                            "Name": stop.name,
                            "Parent_Park": feature.properties.name,
                            "Parent_Site_ID": feature.properties.site_id
                        }
                    });
                });
            }

            // C. Extract Bike Parks as separate Points
            if (feature.properties.cycle_parks) {
                feature.properties.cycle_parks.forEach(function(bike) {
                    exportFeatures.push({
                        "type": "Feature",
                        "geometry": { 
                            "type": "Point", 
                            "coordinates": [bike.lon, bike.lat] 
                        },
                        "properties": {
                            "Type": "Cycle Park",
                            "Capacity": bike.capacity,
                            "Parent_Park": feature.properties.name,
                            "Parent_Site_ID": feature.properties.site_id
                        }
                    });
                });
            }
        });
    } else {
        // For Walk/Drive layers, populate using spread syntax to act as a copy
        exportFeatures = [...filteredFeatures];
    }

    // 4. ADD PARK CENTROIDS (Updated Requirement)
    // Only insert park centroids if we aren't ALREADY exporting the centroids dataset (currentMode != null)
    if (currentMode !== null && dataStore.points) {
        if (selectedId !== "all") {
            // Case A: Specific Park Selected -> Add ONLY that park's point
            var parkPoint = dataStore.points.features.find(function(f) {
                return f.properties.site_id == selectedId;
            });
            if (parkPoint) {
                exportFeatures.push(parkPoint);
            }
        } else {
            // Case B: "All Parks" Selected -> Add ALL park points
            dataStore.points.features.forEach(function(f) {
                exportFeatures.push(f);
            });
        }
    }

    var finalGeoJSON = {
        "type": "FeatureCollection",
        "features": exportFeatures
    };

    // 5. Trigger Download
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(finalGeoJSON));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename + ".geojson");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}