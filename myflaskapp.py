"""
myflaskapp.py

Capital Green Space Project – Flask Web Map Application

Overview
--------
This Flask application powers the Capital Green Space Project web-mapping system,
deployed on the University of Edinburgh devapps server. It provides three core
web GIS tools for exploring greenspaces in Edinburgh:

1) Greenspace & Deprivation Explorer 
   - Visualises parks alongside SIMD 2020 deprivation deciles.

2) Interactive Search Map
   - Supports park search by name, score-based ranking, facility filtering,
     postcode-based proximity search, popups with image galleries, and CSV export.

3) Network Analysis Map
   - Displays walking isochrones, driving service areas, and bus/bike connectivity
     layers (loaded from static GeoJSON).

Data Sources & Stack
-------------------
- Backend: Python Flask
- Database: Oracle (Greenspace, SIMD_Datazone, Recreation_Index, Facility tables/views)
- Frontend: Leaflet.js + HTML/CSS/JavaScript templates
- Static datasets: GeoJSON layers and local images under /static

Image Support & Filename Normalisation
--------------------------------------
This app supports per-park image galleries stored under `static/images/`.
To handle filesystem naming inconsistencies (especially apostrophes), the image
loader attempts multiple folder-name strategies:

Deployment Notes
----------------
- Reads the Oracle password from `~/.ora_student.txt` via `get_password()`.
- Designed for deployment behind Gunicorn on devapps (SCRIPT_NAME configured externally).
- Routes render Jinja2 templates in `templates/` and rely on modular JS in `static/js/`.

Important
---------
Per request, this file is presented as a submission/appendix snapshot.
"""


from flask import Flask, render_template, request, jsonify, url_for
import oracledb
from pathlib import Path
import os
import sys
import logging
import math
import collections
import json  

app = Flask(__name__)

# ------------------------
# PASSWORD READER
# ------------------------
def get_password(passfile='.ora_student.txt'):
    """Read Oracle database password from home directory"""
    home = Path.home()
    passfile = os.path.join(home, passfile)
    try:
        with open(passfile) as f:
            return f.readline().strip()
    except FileNotFoundError:
        logging.error("Password file not found.")
        sys.exit(1)

# ------------------------
# NAME NORMALIZATION
# ------------------------
def normalize_name_for_filesystem(name):
    normalized = name.replace("'", "?")
    normalized = normalized.replace("'", "?")  # Curly apostrophe
    normalized = normalized.replace("`", "?")
    return normalized.strip()

def normalize_name_no_apostrophe(name):
    normalized = name.replace("'", "")
    normalized = normalized.replace("'", "")
    normalized = normalized.replace("`", "")
    normalized = normalized.replace('"', '')
    normalized = normalized.replace('/', '-')
    normalized = normalized.replace('\\', '-')
    normalized = normalized.replace(':', '')
    normalized = normalized.replace('*', '')
    normalized = normalized.replace('?', '')
    normalized = normalized.replace('<', '')
    normalized = normalized.replace('>', '')
    normalized = normalized.replace('|', '')
    return normalized.strip()

# ------------------------
# IMAGE PATH HELPER
# ------------------------
def get_park_images(site_id, park_name):
    images = []
    base_path = Path('static/images')
    
    # Strategy 1: Try question mark version
    question_mark_name = normalize_name_for_filesystem(park_name)
    if question_mark_name != park_name:
        question_folder = base_path / question_mark_name
        if question_folder.exists() and question_folder.is_dir():
            for ext in ['*.jpg', '*.jpeg', '*.png', '*.JPG', '*.JPEG', '*.PNG']:
                for img_file in sorted(question_folder.glob(ext)):
                    relative_path = f"images/{question_mark_name}/{img_file.name}"
                    images.append(relative_path)
    
    # Strategy 2: Try exact park name folder
    if not images:
        park_folder = base_path / park_name
        if park_folder.exists() and park_folder.is_dir():
            for ext in ['*.jpg', '*.jpeg', '*.png', '*.JPG', '*.JPEG', '*.PNG']:
                for img_file in sorted(park_folder.glob(ext)):
                    relative_path = f"images/{park_name}/{img_file.name}"
                    images.append(relative_path)
    
    # Strategy 3: Try no apostrophe version
    if not images:
        no_apostrophe_name = normalize_name_no_apostrophe(park_name)
        if no_apostrophe_name != park_name:
            no_apostrophe_folder = base_path / no_apostrophe_name
            if no_apostrophe_folder.exists() and no_apostrophe_folder.is_dir():
                for ext in ['*.jpg', '*.jpeg', '*.png', '*.JPG', '*.JPEG', '*.PNG']:
                    for img_file in sorted(no_apostrophe_folder.glob(ext)):
                        relative_path = f"images/{no_apostrophe_name}/{img_file.name}"
                        images.append(relative_path)
    
    # Strategy 4: Try lowercase versions
    if not images:
        lowercase_question = question_mark_name.lower()
        lowercase_folder = base_path / lowercase_question
        if lowercase_folder.exists() and lowercase_folder.is_dir():
            for ext in ['*.jpg', '*.jpeg', '*.png', '*.JPG', '*.JPEG', '*.PNG']:
                for img_file in sorted(lowercase_folder.glob(ext)):
                    relative_path = f"images/{lowercase_question}/{img_file.name}"
                    images.append(relative_path)
                    
    if not images:
        lowercase_no_apostrophe = normalize_name_no_apostrophe(park_name).lower()
        lowercase_no_apos_folder = base_path / lowercase_no_apostrophe
        if lowercase_no_apos_folder.exists() and lowercase_no_apos_folder.is_dir():
            for ext in ['*.jpg', '*.jpeg', '*.png', '*.JPG', '*.JPEG', '*.PNG']:
                for img_file in sorted(lowercase_no_apos_folder.glob(ext)):
                    relative_path = f"images/{lowercase_no_apostrophe}/{img_file.name}"
                    images.append(relative_path)
    
    # Strategy 6: Check parks folder
    parks_folder = base_path / 'parks'
    if parks_folder.exists():
        for ext in ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']:
            main_image = parks_folder / f'park_{site_id}{ext}'
            if main_image.exists():
                relative_path = f"images/parks/park_{site_id}{ext}"
                if relative_path not in images:
                    images.append(relative_path)
        
        for ext in ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']:
            for i in range(1, 20):
                numbered_image = parks_folder / f'park_{site_id}_{i}{ext}'
                if numbered_image.exists():
                    relative_path = f"images/parks/park_{site_id}_{i}{ext}"
                    if relative_path not in images:
                        images.append(relative_path)
    
    return images

# ------------------------
# DISTANCE CALCULATION
# ------------------------
def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

# ------------------------
# ROUTES
# ------------------------

# --- 1. NEW LANDING PAGE (COVER) ---
@app.route("/")
def landing_cover():
    """
    Serves the cover page (cover.html) as the root URL.
    Scans the 'static/cover' folder for images to display in the carousel.
    """
    image_folder = os.path.join(app.static_folder, 'cover')
    images = []

    if os.path.exists(image_folder):
        try:
            images = [
                f for f in os.listdir(image_folder) 
                if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp'))
            ]
            images.sort()
        except Exception as e:
            print(f"Error reading cover images: {e}")
    else:
        print(f"Warning: Cover folder not found at {image_folder}")

    return render_template("cover.html", images=images)


# --- 2. MAIN APP HOME (Previously Index) ---
@app.route("/home")
def index():
    """
    The main dashboard of the application (formerly at '/').
    """
    return render_template("index.html")


@app.route("/simd_map")
def simd_map():
    password = get_password()
    with oracledb.connect(user="s2907301", password=password, dsn="geoslearn", config_dir="/etc/") as conn:
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
                    r.final_weighted_score, 
                    g.gallery_url,
                    r.overall_quality_score, 
                    r.quantity_variety_score, 
                    r.safety_score, 
                    r.accessibility_score
                FROM Greenspace g
                LEFT JOIN SIMD_Datazone s ON g.datazone_id = s.datazone_id
                LEFT JOIN Recreation_Index r ON g.site_id = r.site_id
                ORDER BY g.site_id
            """)
            rows = cur.fetchall()
    
    parks = []
    for row in rows:
        site_id, park_name = row[0], row[1]
        image_paths = get_park_images(site_id, park_name)
        parks.append({
            "site_id": site_id, 
            "name": park_name, 
            "postcode": row[2], 
            "community": row[3],
            "lat": float(row[4]), 
            "lon": float(row[5]), 
            "decile": row[6], 
            "recreation": round(row[7], 3) if row[7] is not None else 'N/A',
            "gallery_url": row[8],
            "quality": round(row[9], 2) if row[9] is not None else 'N/A',
            "quantity": round(row[10], 2) if row[10] is not None else 'N/A',
            "safety": round(row[11], 2) if row[11] is not None else 'N/A',
            "accessibility": round(row[12], 2) if row[12] is not None else 'N/A',
            "images": image_paths
        })
    return render_template("simd_map.html", parks=parks)

@app.route("/interaction_map")
def interaction_map():
    password = get_password()
    try:
        with oracledb.connect(user="s2907301", password=password, dsn="geoslearn", config_dir="/etc/") as conn:
            with conn.cursor() as cur:
                # 1. Fetch Basic Park Data
                cur.execute("""
                    SELECT
                        g.site_id, g.site_name, g.postcode, g.community_council, g.latitude, g.longitude,
                        s.decile_value, ri.final_weighted_score, ri.overall_quality_score, ri.safety_score,
                        ri.accessibility_score, ri.quantity_variety_score, g.gallery_url
                    FROM Greenspace g
                    LEFT JOIN SIMD_Datazone s ON g.datazone_id = s.datazone_id
                    LEFT JOIN Recreation_Index ri ON g.site_id = ri.site_id
                    WHERE g.latitude IS NOT NULL AND g.longitude IS NOT NULL
                    ORDER BY g.site_id
                """)
                park_rows = cur.fetchall()

                # 2. Fetch All Facilities for All Parks
                cur.execute("SELECT site_id, facility_name FROM Facility WHERE facility_name IS NOT NULL")
                facility_rows = cur.fetchall()

                # Map site_id -> list of facilities
                facilities_map = collections.defaultdict(list)
                for site_id, facility_name in facility_rows:
                    facilities_map[site_id].append(facility_name)

                # 3. Construct Park Objects
                parks = []
                for row in park_rows:
                    site_id = row[0]
                    park_name = row[1]
                    image_paths = get_park_images(site_id, park_name)
                    
                    # Get facilities for this specific park
                    park_facilities = facilities_map.get(site_id, [])

                    parks.append({
                        "site_id": site_id,
                        "name": park_name,
                        "postcode": row[2] if row[2] else 'N/A',
                        "community": row[3] if row[3] else 'N/A',
                        "lat": float(row[4]),
                        "lon": float(row[5]),
                        "decile": row[6] if row[6] else 'N/A',
                        "recreation": round(row[7], 3) if row[7] is not None else None,
                        "quality": round(row[8], 3) if row[8] is not None else None,
                        "safety": round(row[9], 3) if row[9] is not None else None,
                        "accessibility": round(row[10], 3) if row[10] is not None else None,
                        "quantity_variety": round(row[11], 3) if row[11] is not None else None,
                        "gallery_url": row[12],
                        "images": image_paths,
                        "facilities": park_facilities 
                    })
                
                print(f"Loaded {len(parks)} parks with facilities")

                # 4. Get Unique Facility List
                unique_facilities = sorted(list(set(f for sublist in facilities_map.values() for f in sublist)))
                facilities_json = [{"name": f} for f in unique_facilities]
                
        return render_template("interaction_map.html", parks=parks, facilities=facilities_json)
        
    except Exception as e:
        print(f"Error loading interaction map: {e}")
        import traceback
        traceback.print_exc()
        return f"Error: {e}", 500

@app.route("/network_analysis")
def network_analysis():
    """
    Route for the Network Analysis (Walking/Driving/Bus) Map.
    Populates the park list from the static GeoJSON file used in the map.
    """
    parks_list = []
    try:
        # Load the JSON file that contains the bus data (it has good metadata)
        json_path = os.path.join(app.static_folder, 'parks_with_transport.geojson')
        
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                seen_ids = set()
                
                for feature in data.get('features', []):
                    props = feature.get('properties', {})
                    # Handle varying ID/Name keys in GeoJSON
                    p_id = props.get('site_id') or props.get('db_site_id')
                    p_name = props.get('name') or props.get('site_name')
                    
                    if p_id and p_name and p_id not in seen_ids:
                        parks_list.append({'id': p_id, 'name': p_name})
                        seen_ids.add(p_id)
            
            # Sort alphabetically
            parks_list.sort(key=lambda x: x['name'])
        else:
            print("parks_with_transport.geojson not found in static folder")
            
    except Exception as e:
        print(f"Error loading network analysis data: {e}")

    return render_template("network_analysis.html", parks=parks_list)

@app.route("/user_guide")
def user_guide():
    return render_template("user_guide.html")

@app.route("/search_parks_by_location", methods=['POST'])
def search_parks_by_location():
    data = request.get_json()
    facility_names = data.get('facilities', [])
    user_lat = data.get('user_lat')
    user_lon = data.get('user_lon')
    distance = data.get('distance')
    nearest_only = data.get('nearest_only', False)
    
    password = get_password()
    try:
        with oracledb.connect(user="s2907301", password=password, dsn="geoslearn", config_dir="/etc/") as conn:
            with conn.cursor() as cur:
                if not facility_names:
                    return jsonify({'parks': []})
                
                # Fetch parks that have AT LEAST ONE of the facilities
                facility_placeholders = ','.join([f":facility{i}" for i in range(len(facility_names))])
                query = f"""
                    SELECT DISTINCT g.site_id, g.site_name, g.latitude, g.longitude
                    FROM Greenspace g
                    JOIN Facility f ON g.site_id = f.site_id
                    WHERE f.facility_name IN ({facility_placeholders})
                      AND g.latitude IS NOT NULL AND g.longitude IS NOT NULL
                """
                bind_params = {f"facility{i}": name for i, name in enumerate(facility_names)}
                cur.execute(query, bind_params)
                candidate_parks = cur.fetchall()
                
                results = []
                for row in candidate_parks:
                    site_id, name, lat, lon = row
                    dist = calculate_distance(user_lat, user_lon, float(lat), float(lon))
                    
                    if not nearest_only and distance and dist > distance:
                        continue
                    
                    results.append({
                        'site_id': site_id,
                        'name': name,
                        'distance': dist
                    })
                
                results.sort(key=lambda x: x['distance'])
                
        return jsonify({'parks': results})
        
    except Exception as e:
        print(f"Error in search: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)