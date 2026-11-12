import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

DATABASE_URL = os.environ.get("DATABASE_URL")

# Fixed daily business hours offered by the service provider
AVAILABLE_SLOTS = [
    "09:00 AM", "10:00 AM", "11:00 AM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"
]

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def init_db():
    if not DATABASE_URL:
        print("⚠️ Missing DATABASE_URL environment variable.")
        return
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 🛡️ UNIQUE(appointment_date, time_slot) prevents double-booking at the database level
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        client_name TEXT NOT NULL,
        client_email TEXT NOT NULL,
        service_type TEXT NOT NULL,
        appointment_date TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        UNIQUE(appointment_date, time_slot)
    )
    """)
    conn.commit()
    cursor.close()
    conn.close()

@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "Booking API Online"})

# 📅 Get available vs. booked slots for a specific date
@app.route("/slots", methods=["GET"])
def get_slots():
    target_date = request.args.get("date")
    if not target_date:
        return jsonify({"status": "Error", "message": "Date parameter required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT time_slot FROM appointments WHERE appointment_date = %s", (target_date,))
    booked_rows = cursor.fetchall()
    cursor.close()
    conn.close()

    booked_slots = {row[0] for row in booked_rows}
    slot_status = [
        {"time": slot, "available": slot not in booked_slots}
        for slot in AVAILABLE_SLOTS
    ]
    return jsonify({"status": "Success", "date": target_date, "slots": slot_status})

# ✅ Reserve a new appointment with conflict detection
@app.route("/book", methods=["POST"])
def book_appointment():
    data = request.json
    client_name = data.get("client_name", "").strip()
    client_email = data.get("client_email", "").strip()
    service_type = data.get("service_type", "").strip()
    appointment_date = data.get("appointment_date", "").strip()
    time_slot = data.get("time_slot", "").strip()

    if not all([client_name, client_email, service_type, appointment_date, time_slot]):
        return jsonify({"status": "Error", "message": "Please fill in all booking details!"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO appointments (client_name, client_email, service_type, appointment_date, time_slot)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (client_name, client_email, service_type, appointment_date, time_slot)
        )
        conn.commit()
        return jsonify({"status": "Success", "message": f"Confirmed {service_type} on {appointment_date} at {time_slot}!"})
    except psycopg2.IntegrityError:
        conn.rollback()
        return jsonify({"status": "Error", "message": "Sorry! That time slot was just booked by someone else."}), 409
    finally:
        cursor.close()
        conn.close()

# 📋 Provider Admin View: List all upcoming appointments
@app.route("/appointments", methods=["GET"])
def list_appointments():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM appointments ORDER BY appointment_date ASC, time_slot ASC")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify({"status": "Success", "appointments": rows})

# ❌ Provider Admin View: Cancel an appointment and free the slot
@app.route("/cancel", methods=["POST"])
def cancel_appointment():
    data = request.json
    appt_id = data.get("id")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM appointments WHERE id = %s", (appt_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"status": "Success", "message": "Appointment canceled and slot reopened."})

init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8002))
    app.run(host="0.0.0.0", port=port)
