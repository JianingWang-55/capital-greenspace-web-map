"""
clean_simd_data.py

Purpose
-------
Clean the SIMD Edinburgh GeoJSON file by removing any features whose geometry type
is not Polygon or MultiPolygon.

What this script does
---------------------
- Reads `simd_edinburgh.geojson`
- Keeps only features with geometry type:
    - Polygon
    - MultiPolygon
- Prints a message for each removed feature geometry type
- Writes the cleaned output to:
    `simd_edinburgh_cleaned.geojson`
- Prints a summary of how many features were kept/removed

"""
import json

# Read the original file
with open('simd_edinburgh.geojson', 'r') as f:
    data = json.load(f)

# Record the original feature count
original_count = len(data['features'])

# Keep only Polygon and MultiPolygon features
cleaned_features = []
removed_count = 0

for feature in data['features']:
    geom_type = feature['geometry']['type']
    if geom_type in ['Polygon', 'MultiPolygon']:
        cleaned_features.append(feature)
    else:
        print(f"Removed a feature with geometry type: {geom_type}")
        removed_count += 1

# Update the data
data['features'] = cleaned_features

# Save the cleaned file
with open('simd_edinburgh_cleaned.geojson', 'w') as f:
    json.dump(data, f, indent=2)  # Add indent to make the file more readable

print(f"\n=== Cleaning Summary ===")
print(f"Original feature count: {original_count}")
print(f"Cleaned feature count: {len(cleaned_features)}")
print(f"Removed feature count: {removed_count}")
print(f"\n Saved to: simd_edinburgh_cleaned.geojson")
