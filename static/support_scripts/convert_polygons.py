"""
convert_polygons.py

Purpose
-------
Convert an ESRI JSON export of walking-time isochrone polygons into a standard GeoJSON
FeatureCollection for use in the web map application's Network Analysis module.

What this script does
---------------------
- Reads an input file named: "5_10_15walkingtime.json" (ESRI JSON format).
- Extracts polygon geometries from ESRI-style features (geometry.rings).
- Converts polygon coordinates from British National Grid (EPSG:27700) to WGS84
  longitude/latitude (EPSG:4326) using pyproj.
- Adds a database identifier field (`db_site_id`) into each feature's properties by
  mapping ESRI `FacilityID` values to Oracle database `site_id` values using the
  `FACILITY_TO_SITE_ID` lookup table.
- Writes the output GeoJSON to: "areas_joined.geojson" (in the same directory as the
  script by default, with a fallback for running from the project root).

Inputs / Outputs
----------------
Input:
- 5_10_15walkingtime.json (ESRI JSON; must contain `features`, each with `attributes`
  and `geometry.rings`)

Output:
- areas_joined.geojson (GeoJSON FeatureCollection)

Path Handling
-------------
- Assumes the script is executed from within the directory containing the JSON.
- If the input file is not found in the script directory, the script attempts a fallback
  lookup in a `static/` subdirectory and adjusts the output path accordingly.

Coordinate System Notes
-----------------------
- EPSG:27700: British National Grid (Easting/Northing)
- EPSG:4326: WGS84 geographic coordinates (Longitude/Latitude)

Usage
-----
Run from the command line:
    python convert_polygons.py
"""
import json
from pathlib import Path
import sys
from pyproj import Transformer  # [Added] Required for coordinate transformation

# ID mapping table
FACILITY_TO_SITE_ID = {
    1: 14, 2: 3, 3: 8, 4: 7, 5: 4, 6: 13, 7: 2, 8: 6, 9: 17,
    10: 9, 11: 10, 12: 18, 13: 1, 14: 12, 15: 11, 16: 16, 17: 15, 18: 5
}

def main():
    # Set file paths
    # Assumption: the script and the JSON file are in the same directory (often under static/)
    script_dir = Path(__file__).resolve().parent
    input_file = script_dir / "5_10_15walkingtime.json"
    output_file = script_dir / "areas_joined.geojson"

    if not input_file.exists():
        print(f"[ERROR] Input file not found: {input_file}")
        # If not found, try falling back to a 'static' subdirectory (in case the script is run from project root)
        fallback_input = script_dir / "static" / "5_10_15walkingtime.json"
        if fallback_input.exists():
            print(f"[INFO] Found file in subdirectory; adjusting paths...")
            input_file = fallback_input
            output_file = script_dir / "static" / "areas_joined.geojson"
        else:
            sys.exit(1)

    print(f"[INFO] Reading input file: {input_file}")
    with open(input_file, "r", encoding="utf-8") as f:
        esri_data = json.load(f)

    # [Added] Initialize coordinate transformer (EPSG:27700 -> EPSG:4326)
    # 27700 is British National Grid, 4326 is geographic lon/lat (WGS84)
    transformer = Transformer.from_crs("epsg:27700", "epsg:4326", always_xy=True)

    esri_features = esri_data.get("features", [])
    geojson_features = []
    
    mapped_count = 0
    
    for feat in esri_features:
        attrs = feat.get("attributes") or {}
        geom = feat.get("geometry") or {}
        rings = geom.get("rings")

        if not rings:
            continue
            
        # 1. Handle ID mapping
        fac_id = attrs.get("FacilityID")
        try:
            lookup_id = int(fac_id) if fac_id is not None else None
            db_id = FACILITY_TO_SITE_ID.get(lookup_id)
        except ValueError:
            db_id = None
        
        attrs["db_site_id"] = db_id
        if db_id is not None:
            mapped_count += 1

        # 2. [Key step] Transform coordinate system
        new_rings = []
        for ring in rings:
            converted_ring = []
            for coord in ring:
                # coord[0] is Easting (X), coord[1] is Northing (Y)
                lon, lat = transformer.transform(coord[0], coord[1])
                converted_ring.append([lon, lat])
            new_rings.append(converted_ring)

        new_feature = {
            "type": "Feature",
            "properties": attrs,
            "geometry": {
                "type": "Polygon",
                "coordinates": new_rings  # Use transformed coordinates
            }
        }
        geojson_features.append(new_feature)

    geojson_output = {
        "type": "FeatureCollection",
        "features": geojson_features
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(geojson_output, f, indent=2)

    print(f"[SUCCESS] Generated: {output_file}")
    print(f"[INFO] Total features: {len(geojson_features)}, Successfully mapped IDs: {mapped_count}")

if __name__ == "__main__":
    main()
