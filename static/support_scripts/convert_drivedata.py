"""
convert_drivedata.py

Purpose
-------
Convert an ESRI JSON export of driving distance service areas into a standard GeoJSON
FeatureCollection for use in the web map application's Network Analysis module.

What this script does
---------------------
- Reads an input file named: "drive distance.json" (expected to be in the same folder
  as this script).
- Extracts polygon geometries from ESRI-style features (geometry.rings).
- Creates GeoJSON Polygon features using the rings as coordinates.
- Adds a database identifier field (`db_site_id`) into each feature's properties by
  mapping ESRI `FacilityID` values to Oracle database `site_id` values using the
  `FACILITY_TO_SITE_ID` lookup table.
- Writes the output GeoJSON to: ./static/drive_areas.geojson (relative to this script).

Inputs / Outputs
----------------
Input:
- drive distance.json (ESRI JSON; must contain `features`, each with `attributes`
  and `geometry.rings`)

Output:
- static/drive_areas.geojson (GeoJSON FeatureCollection)

Notes
-----
- The ID mapping is project-specific and must match the current Oracle database IDs.
- Features without polygon rings are skipped.
- The script ensures the `static/` directory exists before writing output.

"""
import json
from pathlib import Path
import sys
import os

# ---------------------------------------------------------
# ID mapping table: FacilityID -> Site_ID (Oracle DB)
# ---------------------------------------------------------
FACILITY_TO_SITE_ID = {
    1: 14, 2: 3, 3: 8, 4: 7, 5: 4, 6: 13, 7: 2, 8: 6, 9: 17,
    10: 9, 11: 10, 12: 18, 13: 1, 14: 12, 15: 11, 16: 16, 17: 15, 18: 5
}

def main():
    # Get the directory where this script is located
    script_dir = Path(__file__).resolve().parent
    
    # 1. Input file: drive distance.json
    input_file = script_dir / "drive distance.json"
    
    # 2. Output file: drive_areas.geojson (saved in the static folder)
    static_dir = script_dir / "static"
    output_file = static_dir / "drive_areas.geojson" 

    if not input_file.exists():
        print(f"[ERROR] Input file not found: {input_file}")
        sys.exit(1)

    print(f"[INFO] Reading input file: {input_file}")
    with open(input_file, "r", encoding="utf-8") as f:
        esri_data = json.load(f)

    esri_features = esri_data.get("features", [])
    geojson_features = []
    
    count = 0
    mapped_count = 0
    
    for feat in esri_features:
        attrs = feat.get("attributes") or {}
        geom = feat.get("geometry") or {}
        rings = geom.get("rings")

        # Skip features without polygon geometry
        if not rings:
            continue
            
        fac_id = attrs.get("FacilityID")
        
        # Attempt to map FacilityID to database site_id
        try:
            lookup_id = int(fac_id) if fac_id is not None else None
            db_id = FACILITY_TO_SITE_ID.get(lookup_id)
        except ValueError:
            db_id = None
        
        attrs["db_site_id"] = db_id

        if db_id is not None:
            mapped_count += 1

        new_feature = {
            "type": "Feature",
            "properties": attrs,
            "geometry": {
                "type": "Polygon",
                "coordinates": rings
            }
        }
        geojson_features.append(new_feature)
        count += 1

    geojson_output = {
        "type": "FeatureCollection",
        "features": geojson_features
    }

    # Ensure the static directory exists
    static_dir.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(geojson_output, f, indent=2)

    print("-" * 30)
    print(f"[SUCCESS] Successfully converted {count} driving distance areas.")
    print(f"[INFO] {mapped_count} areas were matched to database site IDs.")
    print(f"[OUTPUT] GeoJSON saved to: {output_file}")
    print("-" * 30)

if __name__ == "__main__":
    main()
