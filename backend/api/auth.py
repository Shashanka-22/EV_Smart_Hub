# backend/api/auth.py
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import jwt, datetime, os, random, requests
from ..db_config import get_db_connection
from dotenv import load_dotenv
load_dotenv()

auth_bp = Blueprint("auth", __name__)
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "secret123")
APP_ENV = os.getenv("APP_ENV", "development")

# Brevo (Sendinblue) API key
BREVO_API_KEY = os.getenv("BREVO_API_KEY")

# Cooldown: 0s in dev, 60s in prod
OTP_RESEND_COOLDOWN_SECONDS = 0 if APP_ENV == "development" else 60
# Cap retry time (never show hours-long waits)
MAX_WAIT_SECONDS = 60


# ---------------------- EMAIL HELPERS ----------------------

def send_otp_email(email: str, otp: str):
    """Send OTP using Brevo API"""
    try:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": BREVO_API_KEY,
            "content-type": "application/json",
        }
        payload = {
            "sender": {"name": "smart EV charge", "email": "evsmartchargingstation@gmail.com"},
            "to": [{"email": email}],
            "subject": "EV ChargeSmart Email Verification",
            "htmlContent": f"<p>Your EV ChargeSmart OTP is <b>{otp}</b></p>",
        }
        res = requests.post(url, json=payload, headers=headers)
        if res.status_code in [200, 201, 202]:
            return True
        print("Brevo error:", res.status_code, res.text)
        return False
    except Exception as e:
        print("Email send error:", str(e))
        return False


def send_reservation_email(email: str, station_name: str, location: str,
                           eta: str, expiry_time: str,
                           maps_url: str = None, otp: str = None, username: str = None):
    """Send reservation confirmation email with optional OTP & maps link"""
    try:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": BREVO_API_KEY,
            "content-type": "application/json",
        }

        extra = ""
        if otp:
            extra += f"<li><b>OTP (for station verification):</b> {otp}</li>"
        if maps_url:
            extra += f"""
                <p>
                    <a href="{maps_url}" target="_blank"
                       style="background:#007bff;color:white;padding:10px 15px;text-decoration:none;border-radius:5px;">
                       Navigate with Google Maps
                    </a>
                </p>
            """

        payload = {
            "sender": {"name": "smart EV charge", "email": "evsmartchargingstation@gmail.com"},
            "to": [{"email": email}],
            "subject": "EV ChargeSmart - Reservation Confirmation",
            "htmlContent": f"""
                <h2>Reservation Confirmed ✅</h2>
                <p>Dear {username or "User"}, your charging slot has been reserved successfully.</p>
                <ul>
                    <li><b>Station:</b> {station_name}</li>
                    <li><b>Location:</b> {location}</li>
                    <li><b>ETA:</b> {eta}</li>
                    <li><b>Expiry Time:</b> {expiry_time}</li>
                    {extra}
                </ul>
                <p>⚡ Thank you for choosing EV ChargeSmart!</p>
            """,
        }

        res = requests.post(url, json=payload, headers=headers)
        return res.status_code in [200, 201, 202]

    except Exception as e:
        print("Email send error:", str(e))
        return False


# ---------------------- AUTH ROUTES ----------------------

# Step 1: Request OTP
@auth_bp.route("/register/request-otp", methods=["POST"])
def request_otp():
    data = request.json or {}
    name = data.get("name")
    email = data.get("email", "").strip()
    password = data.get("password")
    role = data.get("role", "user")

    if not all([name, email, password]):
        return jsonify({"error": "Missing required fields"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Prevent duplicate accounts
    cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cursor.fetchone():
        cursor.close(); conn.close()
        return jsonify({"error": "Email already registered"}), 409

    # Check cooldown
    cursor.execute(
        "SELECT created_at FROM email_otps WHERE email = %s ORDER BY created_at DESC LIMIT 1",
        (email,)
    )
    last = cursor.fetchone()
    if last:
        elapsed = (datetime.datetime.utcnow() - last["created_at"]).total_seconds()
        if elapsed < OTP_RESEND_COOLDOWN_SECONDS:
            wait_time = int(OTP_RESEND_COOLDOWN_SECONDS - elapsed)
            wait_time = min(wait_time, MAX_WAIT_SECONDS)  # cap at 60s
            cursor.close(); conn.close()
            return jsonify({
                "error": "Too many requests",
                "retry_after": wait_time
            }), 429

    otp = str(random.randint(100000, 999999))
    hashed_pw = generate_password_hash(password)

    cursor.execute("""
        INSERT INTO email_otps (email, otp_code, name, password, role)
        VALUES (%s, %s, %s, %s, %s)
    """, (email, otp, name, hashed_pw, role))
    conn.commit()
    cursor.close(); conn.close()

    sent = send_otp_email(email, otp)
    if not sent:
        return jsonify({"error": "Failed to send OTP email"}), 500

    return jsonify({
        "message": "OTP sent to email",
        "retry_after": OTP_RESEND_COOLDOWN_SECONDS
    }), 200


# Step 2: Verify OTP
@auth_bp.route("/register/verify", methods=["POST"])
def verify_and_register():
    data = request.json or {}
    email = data.get("email")
    otp = data.get("otp")

    if not all([email, otp]):
        return jsonify({"error": "Missing fields"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT * FROM email_otps
        WHERE email = %s
        ORDER BY created_at DESC
        LIMIT 1
    """,
        (email,),
    )
    rec = cursor.fetchone()

    if not rec or rec["otp_code"] != otp:
        cursor.close(); conn.close()
        return jsonify({"error": "Invalid OTP"}), 400

    cursor.execute(
        """
        INSERT INTO users (username, email, password, role, is_email_verified)
        VALUES (%s, %s, %s, %s, %s)
    """,
        (rec["name"], email, rec["password"], rec["role"], True),
    )
    conn.commit()

    cursor.execute("DELETE FROM email_otps WHERE email = %s", (email,))
    conn.commit()

    cursor.close(); conn.close()
    return jsonify({"message": "Registration successful!"}), 201


# Step 3: Login
@auth_bp.route("/login", methods=["POST"])
def login_user():
    data = request.json or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    cursor.close(); conn.close()

    if not user or not check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid credentials"}), 401

    if not user.get("is_email_verified"):
        return jsonify({"error": "Email not verified"}), 403

    payload = {
        "user_id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=2),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    return jsonify({
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["username"],
            "role": user["role"],
            "email": user.get("email"),
        }
    }), 200
