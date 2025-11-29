"""
Flask Web Map App – Greenspace + SIMD Layer + Interaction Button
"""
from flask import Flask, render_template, request, jsonify
import oracledb
from pathlib import Path
import os
import sys
import logging
import math

app = Flask(__name__)

# ------------------------
# PASSWORD READER
# ------------------------
def get_password(passfile='.ora_student.txt'):
    home = Path.home()
    passfile = os.path.join(home, passfile)
    try:
        with open(passfile) as f:
            return f.readline().strip()
    except FileNotFoundError:
        logging.error("Password file not found.")
        sys.exit(1)

# ------------------------
# Distance Calculation Function (Haversine)
# ------------------------
def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points (unit: km)"""
    R = 6371  # Earth radius (km)
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

# ------------------------
# HOME PAGE
# ------------------------
@app.route("/")
def index():
    return """
    <h2>Welcome to Jianing's Flask Web Map</h2>
    <p>Try these pages:</p>
    <ul>
        <li><a href='/simd_map'>SIMD Layer Map</a></li>
        <li><a href='/interaction_map'>Interaction Map</a></li>
    </ul>
    """

# ------------------------
# SIMD + Greenspace Page
# ------------------------
@app.route("/simd_map")
def simd_map():
    password = get_password()
    with oracledb.connect(
        user="s2907301",
        password=password,
        dsn="geoslearn",
        config_dir="/etc/"
    ) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    g.site_id,
                    g.site_name,
                    g.postcode,
                    g.community_council,
                    g.latitude,
                    g.longitude,
                    s.decile_value,
                    r.final_weighted_score
                FROM Greenspace g
                LEFT JOIN SIMD_Datazone s
                    ON g.datazone_id = s.datazone_id
                LEFT JOIN Recreation_Index r
                    ON g.site_id = r.site_id
                ORDER BY g.site_id
            """)
            rows = cur.fetchall()
    
    parks = []
    for row in rows:
        parks.append({
            "site_id": row[0],
            "name": row[1],
            "postcode": row[2],
            "community": row[3],
            "lat": float(row[4]),
            "lon": float(row[5]),
            "decile": row[6],
            "recreation": row[7]
        })
    
    return render_template("simd_map.html", parks=parks)

# ------------------------
# Interaction Map Page
# ------------------------
@app.route("/interaction_map")
def interaction_map():
    password = get_password()
    
    try:
        with oracledb.connect(
            user="s2907301",
            password=password,
            dsn="geoslearn",
            config_dir="/etc/"
        ) as conn:
            with conn.cursor() as cur:
                # Query park data
                cur.execute("""
                    SELECT
                        g.site_id,
                        g.site_name,
                        g.postcode,
                        g.community_council,
                        g.latitude,
                        g.longitude,
                        s.decile_value,
                        ri.final_weighted_score,
                        ri.overall_quality_score,
                        ri.safety_score,
                        ri.accessibility_score,
                        ri.quantity_variety_score
                    FROM Greenspace g
                    LEFT JOIN SIMD_Datazone s
                        ON g.datazone_id = s.datazone_id
                    LEFT JOIN Recreation_Index ri
                        ON g.site_id = ri.site_id
                    WHERE g.latitude IS NOT NULL
                      AND g.longitude IS NOT NULL
                    ORDER BY g.site_id
                """)
                
                parks = []
                for row in cur:
                    parks.append({
                        "site_id": row[0],
                        "name": row[1],
                        "postcode": row[2] if row[2] else 'N/A',
                        "community": row[3] if row[3] else 'N/A',
                        "lat": float(row[4]),
                        "lon": float(row[5]),
                        "decile": row[6] if row[6] else 'N/A',
                        "recreation": round(row[7], 3) if row[7] is not None else None,
                        "quality": round(row[8], 3) if row[8] is not None else None,
                        "safety": round(row[9], 3) if row[9] is not None else None,
                        "accessibility": round(row[10], 3) if row[10] is not None else None,
                        "quantity_variety": round(row[11], 3) if row[11] is not None else None
                    })
                
                print(f"✅ Loaded {len(parks)} parks")
                
                # Query all unique facility names from Facility table
                cur.execute("""
                    SELECT DISTINCT facility_name
                    FROM Facility
                    WHERE facility_name IS NOT NULL
                    ORDER BY facility_name
                """)
                
                facilities = []
                for row in cur.fetchall():
                    facilities.append({
                        "name": row[0]
                    })
                
                print(f"✅ Loaded {len(facilities)} unique facility names:")
                for f in facilities[:10]:
                    print(f"   - {f['name']}")
        
        return render_template("interaction_map.html", parks=parks, facilities=facilities)
        
    except Exception as e:
        print(f"❌ Error loading interaction map: {e}")
        import traceback
        traceback.print_exc()
        return f"Error: {e}", 500

# ------------------------
# Search parks based on location and specific facility names
# ------------------------
@app.route("/search_parks_by_location", methods=['POST'])
def search_parks_by_location():
    data = request.get_json()
    
    facility_names = data.get('facilities', [])
    user_lat = data.get('user_lat')
    user_lon = data.get('user_lon')
    distance = data.get('distance')
    nearest_only = data.get('nearest_only', False)
    
    print(f"🔍 Searching for facility names: {facility_names}")
    
    password = get_password()
    
    try:
        with oracledb.connect(
            user="s2907301",
            password=password,
            dsn="geoslearn",
            config_dir="/etc/"
        ) as conn:
            with conn.cursor() as cur:
                if not facility_names:
                    return jsonify({'parks': []})
                
                # Query parks directly based on facility_name
                facility_placeholders = ','.join([f":facility{i}" for i in range(len(facility_names))])
                
                query = f"""
                    SELECT DISTINCT
                        g.site_id,
                        g.site_name,
                        g.latitude,
                        g.longitude
                    FROM Greenspace g
                    JOIN Facility f ON g.site_id = f.site_id
                    WHERE f.facility_name IN ({facility_placeholders})
                      AND g.latitude IS NOT NULL
                      AND g.longitude IS NOT NULL
                """
                
                bind_params = {f"facility{i}": name for i, name in enumerate(facility_names)}
                cur.execute(query, bind_params)
                
                candidate_parks = cur.fetchall()
                print(f"✅ Found {len(candidate_parks)} candidate parks")
                
                # Calculate distance and filter
                results = []
                for row in candidate_parks:
                    site_id, name, lat, lon = row
                    dist = calculate_distance(user_lat, user_lon, float(lat), float(lon))
                    
                    # Filter by distance if specified
                    if not nearest_only and distance and dist > distance:
                        continue
                    
                    # Query the specific facility names matched for this park
                    cur.execute(f"""
                        SELECT DISTINCT facility_name
                        FROM Facility
                        WHERE site_id = :site_id
                          AND facility_name IN ({facility_placeholders})
                    """, {'site_id': site_id, **bind_params})
                    
                    matched_facilities = [r[0] for r in cur.fetchall()]
                    
                    results.append({
                        'site_id': site_id,
                        'name': name,
                        'distance': dist,
                        'matched_facilities': matched_facilities
                    })
                
                # Sort by distance
                results.sort(key=lambda x: x['distance'])
                
                # If nearest_only mode, return only the closest one
                if nearest_only and results:
                    results = [results[0]]
                
                print(f"✅ Returning {len(results)} results")
        
        return jsonify({'parks': results})
        
    except Exception as e:
        print(f"❌ Error in search: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# ------------------------
# RUN LOCALLY
# ------------------------
if __name__ == "__main__":
    app.run(debug=True)