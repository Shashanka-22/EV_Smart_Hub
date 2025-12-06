# 📄 backend/api/predict.py
from flask import Blueprint, request, jsonify
import numpy as np
import joblib
from keras.models import load_model
from datetime import datetime, timedelta
from ..db_config import get_db_connection
import requests, os, math, traceback

# ---------------- Blueprint ----------------
predict_bp = Blueprint('predict', __name__)

# ---------------- Model & Scaler ----------------
model = load_model('models/wait_model.h5', compile=False)
scaler = joblib.load('models/scaler.pkl')

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "YOUR_API_KEY_HERE")

# ---------------- Helpers ----------------
def calculate_distance(lat1, lon1, lat2, lon2):
    """Haversine distance in km"""
    try:
        R = 6371
        lat1, lon1, lat2, lon2 = map(float, [lat1, lon1, lat2, lon2])
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)
    except:
        return 0

def get_travel_time(user_lat, user_lng, station_lat, station_lng):
    """ETA in minutes using Google Maps API, fallback to Haversine at 40 km/h"""
    try:
        user_lat, user_lng, station_lat, station_lng = map(float, [user_lat, user_lng, station_lat, station_lng])
    except:
        return 5

    # Try Google Maps Distance Matrix API
    if GOOGLE_API_KEY and GOOGLE_API_KEY != "YOUR_API_KEY_HERE":
        try:
            url = "https://maps.googleapis.com/maps/api/distancematrix/json"
            params = {
                "origins": f"{user_lat},{user_lng}",
                "destinations": f"{station_lat},{station_lng}",
                "mode": "driving",
                "key": GOOGLE_API_KEY,
            }
            resp = requests.get(url, params=params, timeout=5)
            resp.raise_for_status()
            data = resp.json()
            element = data.get("rows", [{}])[0].get("elements", [{}])[0]
            if data.get("status") == "OK" and element.get("status") == "OK":
                return int(element["duration"]["value"] // 60)
        except Exception as e:
            print("Google Maps API error:", e)

    # Fallback: Haversine distance / 40 km/h
    distance_km = calculate_distance(user_lat, user_lng, station_lat, station_lng)
    return max(1, int((distance_km / 40) * 60))

# ---------------- Routes ----------------
@predict_bp.route('', methods=['POST'])
def predict_wait_time():
    try:
        data = request.json
        station_id = data.get('station_id')
        user_lat = data.get('user_lat')
        user_lng = data.get('user_lng')

        if not all([station_id, user_lat, user_lng]):
            return jsonify({'error': 'station_id, user_lat, and user_lng are required'}), 400

        # Fetch station details
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT total_slots, latitude, longitude FROM stations WHERE id = %s", (station_id,))
        station = cursor.fetchone()
        cursor.close()
        conn.close()

        if not station:
            return jsonify({'error': 'Station not found'}), 404

        total_slots = int(station['total_slots'])
        station_lat = float(station['latitude'])
        station_lng = float(station['longitude'])

        # Calculate ETA automatically
        eta_minutes = get_travel_time(user_lat, user_lng, station_lat, station_lng)

        # Generate time series input (last 24 hours + ETA hour)
        now = datetime.now()
        time_steps = np.array([(now - timedelta(hours=i)).hour for i in range(23, -1, -1)])
        time_steps = np.append(time_steps, (now + timedelta(minutes=eta_minutes)).hour)

        # Simulate occupancy pattern (replace with real DB values if available)
        sample_pattern = 4 + 2 * np.sin(2 * np.pi * time_steps / 24)
        sample_pattern = scaler.transform(sample_pattern.reshape(-1, 1))
        X_input = sample_pattern[-24:].reshape(1, 24, 1)

        # Predict
        prediction = model.predict(X_input)
        predicted_slots = float(scaler.inverse_transform(prediction).flatten()[0])
        predicted_free_slots = int(max(0, total_slots - predicted_slots))
        can_reserve = bool(predicted_free_slots >= 1)

        return jsonify({
            'station_id': int(station_id),
            'predicted_occupied_slots': round(predicted_slots, 2),
            'predicted_free_slots': predicted_free_slots,
            'eta_minutes': int(eta_minutes),
            'can_reserve': can_reserve,
            'message': f"{'Slot available' if can_reserve else 'No slots predicted to be available'} for ETA {eta_minutes} mins"
        })

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500
