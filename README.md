# Capital Green Space Project – Group 4 – Recreation

A Flask-based web application for analysing, visualising, and navigating greenspaces in Edinburgh.  
This project integrates network data, deprivation indices (SIMD), and Oracle Database analysis
into an interactive dashboard, with a **specific focus on recreational facilities and access to recreation**.

---

## Table of Contents
- [Overview](#-overview)
- [Project Structure](#-project-structure)
- [Tech Stack](#-tech-stack)
- [Data Sources](#-data-sources)
- [AI Acknowledgement](#-acknowledgements)

---

## Project Structure

```text
web_map/
├── myflaskapp.py               # Main Flask Application Controller
├── templates/                  # HTML Views (Jinja2)
│   ├── cover.html              # Landing Page with Stitch Effect
│   ├── index.html              # Main Dashboard Hub
│   ├── interaction_map.html    # Facility Search Map
│   ├── simd_map.html           # Deprivation Layer Map
│   ├── network_analysis.html   # Transport Analysis Map
│   └── user_guide.html         # Documentation Page
├── static/
│   ├── css/                    # Stylesheets
│   │   ├── interaction_map.css
│   │   ├── network_analysis.css
│   │   ├── simd_map.css
│   │   ├── user_guide.css
│   ├── js/                     # Client-side Logic
│   │   ├── interaction/        # Modular JS for Interaction Map
│   │   │   ├── main.js
│   │   │   ├── map.js
│   │   │   ├── config.js
│   │   │   ├── nearby.js
│   │   │   ├── popup.js
│   │   │   ├── ranking.js
│   │   │   ├── search_name.js
│   │   │   ├── ui.js
│   │   ├── network_analysis.js # Transport Logic
│   │   └── simd_map.js         # SIMD Logic
│   ├── images/                 # Park Images
│   ├── barchart/               # Score Bar Charts
│   ├── cover/                  # Park Images for Cover Page
│   ├── support_scripts/        # Python Data Processing Scripts
│   │   ├── convert_drivedata.py
│   │   ├── convert_polygons.py
│   │   ├── generate_barchart.py
│   │   ├── generate_points.py
│   │   ├── process_5min_spatial_join.py
│   │   └── process_bus_cycle_data.py
├── areas_joined.geojson
├── drive_areas.geojson
├── parks_centroids_joined.geojson
├── transport_5min_joined.geojson
├── parks_with_transport.geojson
├── simd_edinburgh.geojson
├── simd_edinburgh_cleaned.geojson
└── README.md
```

---

## Tech Stack

### Backend
- Flask (Python)
- Oracle SQL (relational database with analytical views)

### Frontend
- HTML5 / CSS3
- JavaScript (ES6)
- Leaflet.js
- OpenStreetMap basemaps

### Network Analysis
- GeoJSON-based spatial datasets
- Walking and driving network catchments
- Public transport and cycling infrastructure analysis

---

## Data Resources

### National Public Transport Access Nodes (NaPTAN)
UK Department for Transport  
https://beta-naptan.dft.gov.uk/  
**Date Accessed:** 02/12/2025

### Cycle Parking – Edinburgh Area
City of Edinburgh Council Open Spatial Data Portal  
**Date Accessed:** 02/12/2025

### Road Network Dataset
University of Edinburgh GeoSciences Network Resource  
\\groups.geos.ed.ac.uk\netdata\sma\gs\project\EDB_Datasets\MMap_Roads_EDB\
ed_mmap_transpt_mar19

---

## AI Acknowledgement

We acknowledge the use of the **ELM** (University of Edinburgh, Edina,
https://elm.edina.ac.uk/elm/elm) AI tool to assist in brainstorming ideas and for improving the clarity of writing and coding.
