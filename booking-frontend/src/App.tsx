import { useState, useEffect } from "react";
import "./App.css";

const RENDER_HOST = "esosa-booking-api.onrender.com";
const API_BASE = `https://${RENDER_HOST}`;

interface TimeSlot {
  time: string;
  available: boolean;
}

interface Appointment {
  id: number;
  client_name: string;
  client_email: string;
  service_type: string;
  appointment_date: string;
  time_slot: string;
}

export default function App() {
  const [role, setRole] = useState<"client" | "provider">("client");

  // Clean YYYY-MM-DD date string without array indexing
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [slots, setSlots] = useState<Array<TimeSlot>>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [serviceType, setServiceType] = useState<string>("1-on-1 Software Coaching");
  const [clientName, setClientName] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string>("");

  const [appointments, setAppointments] = useState<Array<Appointment>>([]);

  useEffect(() => {
    if (role === "client") {
      fetchSlots(selectedDate);
    } else {
      fetchAppointments();
    }
  }, [role, selectedDate]);

  const fetchSlots = async (dateStr: string) => {
    try {
      const res = await fetch(`${API_BASE}/slots?date=${dateStr}`);
      const data = await res.json();
      if (data.status === "Success") {
        setSlots(data.slots);
        setSelectedSlot("");
      }
    } catch (err) {
      console.error("Failed to fetch slots:", err);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await fetch(`${API_BASE}/appointments`);
      const data = await res.json();
      if (data.status === "Success") {
        setAppointments(data.appointments);
      }
    } catch (err) {
      console.error("Failed to fetch appointments:", err);
    }
  };

  const handleBook = async () => {
    if (!clientName || !clientEmail || !selectedSlot) {
      alert("⚠️ Please enter your name, email, and pick an available time slot!");
      return;
    }

    const res = await fetch(`${API_BASE}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: clientName,
        client_email: clientEmail,
        service_type: serviceType,
        appointment_date: selectedDate,
        time_slot: selectedSlot,
      }),
    });
    const data = await res.json();

    if (data.status === "Success") {
      alert("✅ " + data.message);
      setClientName("");
      setClientEmail("");
      fetchSlots(selectedDate);
    } else {
      alert("❌ " + data.message);
      fetchSlots(selectedDate);
    }
  };

  const handleCancel = async (id: number) => {
    await fetch(`${API_BASE}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchAppointments();
  };

  return (
    <div className="booking-wrapper">
      <div className="top-nav">
        <div>
          <h1>📅 Esosa Smart Booking Platform</h1>
          <p style={{ color: "#8f9cae", margin: 0, fontSize: "14px" }}>
            PostgreSQL Conflict-Free Scheduling • React + TypeScript
          </p>
        </div>
        <div className="role-tabs">
          <button
            className={`tab-btn ${role === "client" ? "active" : ""}`}
            onClick={() => setRole("client")}
          >
            Client Booking
          </button>
          <button
            className={`tab-btn ${role === "provider" ? "active" : ""}`}
            onClick={() => setRole("provider")}
          >
            Provider Admin ({appointments.length})
          </button>
        </div>
      </div>

      {role === "client" ? (
        <div className="card-panel">
          <h2 style={{ marginTop: 0, color: "#00d2ff" }}>Book an Appointment</h2>
          <div className="form-grid">
            <div className="field-group">
              <label>Service Type</label>
              <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                <option value="1-on-1 Software Coaching">1-on-1 Software Coaching (60 min)</option>
                <option value="Full-Stack Code Review">Full-Stack Code Review (45 min)</option>
                <option value="Technical Consultation">Technical Consultation (30 min)</option>
              </select>
            </div>

            <div className="field-group">
              <label>Select Date</label>
              <input
                type="date"
                min={today}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label>Your Full Name</label>
              <input
                type="text"
                placeholder="e.g. Esosa"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="e.g. esosa@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>
          </div>

          <label style={{ fontSize: "13px", color: "#8f9cae", fontWeight: 600 }}>
            Available Time Slots for {selectedDate}
          </label>
          <div className="slots-grid">
            {slots.map((slot) => (
              <button
                key={slot.time}
                disabled={!slot.available}
                className={`slot-btn ${selectedSlot === slot.time ? "selected" : ""}`}
                onClick={() => setSelectedSlot(slot.time)}
              >
                {slot.time}
              </button>
            ))}
          </div>

          <button className="confirm-btn" onClick={handleBook}>
            Confirm Reservation
          </button>
        </div>
      ) : (
        <div className="card-panel">
          <h2 style={{ marginTop: 0, color: "#00d2ff" }}>Provider Schedule & Reservations</h2>
          {appointments.length === 0 ? (
            <p style={{ color: "#8f9cae" }}>No appointments booked yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Client</th>
                  <th>Service</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <tr key={appt.id}>
                    <td><strong>{appt.appointment_date}</strong></td>
                    <td style={{ color: "#2cfd73", fontWeight: "bold" }}>{appt.time_slot}</td>
                    <td>
                      {appt.client_name}
                      <br />
                      <span style={{ fontSize: "12px", color: "#8f9cae" }}>{appt.client_email}</span>
                    </td>
                    <td>{appt.service_type}</td>
                    <td>
                      <button className="cancel-btn" onClick={() => handleCancel(appt.id)}>
                        Cancel Slot
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
