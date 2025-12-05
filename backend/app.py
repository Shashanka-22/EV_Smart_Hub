# 📄 backend/app.py

from flask import Flask, jsonify, request, make_response, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os

# ------------------------------------------------------
# 🔌 IMPORT GLOBAL SOCKET.IO INSTANCE (NO CIRCULAR IMPORT)
# ------------------------------------------------------
from backend.socketio_instance import socketio   # ⭐ FIXED

# Load environment variables
load_dotenv()


def create_app():
    app = Flask(__name__)

    # ------------------------------------------------------
    # 🌍 GLOBAL CORS FOR ALL ROUTES
    # ------------------------------------------------------
    CORS(
        app,
        resources={r"/*": {"origins": "*"}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    # ------------------------------------------------------
    # 🛡 UNIVERSAL OPTIONS HANDLER
    # ------------------------------------------------------
    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            response = make_response(jsonify({"status": "ok"}), 200)
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = (
                "GET, POST, PUT, DELETE, OPTIONS"
            )
            response.headers["Access-Control-Allow-Headers"] = (
                "Content-Type, Authorization"
            )
            response.headers["Access-Control-Max-Age"] = "3600"
            return response
        return None

    # ------------------------------------------------------
    # 🔗 REGISTER ALL BLUEPRINTS (AFTER APP CREATED)
    # ------------------------------------------------------
    from backend.api.auth import auth_bp
    from backend.api.reservations import reservations_bp
    from backend.api.predict import predict_bp
    from backend.api.station import station_bp
    from backend.api.battery import battery_bp
    from backend.api.owner import owner_bp
    from backend.api.trip_planner import trip_bp
    from backend.api.admin import admin_bp
    from backend.api.advanced_trip import advanced_trip_bp
    from backend.api.user_profile import user_profile_bp
    from backend.api.user_security import user_security_bp
    from backend.api.reviews import reviews_bp
    from backend.api.emergency import emergency_bp

    from backend.routes.invoice import invoice
    from backend.routes.chat import chat
    from backend.api.owner_analytics import owner_analytics_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(reservations_bp, url_prefix="/api/reservations")
    app.register_blueprint(predict_bp, url_prefix="/api/predict")
    app.register_blueprint(station_bp, url_prefix="/api/stations")
    app.register_blueprint(battery_bp, url_prefix="/api/battery")
    app.register_blueprint(owner_bp, url_prefix="/api/owner")
    app.register_blueprint(trip_bp, url_prefix="/api/trip")
    app.register_blueprint(invoice, url_prefix="/api/invoice")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(chat, url_prefix="/api/chat")
    app.register_blueprint(advanced_trip_bp, url_prefix="/api/advanced-trip")
    app.register_blueprint(owner_analytics_bp, url_prefix="/api/owner/analytics")
    app.register_blueprint(user_profile_bp, url_prefix="/api/user")
    app.register_blueprint(user_security_bp, url_prefix="/api/user")
    app.register_blueprint(reviews_bp, url_prefix="/api")
    app.register_blueprint(emergency_bp, url_prefix="/api/support")

    # ------------------------------------------------------
    # ⭐ STATIC ROUTE FOR PROFILE IMAGES
    # ------------------------------------------------------
    @app.route("/uploads/profile/<path:filename>")
    def serve_profile_image(filename):
        folder = os.path.abspath("uploads/profile")
        return send_from_directory(folder, filename)

    # ------------------------------------------------------
    # Root / Landing Route
    # ------------------------------------------------------
    @app.route("/")
    def index():
        return {"message": "EV Smart Charging Backend Running ✅"}

    # ------------------------------------------------------
    # Health Check API
    # ------------------------------------------------------
    @app.route("/health")
    def health():
        return jsonify(status="ok", service="EV Smart Charging API"), 200

    # ------------------------------------------------------
    # GLOBAL ERROR HANDLER
    # ------------------------------------------------------
    @app.errorhandler(Exception)
    def handle_exception(e):
        print("🔥 GLOBAL ERROR:", e)
        return jsonify({"error": str(e)}), 500

    # ------------------------------------------------------
    # 🔌 INIT SOCKET.IO WITH APP
    # ------------------------------------------------------
    socketio.init_app(app)

    return app


# 🚀 BACKEND STARTER
if __name__ == "__main__":
    app = create_app()

    # Debug route printing
    if app.debug:
        print("\n📌 Registered Routes:")
        for rule in app.url_map.iter_rules():
            methods = ",".join(sorted(rule.methods))
            print(f"{methods:20s} -> {rule}")

    # ⭐ IMPORTANT: Always use socketio.run to support WebSockets
    socketio.run(app, debug=True, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)
