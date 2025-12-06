from flask import Blueprint, request, jsonify
import google.generativeai as genai
from ..db_config import get_db_connection
import math
import os

chat = Blueprint("chat", __name__)

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

MODEL = "models/gemini-2.0-flash"   # ✔ stable & supported model


# ----------------------------
# Haversine distance function
# ----------------------------
def calc_distance(lat1, lon1, lat2, lon2):
    R = 6371  # KM
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)

    a = (math.sin(d_lat/2) ** 2 +
         math.cos(math.radians(lat1)) *
         math.cos(math.radians(lat2)) *
         math.sin(d_lon/2) ** 2)

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# ----------------------------
# DB nearest station finder
# ----------------------------
def find_nearest_station(user_lat, user_lng):
    try:
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        cursor.execute("SELECT * FROM stations")
        stations = cursor.fetchall()

        nearest = None
        min_dist = 10e9

        for s in stations:
            try:
                slat = float(s["latitude"])
                slng = float(s["longitude"])
            except:
                continue  # skip bad rows

            d = calc_distance(user_lat, user_lng, slat, slng)

            if d < min_dist:
                min_dist = d
                nearest = s

        if not nearest:
            return None

        nearest["distance_km"] = round(min_dist, 2)
        return nearest

    except Exception as e:
        print("NEAREST STATION ERROR:", e)
        return None


# ----------------------------
# CHATBOT API
# ----------------------------
@chat.route("", methods=["POST"])
def chat_api():
    try:
        data = request.get_json()
        messages = data.get("messages", [])
        last_msg = messages[-1]["text"].lower() if messages else ""

        # -----------------------------------------
        # Detect "my location is lat, lng"
        # -----------------------------------------
        if last_msg.startswith("my location is"):
            try:
                raw = last_msg.replace("my location is", "").strip()
                lat_str, lng_str = raw.split(",")
                user_lat = float(lat_str)
                user_lng = float(lng_str)

                nearest = find_nearest_station(user_lat, user_lng)

                if not nearest:
                    return jsonify({"answer": "❌ No charging stations found near you."})

                reply = f"""
📍 **Nearest EV Charging Station Found!**

**🔌 {nearest['name']}**
📍 Location: {nearest['location']}
📏 Distance: {nearest['distance_km']} km
⚡ Price: ₹{nearest['price_per_kwh']} per kWh

Type **'navigate'** to get routing instructions.
"""
                return jsonify({"answer": reply})

            except Exception as e:
                print("LOCATION PARSE ERROR:", e)
                return jsonify({"answer": "⚠ Could not understand your location. Try again like:\n\n`my location is 12.97, 77.59`"})

        # -----------------------------------------
        # Standard Gemini Chat Response
        # -----------------------------------------
        gemini_messages = [
            {"role": "user", "parts": msg["text"]}
            for msg in messages
        ]

        model = genai.GenerativeModel(MODEL)
        response = model.generate_content(gemini_messages)

        return jsonify({"answer": response.text})

    except Exception as e:
        print("CHAT API ERROR:", e)
        return jsonify({"answer": "⚠ Server temporarily unavailable."}), 500
