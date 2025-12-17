"""
process_5min_spatial_join.py

Purpose
-------
Create a single GeoJSON layer for the "Bus & Bike Connect" view by spatially joining:
- 5-minute walking isochrone polygons (per park) with
- bus stop points and cycle parking points that fall inside each polygon.

This script is designed for offline preprocessing so the web application can load
a ready-to-use GeoJSON file that already contains the matched transport points in
each park polygon's attributes.

What this script does
---------------------
1) Loads input datasets (ESRI JSON exports):
   - `5_mins.json`            : polygon service areas (British National Grid, EPSG:27700)
   - `bus_5min.json`          : bus stop points (already includes Longitude/Latitude)
   - `5min_cycle.json`        : cycle parking points (British National Grid, EPSG:27700)

2) Converts coordinates:
   - Polygons and cycle parking points are transformed from EPSG:27700 to EPSG:4326
     (WGS84 lon/lat) using `pyproj.Transformer`.
   - Bus stops use their provided Longitude/Latitude values directly.

3) Performs a spatial join for each park polygon:
   - Uses a fast bounding-box (BBox) pre-check to reduce computations.
   - Uses a ray-casting point-in-polygon test (outer ring) to decide containment.
   - Collects matching bus stops and cycle parking points.

4) Writes output:
   - Saves a GeoJSON FeatureCollection to `transport_5min_joined.geojson`, where each
     polygon feature includes:
       - site_id (mapped from FacilityID)
       - name (park name from attributes)
       - bus_stops (list of matched bus stop objects)
       - cycle_parks (list of matched cycle parking objects)

Inputs / Outputs
----------------
Input files (expected in the same folder as this script):
- 5_mins.json
- bus_5min.json
- 5min_cycle.json

Output file:
- transport_5min_joined.geojson

Notes / Assumptions
-------------------
- `FACILITY_TO_SITE_ID` is a project-specific lookup mapping ESRI FacilityID values
  to Oracle database `site_id` values.
- The point-in-polygon test uses only the first (outer) ring and does not account
  for holes (inner rings). For typical service-area polygons this is usually fine.
- The bounding box check is an optimisation step; the final inclusion is determined
  by the point-in-polygon algorithm.
"""

import json
import os
import sys
from pyproj import Transformer

# --- CONFIGURATION ---
FACILITY_TO_SITE_ID = {
    1: 14, 2: 3, 3: 8, 4: 7, 5: 4, 6: 13, 7: 2, 8: 6, 9: 17,
    10: 9, 11: 10, 12: 18, 13: 1, 14: 12, 15: 11, 16: 16, 17: 15, 18: 5
}

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Input Files
    poly_file = os.path.join(script_dir, '5_mins.json')
    bus_file = os.path.join(script_dir, 'bus_5min.json')
    cycle_file = os.path.join(script_dir, '5min_cycle.json')
    
    # Output File
    output_file = os.path.join(script_dir, 'transport_5min_joined.geojson')

    # Coordinate Transformer (British National Grid -> WGS84 Lat/Lon)
    transformer = Transformer.from_crs("epsg:27700", "epsg:4326", always_xy=True)

    # --- HELPER ALGORITHMS ---

    def is_point_in_bbox(x, y, bbox):
        """Fast check if point matches polygon bounding box"""
        return bbox[0] <= x <= bbox[2] and bbox[1] <= y <= bbox[3]

    def is_point_in_polygon(x, y, poly_rings):
        """Ray Casting Algorithm to check if point is inside polygon rings"""
        # Check outer ring (first ring)
        outer_ring = poly_rings[0]
        inside = False
        n = len(outer_ring)
        p1x, p1y = outer_ring[0]
        for i in range(n + 1):
            p2x, p2y = outer_ring[i % n]
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        return inside

    def get_bbox(rings):
        """Get min_x, min_y, max_x, max_y for a polygon"""
        all_x = [p[0] for ring in rings for p in ring]
        all_y = [p[1] for ring in rings for p in ring]
        return (min(all_x), min(all_y), max(all_x), max(all_y))

    # --- 1. LOAD AND CONVERT POINTS ---
    print("[1/4] Loading and converting points...")
    
    all_buses = []
    if os.path.exists(bus_file):
        with open(bus_file, 'r', encoding='utf-8') as f:
            bus_data = json.load(f)
        for feat in bus_data.get('features', []):
            attrs = feat.get('attributes', {})
            # Bus file has Longitude/Latitude directly
            lon = attrs.get('Longitude')
            lat = attrs.get('Latitude')
            if lon and lat:
                all_buses.append({
                    "name": attrs.get('CommonName', 'Bus Stop'),
                    "lat": lat, "lon": lon,
                    "type": "bus"
                })
    print(f"   -> Loaded {len(all_buses)} bus stops.")

    all_cycles = []
    if os.path.exists(cycle_file):
        with open(cycle_file, 'r', encoding='utf-8') as f:
            cycle_data = json.load(f)
        for feat in cycle_data.get('features', []):
            attrs = feat.get('attributes', {})
            easting = attrs.get('eastings')
            northing = attrs.get('northings')
            if easting and northing:
                lon, lat = transformer.transform(easting, northing)
                all_cycles.append({
                    "capacity": attrs.get('capacity', '?'),
                    "lat": lat, "lon": lon,
                    "type": "cycle"
                })
    print(f"   -> Loaded {len(all_cycles)} cycle spots.")

    # --- 2. PROCESS POLYGONS & PERFORM SPATIAL JOIN ---
    print("[2/4] Processing polygons and performing spatial join...")
    
    geojson_features = []
    
    if os.path.exists(poly_file):
        with open(poly_file, 'r', encoding='utf-8') as f:
            poly_data = json.load(f)
            
        for feature in poly_data.get('features', []):
            attrs = feature.get('attributes', {})
            geom = feature.get('geometry', {})
            
            # Identify Park
            fac_id = attrs.get('FacilityID')
            site_id = FACILITY_TO_SITE_ID.get(fac_id)
            if not site_id: continue

            # Convert Rings to Lat/Lon
            rings = geom.get('rings', [])
            latlon_rings = []
            for ring in rings:
                converted_ring = []
                for coord in ring:
                    lon, lat = transformer.transform(coord[0], coord[1])
                    converted_ring.append([lon, lat])
                latlon_rings.append(converted_ring)

            # Spatial Join Logic
            matched_buses = []
            matched_cycles = []
            
            # Optimization: Calculate Bounding Box
            bbox = get_bbox(latlon_rings)

            # Check Buses
            for bus in all_buses:
                if is_point_in_bbox(bus['lon'], bus['lat'], bbox):
                    if is_point_in_polygon(bus['lon'], bus['lat'], latlon_rings):
                        matched_buses.append(bus)

            # Check Cycles
            for cycle in all_cycles:
                if is_point_in_bbox(cycle['lon'], cycle['lat'], bbox):
                    if is_point_in_polygon(cycle['lon'], cycle['lat'], latlon_rings):
                        matched_cycles.append(cycle)

            # Build Feature
            new_feature = {
                "type": "Feature",
                "properties": {
                    "site_id": site_id,
                    "name": attrs.get('Name'),
                    "bus_stops": matched_buses,
                    "cycle_parks": matched_cycles
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": latlon_rings
                }
            }
            geojson_features.append(new_feature)
            # print(f"   -> Park {site_id}: {len(matched_buses)} buses, {len(matched_cycles)} cycles matched.")

    # --- 3. SAVE ---
    print(f"[3/4] Saving to {output_file}...")
    output_geojson = { "type": "FeatureCollection", "features": geojson_features }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_geojson, f, indent=2)
        
    print("[4/4] Done! Refresh your web page.")

if __name__ == "__main__":
    main()