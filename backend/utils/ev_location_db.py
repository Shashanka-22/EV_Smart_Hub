import math
from backend.db_config import get_db_connection

def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance (km) between lat/lng points."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat/2)**2 +
        math.cos(math.radians(lat1)) *
        math.cos(math.radians(lat2)) *
        math.sin(dlon/2)**2
    )
    return R * 2 * math.asin(math.sqrt(a))


def find_nearby_from_db(user_lat, user_lng):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            id,
            name,
            location,
            latitude,
            longitude,
            price_per_kwh,
            total_slots,
            fast_charger,
            average_rating,
            review_count
        FROM stations
    """)

    stations = cursor.fetchall()
    db.close()

    nearby = []

    for s in stations:
        if not s["latitude"] or not s["longitude"]:
            continue

        distance = haversine(
            user_lat,
            user_lng,
            float(s["latitude"]),
            float(s["longitude"])
        )

        nearby.append({
            "station_id": s["id"],
            "name": s["name"],
            "address": s["location"],
            "distance_km": round(distance, 2),
            "price_per_kwh": s["price_per_kwh"],
            "total_slots": s["total_slots"],
            "fast_charger": "Yes" if s["fast_charger"] == 1 else "No",
            "rating": s["average_rating"],
            "reviews": s["review_count"],
            "latitude": s["latitude"],
            "longitude": s["longitude"]
        })

    # sort by distance
    nearby.sort(key=lambda x: x["distance_km"])

    return nearby[:5]     # return top 5 nearest
