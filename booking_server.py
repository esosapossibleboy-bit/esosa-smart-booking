import os
import io
import datetime
from functools import wraps
import requests
import jwt
import psycopg2
from psycopg2.extras import RealDictCursor
from fpdf import FPDF
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

DATABASE_URL = os.environ.get("DATABASE_URL")
SECRET_KEY = os.environ.get("SECRET_KEY", "esosa-booking-admin-super-secret-key-2026-secure")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")

SERVICE_CATALOG = {
    "1-on-1 Software Coaching": 120.00,
    "Full-Stack Code Review": 85.00,
    "Technical Consultation": 50.00,
}

AVAILABLE_SLOTS = [
    "09:00 AM", "10:00 AM", "11:00 AM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"
]

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def init_db():
    if not DATABASE_URL:
        return
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        client_name TEXT NOT NULL,
        client_email TEXT NOT NULL,
        service_type TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 50.0,
        payment_status TEXT NOT NULL DEFAULT 'Paid',
        appointment_date TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        UNIQUE(appointment_date, time_slot)
    )
    """)
    cursor.execute("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS amount REAL NOT NULL DEFAULT 50.0;")
    cursor.execute("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'Paid';")
    conn.commit()
    cursor.close()
    conn.close()

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"status": "Error", "message": "Admin login required"}), 401
        token = auth_header.replace("Bearer ", "", 1).strip()
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            if payload.get("role") != "admin":
                return jsonify({"status": "Error", "message": "Unauthorized role"}), 403
        except Exception:
            return jsonify({"status": "Error", "message": "Invalid or expired admin token"}), 401
        return f(*args, **kwargs)
    return decorated

def send_confirmation_email(to_email, client_name, service, amount, date_str, slot_str, appt_id):
    if not RESEND_API_KEY:
        print(f"Email Simulated To: {to_email} | Booking #{appt_id}: {service}")
        return False
    try:
        res = requests.post(
            "https://resend.com",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": "Esosa Smart Booking <onboarding@resend.dev>",
                "to": [to_email],
                "subject": f"Booking Confirmed (#{appt_id}): {service}",
                "text": (
                    f"Hi {client_name},\n\n"
                    f"Your appointment is confirmed and paid!\n"
                    f"Confirmation ID: #{appt_id}\n"
                    f"Service: {service}\n"
                    f"Amount Paid: ${amount:.2f}\n"
                    f"Date & Time: {date_str} at {slot_str}\n\n"
                    f"Thank you for booking with Esosa Smart Booking!"
                ),
            },
            timeout=10,
        )
        return res.status_code in (200, 201)
    except Exception as e:
        print(f"Email send failed: {e}")
        return False

@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "Booking API Online", "services": SERVICE_CATALOG})

@app.route("/admin/login", methods=["POST"])
def admin_login():
    data = request.json or {}
    if data.get("username") == ADMIN_USERNAME and data.get("password") == ADMIN_PASSWORD:
        token = jwt.encode({
            "role": "admin",
            "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=12)
        }, SECRET_KEY, algorithm="HS256")
        return jsonify({"status": "Success", "token": token})
    return jsonify({"status": "Error", "message": "Invalid admin credentials"}), 401

@app.route("/slots", methods=["GET"])
def get_slots():
    target_date = request.args.get("date")
    if not target_date:
        return jsonify({"status": "Error", "message": "Date required"}), 400
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT time_slot FROM appointments WHERE appointment_date = %s", (target_date,))
    booked_rows = cursor.fetchall()
    cursor.close()
    conn.close()
    booked_slots = {time_slot for (time_slot,) in booked_rows}
    slots = [{"time": s, "available": s not in booked_slots} for s in AVAILABLE_SLOTS]
    return jsonify({"status": "Success", "slots": slots, "services": SERVICE_CATALOG})

@app.route("/book", methods=["POST"])
def book_appointment():
    data = request.json or {}
    client_name = data.get("client_name", "").strip()
    client_email = data.get("client_email", "").strip()
    service_type = data.get("service_type", "").strip()
    appointment_date = data.get("appointment_date", "").strip()
    time_slot = data.get("time_slot", "").strip()
    card_last4 = data.get("card_last4", "").strip()

    if not all([client_name, client_email, service_type, appointment_date, time_slot]):
        return jsonify({"status": "Error", "message": "All fields are required"}), 400
    if service_type not in SERVICE_CATALOG:
        return jsonify({"status": "Error", "message": "Invalid service selected"}), 400
    if len(card_last4) != 4 or not card_last4.isdigit():
        return jsonify({"status": "Error", "message": "Valid 4-digit payment confirmation required"}), 402

    amount = SERVICE_CATALOG[service_type]
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO appointments (client_name, client_email, service_type, amount, payment_status, appointment_date, time_slot)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (client_name, client_email, service_type, amount, f"Paid (Card **** {card_last4})", appointment_date, time_slot)
        )
        (new_id,) = cursor.fetchone()
        conn.commit()
        email_sent = send_confirmation_email(client_email, client_name, service_type, amount, appointment_date, time_slot, new_id)
        return jsonify({
            "status": "Success",
            "appointment_id": new_id,
            "amount": amount,
            "email_sent": email_sent,
            "message": f"Payment of ${amount:.2f} confirmed! Booking #{new_id} reserved."
        })
    except psycopg2.IntegrityError:
        conn.rollback()
        return jsonify({"status": "Error", "message": "Sorry! That time slot was just booked by someone else."}), 409
    finally:
        cursor.close()
        conn.close()

@app.route("/receipt/<int:appt_id>", methods=["GET"])
def download_receipt(appt_id):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM appointments WHERE id = %s", (appt_id,))
    appt = cursor.fetchone()
    cursor.close()
    conn.close()

    if not appt:
        return jsonify({"status": "Error", "message": "Appointment not found"}), 404

    safe_status = str(appt["payment_status"]).replace("\u2022", "*")

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, "Esosa Smart Booking - Official Receipt", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 12)
    pdf.ln(6)
    pdf.cell(0, 9, f"Confirmation ID: #{appt['id']}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 9, f"Client Name: {appt['client_name']}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 9, f"Client Email: {appt['client_email']}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 9, f"Service: {appt['service_type']}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 9, f"Date & Time: {appt['appointment_date']} at {appt['time_slot']}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 9, f"Amount Paid: ${appt['amount']:.2f} ({safe_status})", new_x="LMARGIN", new_y="NEXT")

    pdf_bytes = bytes(pdf.output())
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"appointment_receipt_{appt_id}.pdf"
    )

@app.route("/appointments", methods=["GET"])
@admin_required
def list_appointments():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM appointments ORDER BY appointment_date ASC, time_slot ASC")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify({"status": "Success", "appointments": rows})

@app.route("/cancel", methods=["POST"])
@admin_required
def cancel_appointment():
    data = request.json or {}
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM appointments WHERE id = %s", (data.get("id"),))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"status": "Success", "message": "Appointment canceled and slot reopened."})

init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8002))
    app.run(host="0.0.0.0", port=port)
