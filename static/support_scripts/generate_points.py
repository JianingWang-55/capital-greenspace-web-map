"""
generate_points.py

Purpose
-------
Generate an enriched GeoJSON point layer for park centroids by merging:
1) ESRI/ArcGIS-exported point features (geometry source + Park_ID field), and
2) Oracle database attributes (park names, postcode, community council, SIMD decile,
   recreation score, and gallery URL).

This output is used by the Network Analysis / map visualisation components to ensure
each centroid point includes the same key attributes used elsewhere in the app.

What this script does
---------------------
- Reads an input JSON file `point_park.json` containing ESRI-style features.
- Connects to the Oracle database (password read from `~/.ora_student.txt`).
- Queries Greenspace + SIMD_Datazone + Recreation_Index to fetch park metadata.
- Matches ESRI `Park_ID` to Oracle `site_id`.
- Builds a GeoJSON FeatureCollection of Point features using WGS84 coordinates from
  the database (latitude/longitude).
- Writes the merged dataset to:
    static/parks_centroids_joined.geojson
  (relative to the script directory).

Outputs
-------
- GeoJSON: `static/parks_centroids_joined.geojson`

Notes
-----
- The script intentionally includes both `site_id` and `Park_ID` in properties to
  maintain compatibility with different downstream JavaScript/GeoJSON consumers.
- A small debug print shows the first few matched parks and their coordinates.
"""

import json
import oracledb
from pathlib import Path
import sys
import os

# 1. Oracle Password Reader
def get_password(passfile=".ora_student.txt"):
    home = Path.home()
    pf = home / passfile
    try:
        with open(pf, "r", encoding="utf-8") as f:
            return f.readline().strip()
    except FileNotFoundError:
        print(f"[ERROR] Password file not found: {pf}", file=sys.stderr)
        sys.exit(1)

def main():
    # 2. File Paths
    script_dir = Path(__file__).resolve().parent
    input_json = script_dir / "point_park.json"  # Source for geometry/matching
    # Output directly to static folder
    output_json = script_dir / "static" / "parks_centroids_joined.geojson"
    
    if not input_json.exists():
        print(f"[ERROR] Input JSON not found: {input_json}")
        sys.exit(1)
    
    print("[INFO] Reading source points...")
    with open(input_json, "r", encoding="utf-8") as f:
        esri_data = json.load(f)
    
    features = esri_data.get("features", [])
    
    # 3. Connect to DB and Fetch Detailed Info
    password = get_password()
    try:
        conn = oracledb.connect(
            user="s2907301",
            password=password,
            dsn="geoslearn",
            config_dir="/etc/"
        )
    except Exception as e:
        print(f"[ERROR] DB Connection failed: {e}")
        sys.exit(1)
    
    cur = conn.cursor()
    
    # Query matches the columns used in your SIMD Map
    query = """
        SELECT 
            g.site_id, 
            g.site_name, 
            g.postcode, 
            g.community_council, 
            g.latitude, 
            g.longitude,
            s.decile_value, 
            r.final_weighted_score,
            g.gallery_url
        FROM Greenspace g
        LEFT JOIN SIMD_Datazone s ON g.datazone_id = s.datazone_id
        LEFT JOIN Recreation_Index r ON g.site_id = r.site_id
    """
    
    print("[INFO] Querying Oracle Database...")
    cur.execute(query)
    
    # Store DB data in a dictionary for fast lookup
    db_parks = {}
    for row in cur:
        site_id = row[0]
        db_parks[site_id] = {
            "site_name": row[1],
            "postcode": row[2],
            "community": row[3],
            "lat": row[4],
            "lon": row[5],
            "simd_decile": row[6],
            "recreation_score": row[7],
            "gallery_url": row[8]
        }
    
    cur.close()
    conn.close()
    
    # 4. Merge and Create GeoJSON
    geojson_features = []
    mapped_count = 0
    
    for feat in features:
        attrs = feat.get("attributes") or {}
        pid = attrs.get("Park_ID")
        if pid is None: 
            continue
        
        # Match Park_ID with Site_ID
        extra = db_parks.get(pid)
        
        if extra:
            properties = {
                "site_id": pid,           
                "Park_ID": pid,           
                "site_name": extra["site_name"],
                "postcode": extra["postcode"],
                "community": extra["community"],
                "simd_decile": extra["simd_decile"],
                "recreation_score": extra["recreation_score"],
                "gallery_url": extra["gallery_url"]
            }
            
            # Use WGS84 coordinates from DB if available
            lat = extra.get("lat")
            lon = extra.get("lon")
            
            if lat and lon:
                geojson_features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [float(lon), float(lat)]
                    },
                    "properties": properties
                })
                mapped_count += 1
        
                if mapped_count <= 5:
                    print(f"  Park {mapped_count}: {properties['site_name']}")
                    print(f"    site_id: {properties['site_id']}")
                    print(f"    coordinates: [{lon}, {lat}]")
    
    output_data = {
        "type": "FeatureCollection",
        "features": geojson_features
    }
    
    # 5. Save File
    output_json.parent.mkdir(parents=True, exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
    
    print("-" * 50)
    print(f"[SUCCESS] Generated: {output_json}")
    print(f"[INFO] Parks matched and enriched: {mapped_count}")
    print(f"[INFO] Total features in output: {len(geojson_features)}")
    print("-" * 50)

if __name__ == "__main__":
    main()