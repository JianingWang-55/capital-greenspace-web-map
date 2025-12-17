/**
 * config.js
 * ------------------------------------------------------------------
 * Configuration settings and global state for the Interactive Search Map module.
 * This file defines:
 * - Default map view settings (coordinates, zoom).
 * - Color palettes (Arrays and Hex maps) for ranking visualization.
 * - Leaflet marker icon definitions mapped to specific colors.
 * - Global state variables shared across other modules (markers, user location, etc.).
 * ------------------------------------------------------------------
 */

// Map Configuration
const defaultLat = 55.95;
const defaultLon = -3.2;
const defaultZoom = 11;

// Colors & Icons - EXPANDED TO 20 COLORS
const rankColorMap = [
    'gold', 'orange', 'red', 'violet', 'blue', 'green', 'yellow', 'grey',
    'purple', 'pink', 'brown', 'teal', 'lime', 'indigo', 'coral', 'navy',
    'maroon', 'olive', 'cyan', 'magenta'
];

const rankHexMap = {
    'gold': '#FFD326', 
    'orange': '#CB8427', 
    'red': '#982E40', 
    'violet': '#9C2BCB',
    'blue': '#2A81CB', 
    'green': '#2AAD27', 
    'yellow': '#CAC428', 
    'grey': '#7B7B7B', 
    'black': '#3D3D3D',
    // NEW COLORS FOR RANKS 9-20
    'purple': '#6A0DAD',
    'pink': '#FF69B4',
    'brown': '#8B4513',
    'teal': '#008080',
    'lime': '#32CD32',
    'indigo': '#4B0082',
    'coral': '#FF7F50',
    'navy': '#000080',
    'maroon': '#800000',
    'olive': '#808000',
    'cyan': '#00FFFF',
    'magenta': '#FF00FF'
};

const icons = {
    // ORIGINAL 9 ICONS
    black: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-black.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    gold: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    orange: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    red: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    violet: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    blue: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    green: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    yellow: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    grey: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    
    // NEW ICONS FOR RANKS 9-20 (mapped to closest available marker colors)
    purple: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    pink: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    brown: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    teal: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    lime: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    indigo: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    coral: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    navy: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    maroon: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    olive: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    cyan: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }),
    magenta: new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] })
};

// Global State
let parkMarkers = {};
let userMarker = null;
let searchCircle = null;
let nearestMode = false;
let currentImageIndex = {};
let animationTimeouts = [];