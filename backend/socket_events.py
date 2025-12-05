from backend.app import socketio
from flask_socketio import emit

# When a slot becomes occupied or free
def broadcast_slot_update(station_id, slot_id, status):
    socketio.emit(
        "slot_update",
        {
            "station_id": station_id,
            "slot_id": slot_id,
            "status": status
        },
        broadcast=True
    )

# When charging starts
def broadcast_charging_start(station_id, user_id, duration):
    socketio.emit(
        "charging_start",
        {
            "station_id": station_id,
            "user_id": user_id,
            "duration": duration  # seconds
        },
        broadcast=True
    )

# When charging stops
def broadcast_charging_stop(station_id, user_id):
    socketio.emit(
        "charging_stop",
        {
            "station_id": station_id,
            "user_id": user_id
        },
        broadcast=True
    )
