from flask import Blueprint, request, jsonify
from ..db_config import get_db_connection
from datetime import datetime, timedelta
import pytz, jwt, requests, os, math
from urllib.parse import quote
import razorpay
import random
from decimal import Decimal

# 🔌 SocketIO for real-time updates
from ..socket_manager import socketio

# 🔹 Blueprint
reservations_bp = Blueprint("reservations", __name__)

# 🔹 Env variables
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "secret123")
GOOGLE_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", None)
BREVO_API_KEY = os.getenv("BREVO_API_KEY", None)
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# ================= TIMEZONE =================
IST = pytz.timezone("Asia/Kolkata")
def now_ist():
    return datetime.now(IST)
def to_ist(dt):
    if dt is None: return None
    if dt.tzinfo is None: return IST.localize(dt)
    return dt.astimezone(IST)

# ================= HELPERS =================
def decode_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload["user_id"], payload.get("role")
    except Exception:
        return None, None

def haversine_distance(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(float, [lat1, lon1, lat2, lon2])
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def get_travel_time(user_lat, user_lng, station_lat, station_lng):
    try:
        user_lat, user_lng, station_lat, station_lng = map(float, [user_lat, user_lng, station_lat, station_lng])
    except:
        return 5
    if GOOGLE_API_KEY and GOOGLE_API_KEY != "YOUR_API_KEY_HERE":
        url = "https://maps.googleapis.com/maps/api/distancematrix/json"
        params = {
            "origins": f"{user_lat},{user_lng}",
            "destinations": f"{station_lat},{station_lng}",
            "mode": "driving",
            "key": GOOGLE_API_KEY
        }
        try:
            resp = requests.get(url, params=params, timeout=5)
            resp.raise_for_status()
            data = resp.json()
            if data.get("status")=="OK" and data.get("rows") and data["rows"][0]["elements"][0].get("status")=="OK":
                return int(data["rows"][0]["elements"][0]["duration"]["value"] // 60)
        except Exception as e:
            print("Google Maps API error:", e)
    distance_km = haversine_distance(user_lat, user_lng, station_lat, station_lng)
    return max(1, int((distance_km/40)*60))

# ---------- REAL-TIME BROADCAST HELPER ----------
def emit_station_availability(station_id):
    """
    Emit current availability for a station via WebSocket.
    Event name: 'station_availability'
    Payload: { station_id, total_slots, active_reservations, available_slots, timestamp }
    """
    if not station_id:
        return

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT total_slots FROM stations WHERE id=%s", (station_id,))
        station = cursor.fetchone()
        if not station:
            return

        cursor.execute("""
            SELECT COUNT(*) AS active_count
            FROM reservations
            WHERE station_id=%s
              AND status='active'
        """, (station_id,))
        count_row = cursor.fetchone() or {"active_count": 0}

        total_slots = station.get("total_slots", 0) or 0
        active_res = count_row.get("active_count", 0) or 0
        available_slots = max(0, total_slots - active_res)

        payload = {
            "station_id": station_id,
            "total_slots": total_slots,
            "active_reservations": active_res,
            "available_slots": available_slots,
            "timestamp": now_ist().isoformat()
        }
        socketio.emit("station_availability", payload, broadcast=True)
        print("📡 Emitted station_availability:", payload)
    except Exception as e:
        print("❌ emit_station_availability error:", e)
    finally:
        cursor.close()
        conn.close()

# Add this at the top of reservations.py (after imports)
def send_email(to_email, subject, html_content):
    """Generic email sender using Brevo"""
    try:
        if not BREVO_API_KEY:
            print("⚠️ No BREVO_API_KEY set, skipping email send.")
            return False
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": BREVO_API_KEY,
            "content-type": "application/json",
        }
        payload = {
            "sender": {"name": "EV ChargeSmart", "email": "evsmartchargingstation@gmail.com"},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_content,
        }
        res = requests.post(url, json=payload, headers=headers, timeout=5)
        if res.status_code in [200, 201, 202]:
            print(f"✅ Email sent to {to_email}")
            return True
        else:
            print("❌ Brevo error:", res.status_code, res.text)
            return False
    except Exception as e:
        print("❌ Email send error:", str(e))
        return False


def cleanup_reservations():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    now = datetime.utcnow()

    # Track stations whose reservations changed (for WebSocket updates)
    affected_station_ids = set()

    # 1️⃣ Expire reservations where ETA expired but charging never started
    cursor.execute("""
        SELECT r.id, r.station_id, u.email, s.name AS station_name, s.id AS station_id
        FROM reservations r
        JOIN users u ON r.user_id=u.id
        JOIN stations s ON r.station_id=s.id
        WHERE r.expire_time < %s
          AND (r.charging_status IS NULL OR r.charging_status='pending')
          AND r.status='active'
    """, (now,))
    expired_rows = cursor.fetchall() or []

    cursor.execute("""
        UPDATE reservations
        SET status='expired',
            charging_status='expired'
        WHERE expire_time < %s
          AND (charging_status IS NULL OR charging_status='pending')
          AND status='active'
    """, (now,))

    for row in expired_rows:
        if row.get("station_id"):
            affected_station_ids.add(row["station_id"])

    # 2️⃣ Auto-stop charging when duration exceeded
    cursor.execute("""
        SELECT r.id, r.station_id, u.email, s.name AS station_name, s.id AS station_id
        FROM reservations r
        JOIN users u ON r.user_id=u.id
        JOIN stations s ON r.station_id=s.id
        WHERE r.charging_status='running'
          AND TIMESTAMPADD(MINUTE, r.duration, r.charging_start_time) <= %s
    """, (now,))
    stopped_rows = cursor.fetchall() or []

    cursor.execute("""
        UPDATE reservations
        SET status='completed',
            charging_status='stopped',
            charging_end_time=%s
        WHERE charging_status='running'
          AND TIMESTAMPADD(MINUTE, duration, charging_start_time) <= %s
    """, (now, now))

    for row in stopped_rows:
        if row.get("station_id"):
            affected_station_ids.add(row["station_id"])

    conn.commit()
    cursor.close()
    conn.close()

    # 3️⃣ WebSocket: emit new availability for all affected stations
    for sid in affected_station_ids:
        emit_station_availability(sid)

    # 4️⃣ Send notifications
    for row in expired_rows:
        send_email(
            to_email=row["email"],
            subject="Reservation Expired - EV ChargeSmart",
            html_content=f"""
                <p>Your reservation at <b>{row['station_name']}</b> has expired because ETA time passed without starting charging.</p>
                <p>Please make a new reservation if you still need charging.</p>
            """
        )

    for row in stopped_rows:
        send_email(
            to_email=row["email"],
            subject="Charging Session Completed - EV ChargeSmart",
            html_content=f"""
                <p>Your charging session at <b>{row['station_name']}</b> has been automatically stopped as the reserved duration ended.</p>
                <p>Thank you for using EV ChargeSmart 🚗⚡</p>
            """
        )


def send_reservation_email(email, station_name, location, eta_time, expiry_time, maps_url, otp, username="User"):
    maps_url_encoded = quote(maps_url, safe=':/?=&,')
    html = f"""
    <h2>Reservation Confirmed ✅</h2>
    <p>{username}, your charging slot has been reserved successfully.</p>
    <ul>
        <li><b>Station:</b> {station_name}</li>
        <li><b>Location:</b> {location}</li>
        <li><b>ETA (IST):</b> {to_ist(eta_time).strftime('%Y-%m-%d %I:%M:%S %p')}</li>
        <li><b>Expiry (IST):</b> {to_ist(expiry_time).strftime('%Y-%m-%d %I:%M:%S %p')}</li>
        <li><b>OTP for verification:</b> <span style="font-size:18px;color:#007bff;">{otp}</span></li>
    </ul>
    <p><a href="{maps_url_encoded}" target="_blank" style="background:#007bff;color:white;padding:10px 15px;text-decoration:none;border-radius:5px;">Get Directions on Google Maps</a></p>
    <p>⚡ Thank you for choosing EV ChargeSmart!</p>
    """
    return send_email(email, "EV ChargeSmart - Reservation Confirmation", html)


def send_owner_email(owner_email, username, user_email, station_name, booking_time, eta_time, expiry_time, maps_url):
    maps_url_encoded = quote(maps_url, safe=':/?=&,')
    html = f"""
    <h2>New Reservation ✅</h2>
    <p>{username} ({user_email}) has reserved a slot at your station {station_name}.</p>
    <ul>
        <li><b>Booking Time:</b> {to_ist(booking_time).strftime('%Y-%m-%d %I:%M:%S %p')}</li>
        <li><b>ETA:</b> {to_ist(eta_time).strftime('%Y-%m-%d %I:%M:%S %p')}</li>
        <li><b>Expiry:</b> {to_ist(expiry_time).strftime('%Y-%m-%d %I:%M:%S %p')}</li>
    </ul>
    <p><a href="{maps_url_encoded}" target="_blank" style="background:#28a745;color:white;padding:10px 15px;text-decoration:none;border-radius:5px;">View User Route on Google Maps</a></p>
    """
    return send_email(owner_email, f"New Reservation at {station_name}", html)

# ================= PAYMENT =================
def create_razorpay_order(amount, currency="INR"):
    paisa_amount = math.floor(Decimal(amount) * 100)
    order = razorpay_client.order.create({
        "amount": paisa_amount,
        "currency": currency,
        "payment_capture": 1
    })
    return order


def refund_payment(payment_id):
    try:
        payment = razorpay_client.payment.fetch(payment_id)
        amount = payment["amount"]
        refund = razorpay_client.payment.refund(payment_id, {"amount": amount})
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE payments SET status='refunded' WHERE payment_id=%s", (payment_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return refund
    except Exception as e:
        print("Refund failed:", e)
        return None

# ------------------ Payment order ------------------
@reservations_bp.route("/payment/order", methods=["POST"])
def create_payment_order():
    try:
        token = request.headers.get("Authorization","").replace("Bearer ","")
        user_id,_ = decode_token(token)
        if not user_id: return jsonify({"error":"Unauthorized"}),401

        data = request.json or {}
        station_id = data.get("station_id")
        duration = int(data.get("duration", 30))  # minutes
        if not station_id: return jsonify({"error":"Missing station_id"}),400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("SELECT price_per_kwh FROM stations WHERE id=%s",(station_id,))
            station = cursor.fetchone()
            if not station: return jsonify({"error":"Station not found"}),404

            # 💰 Calculate price based on duration
            gst = 0.18
            hours = max(0.25, float(duration) / 60.0)  # minimum 15 mins = 0.25 hr
            amount = (float(station.get("price_per_kwh", 0)) * hours)+(gst*float(station.get("price_per_kwh", 0)) * hours)

            order = create_razorpay_order(amount)

            cursor.execute(
                "INSERT INTO payments (user_id,station_id,order_id,amount,status,created_at) VALUES (%s,%s,%s,%s,'created',%s)",
                (user_id, station_id, order["id"], amount, now_ist())
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()

        return jsonify({"order": order, "razorpay_key": RAZORPAY_KEY_ID}),200
    except Exception as e:
        print("Razorpay order creation failed:", e)
        return jsonify({"error":"Payment order creation failed"}),500


# ------------------------------
# 🔹 VERIFY PAYMENT
# ------------------------------
@reservations_bp.route("/payment/verify", methods=["POST"])
def verify_payment():
    try:
        data = request.json
        payment_id = data.get("payment_id")
        order_id = data.get("order_id")
        signature = data.get("signature")

        if not all([payment_id, order_id, signature]):
            return jsonify({"error": "Missing payment details"}), 400

        # 🔹 Verify Razorpay signature
        params_dict = {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        }
        razorpay_client.utility.verify_payment_signature(params_dict)

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 🔹 Update payments table (not reservations!)
        cursor.execute("""
            UPDATE payments
            SET status='paid', payment_id=%s, created_at=%s
            WHERE order_id=%s
        """, (payment_id, now_ist(), order_id))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"success": True, "payment_id": payment_id})

    except razorpay.errors.SignatureVerificationError:
        return jsonify({"error": "Invalid payment signature"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ------------------ Create reservation ------------------
@reservations_bp.route("/create", methods=["POST"])
def create_reservation():
    # 🔑 Authenticate user
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id, _ = decode_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # 🔹 Parse request data
    data = request.json or {}
    station_id = data.get("station_id")
    user_lat = data.get("latitude")
    user_lng = data.get("longitude")
    payment_id = data.get("payment_id")
    duration = int(data.get("duration", 30))  # default 30 minutes

    if not station_id or user_lat is None or user_lng is None or not payment_id:
        return jsonify({"error": "Missing required data"}), 400

    conn = get_db_connection()
    try:
        # Use buffered cursor to avoid 'Unread result found'
        cursor = conn.cursor(dictionary=True, buffered=True)

        # ✅ Check if user already has an active reservation that is not expired
        cursor.execute("""
            SELECT id 
            FROM reservations
            WHERE user_id=%s 
              AND status='active'
              AND expire_time > NOW()
        """, (user_id,))
        active_res = cursor.fetchone()
        if active_res:
            return jsonify({
                "error": "You already have an active reservation. Complete, cancel, or wait for it to expire before booking again."
            }), 400

        # ✅ Verify payment
        cursor.execute("""
            SELECT * FROM payments 
            WHERE payment_id=%s AND user_id=%s AND status='paid'
        """, (payment_id, user_id))
        pay_record = cursor.fetchone()
        if not pay_record:
            return jsonify({"error": "Payment not verified"}), 402

        # ✅ Fetch station info
        cursor.execute("""
            SELECT latitude, longitude, name, location, owner_id 
            FROM stations WHERE id=%s
        """, (station_id,))
        station = cursor.fetchone()
        if not station:
            return jsonify({"error": "Station not found"}), 404

        # 🔹 Calculate times
        created_at = now_ist()
        eta_time = created_at + timedelta(minutes=5)
        expire_time = eta_time + timedelta(minutes=duration)

        # 🔑 Generate OTP
        otp = str(random.randint(100000, 999999))

        # ✅ Insert reservation
        cursor.execute("""
            INSERT INTO reservations 
            (user_id, station_id, eta_time, expire_time, created_at, paid_amount, 
             payment_id, payment_status, otp, duration, status, charging_status) 
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'active','pending')
        """, (
            user_id,
            station_id,
            eta_time,
            expire_time,
            created_at,
            pay_record["amount"],
            payment_id,
            pay_record["status"],
            otp,
            duration,
        ))
        conn.commit()
        reservation_id = cursor.lastrowid

        # ✅ Fetch user info
        cursor.execute("SELECT email, username FROM users WHERE id=%s", (user_id,))
        user_row = cursor.fetchone() or {}
        user_email = user_row.get("email")
        username = user_row.get("username") or "User"

    finally:
        cursor.close()
        conn.close()

    # ✅ Real-time: emit updated station availability
    emit_station_availability(station_id)

    # ✅ Generate Google Maps URL
    maps_url = f"https://www.google.com/maps/dir/?api=1&origin={user_lat},{user_lng}&destination={station['latitude']},{station['longitude']}&travelmode=driving"

    # ✅ Send reservation email
    if user_email:
        send_reservation_email(
            user_email,
            station["name"],
            station["location"],
            eta_time,
            expire_time,
            maps_url,
            otp,
            username,
        )

    # ✅ Return response
    return jsonify({
        "message": "Reservation created",
        "reservation_id": reservation_id,
        "eta_time": eta_time.isoformat(),
        "expires_at": expire_time.isoformat(),
        "navigation_url": maps_url,
        "otp": otp,
    }), 200


# ------------------ Verify OTP ------------------
@reservations_bp.route("/verify-otp", methods=["POST"])
def verify_reservation_otp():
    data = request.json
    reservation_id = data.get("reservation_id")
    otp = data.get("otp")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM reservations WHERE id=%s AND otp=%s", (reservation_id, otp))
    reservation = cursor.fetchone()
    cursor.close()
    conn.close()

    if reservation:
        return jsonify({"verified": True, "message": "OTP verified, access granted"}), 200
    return jsonify({"verified": False, "message": "Invalid OTP"}), 400

# ------------------ Owner cancel reservation ------------------
@reservations_bp.route("/owner/cancel/<int:reservation_id>", methods=["DELETE"])
def owner_cancel_reservation(reservation_id):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    owner_id, _ = decode_token(token)
    if not owner_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    station_id = None
    try:
        cursor.execute("""
            SELECT r.*, s.name AS station_name, s.owner_id, s.id AS station_id,
                   u.username AS user_name, u.email AS user_email, r.payment_id
            FROM reservations r
            JOIN stations s ON r.station_id=s.id
            JOIN users u ON r.user_id=u.id
            WHERE r.id=%s AND s.owner_id=%s
        """, (reservation_id, owner_id))
        reservation = cursor.fetchone()
        if not reservation:
            return jsonify({"error": "Reservation not found or not owned by you"}), 404

        station_id = reservation.get("station_id")

        cursor.execute("DELETE FROM reservations WHERE id=%s", (reservation_id,))
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    # Real-time: update station availability
    if station_id:
        emit_station_availability(station_id)

    if reservation.get("payment_id"):
        refund_payment(reservation["payment_id"])

    if reservation.get("user_email"):
        html = f"""
        <h2>Reservation Cancelled by Owner ❌</h2>
        <p>Your reservation at {reservation['station_name']} has been cancelled by the station owner. Payment has been refunded.</p>
        """
        send_email(reservation["user_email"], "EV ChargeSmart - Reservation Cancelled", html)

    return jsonify({"message": "Reservation canceled by owner and refunded"}), 200



# ================= ROUTES =================

# --- User reservations ---
@reservations_bp.route("/my", methods=["GET"])
def get_my_reservations():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id, _ = decode_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # 🧹 Clean up expired/completed reservations for this user (also emits WebSocket updates)
    cleanup_reservations()

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
        SELECT r.id, r.eta_time, r.expire_time, r.created_at,
               r.charging_status, r.charging_start_time, r.duration,
               s.id AS station_id, s.name AS station_name, s.location,
               s.latitude, s.longitude
        FROM reservations r
        JOIN stations s ON r.station_id = s.id
        WHERE r.user_id = %s
        ORDER BY r.created_at DESC
        """, (user_id,))
        rows = cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

    out = []
    for r in rows:
        expire_time_ist = to_ist(r["expire_time"]) if r.get("expire_time") else None
        charging_status = r.get("charging_status")
        charging_start_ist = to_ist(r["charging_start_time"]) if r.get("charging_start_time") else None
        charging_end_ist = (
            charging_start_ist + timedelta(minutes=r["duration"])
            if charging_start_ist and r.get("duration")
            else None
        )

        # ✅ Smart status logic
        status = "past"
        if charging_status == "running":
            if charging_end_ist and now_ist() < charging_end_ist:
                status = "active"
            else:
                status = "past"
        elif charging_status in ("stopped", "completed"):
            status = "past"
        else:
            if expire_time_ist and expire_time_ist > now_ist():
                status = "active"
            else:
                status = "past"

        out.append({
            "id": r["id"],
            "station_id": r.get("station_id"),
            "station_name": r.get("station_name"),
            "location": r.get("location"),
            "latitude": r.get("latitude"),
            "longitude": r.get("longitude"),
            "eta_time": to_ist(r["eta_time"]).isoformat() if r.get("eta_time") else None,
            "expire_time": expire_time_ist.isoformat() if expire_time_ist else None,
            "created_at": to_ist(r["created_at"]).isoformat() if r.get("created_at") else None,
            "status": status,
            "charging_status": charging_status,
            "charging_start_time": charging_start_ist.isoformat() if charging_start_ist else None,
            "charging_end_time": charging_end_ist.isoformat() if charging_end_ist else None,
        })

    return jsonify(out)

# --- All reservations (for availability) ---
@reservations_bp.route("/all", methods=["GET"])
def get_all_reservations():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id, _ = decode_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    cleanup_reservations()
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
        SELECT r.id,r.station_id,r.eta_time,r.expire_time,r.created_at,
               r.charging_status,r.charging_start_time,r.duration,
               s.name AS station_name,s.location
        FROM reservations r
        JOIN stations s ON r.station_id=s.id
        ORDER BY r.created_at DESC
        """)
        rows = cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

    out = []
    for r in rows:
        expire_time_ist = to_ist(r["expire_time"]) if r.get("expire_time") else None
        charging_status = r.get("charging_status")
        status = "past"

        if charging_status == "running":
            if r.get("charging_start_time") and r.get("duration"):
                end_time = to_ist(r["charging_start_time"]) + timedelta(minutes=r["duration"])
                if now_ist() < end_time:
                    status = "active"
                else:
                    status = "past"
            else:
                status = "active"
        elif charging_status in ("stopped", "completed"):
            status = "past"
        else:
            if expire_time_ist and expire_time_ist > now_ist():
                status = "active"
            else:
                status = "past"

        out.append({
            "id": r["id"],
            "station_id": r.get("station_id"),
            "station_name": r.get("station_name"),
            "location": r.get("location"),
            "eta_time": to_ist(r["eta_time"]).isoformat() if r.get("eta_time") else None,
            "expire_time": expire_time_ist.isoformat() if expire_time_ist else None,
            "created_at": to_ist(r["created_at"]).isoformat() if r.get("created_at") else None,
            "status": status
        })
    return jsonify(out)


# --- Owner dashboard: view reservations ---
@reservations_bp.route("/owner/reservations", methods=["GET"])
def get_station_reservations():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    owner_id, _ = decode_token(token)
    if not owner_id:
        return jsonify({"error": "Unauthorized"}), 401

    # global cleanup (expire old reservations)
    cleanup_reservations()

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id, name, location, total_slots
            FROM stations
            WHERE owner_id=%s
        """, (owner_id,))
        stations = cursor.fetchall()

        cursor.execute("""
            SELECT r.id AS reservation_id,
                   r.eta_time, r.expire_time, r.created_at,
                   r.charging_status, r.charging_start_time, r.duration,
                   s.id AS station_id, s.name AS station_name, s.location AS station_location, s.total_slots,
                   u.id AS user_id, u.username, u.email
            FROM reservations r
            JOIN stations s ON r.station_id = s.id
            JOIN users u ON r.user_id = u.id
            WHERE s.owner_id = %s
            ORDER BY r.created_at DESC
        """, (owner_id,))
        reservations = cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

    grouped = {}
    for r in reservations:
        expire_time = to_ist(r["expire_time"]) if r.get("expire_time") else None
        charging_status = r.get("charging_status")
        status = "expired"

        if charging_status == "running":
            if r.get("charging_start_time") and r.get("duration"):
                end_time = to_ist(r["charging_start_time"]) + timedelta(minutes=r["duration"])
                status = "active" if now_ist() < end_time else "expired"
            else:
                status = "active"
        elif charging_status in ("stopped", "completed"):
            status = "expired"
        else:
            if expire_time and expire_time > now_ist():
                status = "active"

        station_id = r["station_id"]
        if station_id not in grouped:
            grouped[station_id] = {
                "station_id": station_id,
                "station_name": r["station_name"],
                "station_location": r["station_location"],
                "total_slots": r.get("total_slots", 0),
                "reservations": []
            }

        grouped[station_id]["reservations"].append({
            "reservation_id": r["reservation_id"],
            "user_id": r["user_id"],
            "username": r["username"],
            "user_email": r["email"],
            "eta_time": to_ist(r["eta_time"]).isoformat() if r.get("eta_time") else None,
            "expire_time": expire_time.isoformat() if expire_time else None,
            "created_at": to_ist(r["created_at"]).isoformat() if r.get("created_at") else None,
            "status": status
        })

    # recalc slots
    for station in grouped.values():
        reserved_count = sum(1 for r in station["reservations"] if r["status"] == "active")
        station["reserved_slots"] = reserved_count
        station["available_slots"] = max(0, station["total_slots"] - reserved_count)

    return jsonify(list(grouped.values()))


# --- Cancel reservation (by user) ---
@reservations_bp.route("/cancel/<int:reservation_id>", methods=["DELETE"])
def cancel_reservation(reservation_id):
    token = request.headers.get("Authorization","").replace("Bearer ","")
    user_id,_ = decode_token(token)
    if not user_id: return jsonify({"error":"Unauthorized"}),401

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    station_id = None
    try:
        cursor.execute("""
        SELECT r.*, s.name AS station_name, s.owner_id, s.id AS station_id,
               u.username AS user_name, u.email AS user_email
        FROM reservations r
        JOIN stations s ON r.station_id=s.id
        JOIN users u ON r.user_id=u.id
        WHERE r.id=%s AND r.user_id=%s
        """,(reservation_id,user_id))
        reservation = cursor.fetchone()
        if not reservation: return jsonify({"error":"Reservation not found or not owned"}),404

        station_id = reservation.get("station_id")

        cursor.execute("DELETE FROM reservations WHERE id=%s AND user_id=%s",(reservation_id,user_id))
        conn.commit()

        owner_email = None
        if reservation.get("owner_id"):
            cursor.execute("SELECT email FROM users WHERE id=%s",(reservation["owner_id"],))
            owner_row = cursor.fetchone()
            owner_email = owner_row.get("email") if owner_row else None
    finally:
        cursor.close()
        conn.close()

    # Real-time: update station availability
    if station_id:
        emit_station_availability(station_id)

    if reservation.get("user_email"):
        html = f"<h2>Reservation Cancelled ❌</h2><p>Your reservation at {reservation['station_name']} has been cancelled.</p>"
        send_email(reservation["user_email"], "EV ChargeSmart - Reservation Cancelled", html)
    if owner_email:
        html = f"<h2>Reservation Cancelled ❌</h2><p>Reservation by {reservation['user_name']} at {reservation['station_name']} has been cancelled.</p>"
        send_email(owner_email, f"Reservation Cancelled at {reservation['station_name']}", html)

    return jsonify({"message":"Reservation canceled"}),200
