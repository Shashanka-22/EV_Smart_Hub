import requests
import os

GOOGLE_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

def find_nearby_chargers(user_location):
    """
    Returns top EV charging stations near given location.
    Supports both 'address text' or 'lat,long'
    """

    # Step 1: Convert address → coordinates
    geocode_url = f"https://maps.googleapis.com/maps/api/geocode/json?address={user_location}&key={GOOGLE_KEY}"
    geo_res = requests.get(geocode_url).json()

    if geo_res["status"] != "OK":
        return None

    lat = geo_res["results"][0]["geometry"]["location"]["lat"]
    lng = geo_res["results"][0]["geometry"]["location"]["lng"]

    # Step 2: Find EV stations nearby
    places_url = (
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        f"?location={lat},{lng}"
        f"&radius=5000"
        f"&keyword=EV charging station"
        f"&key={GOOGLE_KEY}"
    )

    places_res = requests.get(places_url).json()

    stations = []
    for place in places_res.get("results", [])[:5]:
        stations.append({
            "name": place["name"],
            "address": place.get("vicinity", "N/A"),
            "rating": place.get("rating", "N/A"),
            "lat": place["geometry"]["location"]["lat"],
            "lng": place["geometry"]["location"]["lng"]
        })

    return stations
