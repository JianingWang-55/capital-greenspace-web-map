"""
generate_barchart.py

Purpose
-------
Generate per-park SVG bar charts visualising recreation-related scores
(Facility Quality, Quantity & Variety, Safety, Accessibility) for use
inside the web map popups.

What this script does
---------------------
- Connects to an Oracle database and queries the `Recreation_Index` table.
- Retrieves four normalized score metrics for each park.
- Generates a compact SVG bar chart for each park using Matplotlib.
- Saves each chart to the `barchart/` directory, named by `site_id`
  (e.g. `12.svg`), so it can be dynamically loaded in the web interface.

Key Features
------------
- Optimised figure size for popup display in Leaflet maps.
- Rotated and right-aligned x-axis labels to avoid overlap.
- Numeric score labels rendered above each bar.
- Clean visual style with minimal chart clutter.
- Automatic output directory creation if it does not exist.

Inputs / Outputs
----------------
Input:
- Oracle Database (table: `Recreation_Index`)

Output:
- SVG files written to:
    static/barchart/<site_id>.svg

Configuration
-------------
- Database credentials are defined at the top of the script.
- Output directory and chart styling (colours, labels) are configurable
  via constants.

Usage
-----
Run from the command line (ideally from the project root or static directory):
    python generate_barchart.py

Notes
-----
- The generated SVG charts are referenced by `site_id` inside the Flask
  application popups.
"""


import matplotlib.pyplot as plt
import os
import oracledb
import sys

# ==========================================
# CONFIGURATION
# ==========================================
OUTPUT_DIR = 'barchart' 

DB_USER = 's2907301'
DB_PASS = 'lczx5597'
DB_DSN  = "geoslearn"

# Chart Styling
COLORS = ['#36A2EB', '#FFCE56', '#FF6384', '#4BC0C0'] 
METRICS = ['Facility Quality', 'Quantity & Variety', 'Safety', 'Accessibility']

def fetch_data_from_oracle():
    """
    Connects to the Oracle database and fetches score data.
    """
    connection = None
    cursor = None
    try:
        print("Attempting to connect to Oracle...")
        connection = oracledb.connect(
            user=DB_USER, 
            password=DB_PASS, 
            dsn=DB_DSN,
            config_dir="/etc/" 
        )
        
        cursor = connection.cursor()
        sql = """
            SELECT site_id, site_name, overall_quality_score, 
                   quantity_variety_score, safety_score, accessibility_score
            FROM Recreation_Index
        """
        cursor.execute(sql)
        rows = cursor.fetchall()
        
        parks = []
        for row in rows:
            parks.append({
                'site_id': row[0],
                'name': row[1],
                'quality': row[2],
                'quantity': row[3],
                'safety': row[4],
                'access': row[5]
            })
        return parks

    except oracledb.DatabaseError as e:
        print(f"Database Error: {e}")
        return []
    finally:
        if cursor: cursor.close()
        if connection: connection.close()

def generate_charts(parks_data):
    """
    Generates an SVG bar chart with correctly rotated and aligned labels.
    """
    if not os.path.exists(OUTPUT_DIR):
        try:
            os.makedirs(OUTPUT_DIR)
            print(f"Created directory: {OUTPUT_DIR}")
        except OSError as e:
            print(f"Error creating directory: {e}")
            return

    print(f"Generating charts for {len(parks_data)} parks...")

    for park in parks_data:
        site_id = park.get('site_id')
        
        scores = [
            float(park.get('quality') or 0),
            float(park.get('quantity') or 0),
            float(park.get('safety') or 0),
            float(park.get('access') or 0)
        ]

        # Figure size: 3.5 inch width is good for popups
        plt.figure(figsize=(3.5, 2.8)) 
        
        bars = plt.bar(METRICS, scores, color=COLORS, width=0.65)
        
        plt.ylim(0, 1.15)
        plt.title('Park Scores', fontsize=12, fontweight='bold', color='#333', pad=10)
        
        # --- FIX IS HERE ---
        # rotation=30: Angles the text enough to fit
        # ha='right': Anchors the text so the END of the word touches the tick mark
        plt.tick_params(axis='x', labelsize=9)
        plt.xticks(rotation=30, ha='right') 
        
        plt.tick_params(axis='y', labelsize=9)
        
        # Add values on top of bars
        for bar in bars:
            height = bar.get_height()
            if height > 0:
                plt.text(
                    bar.get_x() + bar.get_width()/2., 
                    height + 0.02,
                    f'{height:.2f}',
                    ha='center', va='bottom', fontsize=9, fontweight='bold', color='#444'
                )

        # Remove top/right borders for a cleaner look
        plt.gca().spines['top'].set_visible(False)
        plt.gca().spines['right'].set_visible(False)
        plt.gca().spines['left'].set_color('#888')
        plt.gca().spines['bottom'].set_color('#888')
        plt.grid(axis='y', linestyle='--', alpha=0.3)

        # Save as SVG
        filename = os.path.join(OUTPUT_DIR, f"{site_id}.svg")
        plt.savefig(filename, format='svg', bbox_inches='tight')
        plt.close() 
        
    print(f"Success! {len(parks_data)} charts saved to {OUTPUT_DIR}/")

if __name__ == "__main__":
    current_dir = os.getcwd()
    print(f"Running in: {current_dir}")
    data = fetch_data_from_oracle()
    if data:
        generate_charts(data)
    else:
        print("No data found.")