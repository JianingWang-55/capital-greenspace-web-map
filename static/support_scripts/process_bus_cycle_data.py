"""
process_bus_cycle_data.py

Purpose
-------
This file is used by the web map's Network Analysis module, and one usage is to provide a reliable park name list (and IDs)
for the Network Analysis dropdown/filter.

What this script does
---------------------
- Reads three ESRI/ArcGIS-exported JSON files:
  1) `park_polygon.json`        : park polygons (British National Grid, EPSG:27700)
  2) `near_3_stop_bus.json`     : results of a "Generate Near Table" style join for buses
  3) `near3_cyclepark.json`     : results of a "Generate Near Table" style join for cycle parks

- Builds lookup tables keyed by a link ID to associate:
  - up to the nearest 3 bus stops per park polygon
  - up to the nearest 3 cycle parking points per park polygon

- Converts coordinates:
  - Park polygons are transformed from EPSG:27700 to EPSG:4326 (WGS84 lon/lat)
  - Cycle parking point coordinates are transformed from EPSG:27700 to EPSG:4326
  - Bus stop points use their provided Latitude/Longitude directly

- Writes a GeoJSON FeatureCollection to:
    static/parks_with_transport.geojson

Output Structure
----------------
Each output feature is a Polygon with properties including:
- site_id      : park ID (from Park_ID)
- name         : park name (from NAME or Name_1)
- bus_stops    : list (top 3) of nearest bus stop objects, sorted by rank
- cycle_parks  : list (top 3) of nearest cycle parking objects, sorted by rank

Notes / Assumptions
-------------------
- The matching logic uses `FID + 1` as the key to join park polygons to the "near table"
  link IDs. This reflects how the ArcGIS near table indices were produced in this dataset.
- Ensure the three input files exist in the same directory as this script before running.
- The output file is written to a `static/` subfolder (created if missing).

"""

import json
import os
from pyproj import Transformer

def main():
    # 1. Set file paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    park_file = os.path.join(script_dir, 'park_polygon.json')
    bus_file = os.path.join(script_dir, 'near_3_stop_bus.json')
    cycle_file = os.path.join(script_dir, 'near3_cyclepark.json')
    
    # Output file (named parks_with_transport.geojson to distinguish it)
    output_file = os.path.join(script_dir, 'static', 'parks_with_transport.geojson')
    
    if not os.path.exists(park_file) or not os.path.exists(bus_file) or not os.path.exists(cycle_file):
        print("[Error] Please ensure park_polygon.json, near_3_stop_bus.json, and near3_cyclepark.json are all in the current directory.")
        return

    print("[INFO] Reading input data...")
    with open(park_file, 'r', encoding='utf-8') as f: park_data = json.load(f)
    with open(bus_file, 'r', encoding='utf-8') as f: bus_data = json.load(f)
    with open(cycle_file, 'r', encoding='utf-8') as f: cycle_data = json.load(f)

    # 2. Initialize coordinate transformation (EPSG:27700 -> EPSG:4326)
    transformer = Transformer.from_crs("epsg:27700", "epsg:4326", always_xy=True)

    # 3. Build bus stop lookup table
    bus_lookup = {}
    for feature in bus_data.get('features', []):
        attrs = feature.get('attributes', {})
        link_id = attrs.get('park_FeatureTo_GenerateNearT2.IN_FID')
        if link_id is not None:
            stop = {
                "name": attrs.get('bus_ExportFeatures.CommonName'),
                "lat": attrs.get('bus_ExportFeatures.Latitude'),
                "lon": attrs.get('bus_ExportFeatures.Longitude'),
                "rank": attrs.get('park_FeatureTo_GenerateNearT2.NEAR_RANK'),
                "distance": attrs.get('park_FeatureTo_GenerateNearT2.NEAR_DIST')
            }
            if link_id not in bus_lookup: bus_lookup[link_id] = []
            bus_lookup[link_id].append(stop)

    # 4. Build cycle parking lookup table (with coordinate transformation)
    cycle_lookup = {}
    for feature in cycle_data.get('features', []):
        attrs = feature.get('attributes', {})
        geom = feature.get('geometry', {})
        link_id = attrs.get('cycle.IN_FID')
        
        if link_id is not None:
            # Transform coordinates (x, y -> lon, lat)
            x = geom.get('x')
            y = geom.get('y')
            if x and y:
                lon, lat = transformer.transform(x, y)
                cycle_spot = {
                    "type": attrs.get('cycleparking.bicycle_pa'),
                    "capacity": attrs.get('cycleparking.capacity'),
                    "lat": lat,
                    "lon": lon,
                    "rank": attrs.get('cycle.NEAR_RANK'),
                    "distance": attrs.get('cycle.NEAR_DIST')
                }
                if link_id not in cycle_lookup: cycle_lookup[link_id] = []
                cycle_lookup[link_id].append(cycle_spot)

    # 5. Generate GeoJSON
    geojson_features = []
    
    for feature in park_data.get('features', []):
        attrs = feature.get('attributes', {})
        geom = feature.get('geometry', {})
        
        fid = attrs.get('FID')      # 0, 1, 2...
        park_id = attrs.get('Park_ID')
        
        # Matching logic: FID + 1
        bus_stops = bus_lookup.get(fid + 1, [])
        bus_stops.sort(key=lambda x: x['rank'] if x['rank'] is not None else 999)
        
        cycle_spots = cycle_lookup.get(fid + 1, [])
        cycle_spots.sort(key=lambda x: x['rank'] if x['rank'] is not None else 999)

        # Transform park geometry coordinates
        rings = geom.get('rings', [])
        new_rings = []
        for ring in rings:
            converted_ring = []
            for coord in ring:
                lon, lat = transformer.transform(coord[0], coord[1])
                converted_ring.append([lon, lat])
            new_rings.append(converted_ring)

        new_feature = {
            "type": "Feature",
            "properties": {
                "site_id": park_id, 
                "name": attrs.get('NAME') or attrs.get('Name_1'),
                "bus_stops": bus_stops[:3],     # Top 3 Bus
                "cycle_parks": cycle_spots[:3]  # Top 3 Cycle
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": new_rings
            }
        }
        geojson_features.append(new_feature)

    output_geojson = {
        "type": "FeatureCollection",
        "features": geojson_features
    }

    # 6. Save output
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_geojson, f, indent=2)

    print(f"[Success] Generated: {output_file}")
    if len(geojson_features) > 0:
        p = geojson_features[0]['properties']
        print(f"Sample: {p['name']} has {len(p['bus_stops'])} bus stops and {len(p['cycle_parks'])} cycle parks.")

if __name__ == "__main__":
    main()
