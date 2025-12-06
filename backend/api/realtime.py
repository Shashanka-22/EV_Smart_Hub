# backend/api/realtime.py
from flask import Blueprint
from ..app import socketio
from flask_socketio import Namespace, emit

class RealtimeNamespace(Namespace):
    def on_connect(self):
        print("Client connected:", request.sid)
    def on_disconnect(self):
        print("Client disconnected")
    def on_subscribe_station(self, data):
        # client asks to receive updates for station(s)
        station_id = data.get("station_id")
        if station_id:
            self.join_room(f"station_{station_id}")
    def on_unsubscribe_station(self, data):
        station_id = data.get("station_id")
        if station_id:
            self.leave_room(f"station_{station_id}")

# register namespace
socketio.on_namespace(RealtimeNamespace("/realtime"))
