import geopandas as gpd
from shapely.geometry import Point

# ----------------------------
# 1. 加载 SIMD GeoJSON
# ----------------------------
simd = gpd.read_file("simd_edinburgh.geojson")

# SIMD 数据坐标系通常是 WGS84（EPSG:4326）
# 如果不是，也可以 simd.to_crs(4326, inplace=True)

# ----------------------------
# 2. 公园列表（输入你的经纬度）
# ----------------------------
# 示例：
parks = [
    {"name": "Saughton Park", "lat": 55.936426, "lon": -3.248595},
    {"name": "Hunter’s Hall Public Park", "lat": 55.929520, "lon": -3.115470},
    {"name": "Colinton Mains Park", "lat": 55.911293, "lon": -3.226589},
    {"name": "Hailes Quarry Park", "lat": 55.921775, "lon": -3.268041},
    {"name": "West Pilton Park", "lat": 55.972054, "lon": -3.245833},
    {"name": "Inch Park", "lat": 55.926125, "lon": -3.160420},
    {"name": "Dalry Community Park", "lat": 55.941066, "lon": -3.221282},
    {"name": "Figgate Park", "lat": 55.951500, "lon": -3.122478},
    {"name": "Leith Links", "lat": 55.971177, "lon": -3.163991},
    {"name": "Lochend Park", "lat": 55.960609, "lon": -3.160061},
    {"name": "St Marks Park", "lat": 55.968937, "lon": -3.194553},
    {"name": "St Margaret’s Park", "lat": 55.939893, "lon": -3.284767},
    {"name": "Harrison Park East", "lat": 55.936485, "lon": -3.223683},
    {"name": "Braidburn Valley Park", "lat": 55.917315, "lon": -3.215035},
    {"name": "Victoria Park", "lat": 55.975109, "lon": -3.193363},
    {"name": "The Meadows", "lat": 55.941430, "lon": -3.191872},
    {"name": "Inverleith Park", "lat": 55.963483, "lon": -3.217358},
    {"name": "Roseburn Public Park", "lat": 55.944784, "lon": -3.238827}
]


# 转换为 GeoDataFrame
park_points = gpd.GeoDataFrame(
    parks,
    geometry=[Point(p["lon"], p["lat"]) for p in parks],
    crs="EPSG:4326"
)

# ----------------------------
# 3. 空间叠加（point-in-polygon）
# ----------------------------
joined = gpd.sjoin(park_points, simd, how="left", predicate="within")

# ----------------------------
# 4. 输出结果（SIMD Decilev2）
# ----------------------------
for idx, row in joined.iterrows():
    print(f"{row['name']}: Decile = {row['Decilev2']}  | DataZone = {row['DataZone']}")
