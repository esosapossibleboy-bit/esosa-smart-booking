import { useState, useEffect } from "react";
import AdminPortal from "./AdminPortal";
import "./App.css";

const RENDER_HOST = "esosa-booking-api.onrender.com";
const API_BASE = `https://${RENDER_HOST}`;

const SERVICE_PRICES: Record<string, number> = {
  "1-on-1 Software Coaching": 120.0,
  "Full-Stack Code Review": 85.0,
  "Technical Consultation": 50.0,
};

interface TimeSlot {
  time: string;
  available: boolean;
}

interface BookingConfirmation {
  id: number;
  message: string;
  emailSent: boolean;
}

export default function App() {
  const [role, setRole] = useState<"client" | "provider">(() => {
    return (localStorage.getItem("booking_role") as "client" | "provider") || "client";
  });

  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(() => localStorage.getItem("booking_date") || today);
  const [slots, setSlots] = useState<Array<TimeSlot>>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [serviceType, setServiceType] = useState<string>(
    () => localStorage.getItem("booking_service") || "1-on-1 Software Coaching"
  );
  const [clientName, setClientName] = useState<string>(() => localStorage.getItem("booking_name") || "");
  const [clientEmail, setClientEmail] = useState<string>(() => localStorage.getItem("booking_email") || "");
  const [cardLast4, setCardLast4] = useState<string>("");
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [adminCount, setAdminCount] = useState<number>(0);

  useEffect(() => localStorage.setItem("booking_role", role), [role]);
  useEffect(() => localStorage.setItem("booking_date", selectedDate), [selectedDate]);
  useEffect(() => localStorage.setItem("booking_service", serviceType), [serviceType]);
  useEffect(() => localStorage.setItem("booking_name", clientName), [clientName]);
  useEffect(() => localStorage.setItem("booking_email", clientEmail), [clientEmail]);

  useEffect(() => {
    if (role === "client") {
      fetchSlots(selectedDate);
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

  const handleBook = async () => {
    if (!clientName || !clientEmail || !selectedSlot) {
      alert("⚠️ Please enter your name, email, and pick an available time slot!");
      return;
    }
    if (cardLast4.length !== 4 || !/^\d{4}$/.test(cardLast4)) {
      alert("⚠️ Please enter the last 4 digits of your payment card (e.g. 4242)!");
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
        card_last4: cardLast4,
      }),
    });
    const data = await res.json();

    if (data.status === "Success") {
      setConfirmation({
        id: data.appointment_id,
        message: data.message,
        emailSent: data.email_sent,
      });
      setClientName("");
      setClientEmail("");
      setCardLast4("");
      localStorage.removeItem("booking_name");
      localStorage.removeItem("booking_email");
      fetchSlots(selectedDate);
    } else {
      alert("❌ " + data.message);
      fetchSlots(selectedDate);
    }
  };

  const selectedPrice = SERVICE_PRICES[serviceType] || 50.0;

  return (
    <div className="booking-wrapper">
      <div className="top-nav">
        <div>
          <h1>📅 Esosa Smart Booking Platform</h1>
          <p style={{ color: "#8f9cae", margin: 0, fontSize: "14px" }}>
            Payments • PDF Receipts • Email Alerts • Admin JWT
          </p>
        </div>
        <div className="role-tabs">
          <button className={`tab-btn ${role === "client" ? "active" : ""}`} onClick={() => setRole("client")}>
            Client Booking
          </button>
          <button className={`tab-btn ${role === "provider" ? "active" : ""}`} onClick={() => setRole("provider")}>
            Provider Admin {adminCount > 0 ? `(${adminCount})` : ""}
          </button>
        </div>
      </div>

      {confirmation && (
        <div className="toast-banner">
          <div>
            <strong>🔔 {confirmation.message}</strong>
            <div style={{ fontSize: "13px", color: "#8f9cae", marginTop: "4px" }}>
              {confirmation.emailSent
                ? "📧 Email confirmation sent to your inbox!"
                : "📧 Notification logged! Download your official PDF receipt below:"}
            </div>
          </div>
          <a href={`${API_BASE}/receipt/${confirmation.id}`} target="_blank" rel="noreferrer">
            <button className="pdf-btn">📄 Download PDF Receipt</button>
          </a>
        </div>
      )}

      {role === "client" ? (
        <div className="card-panel">
          <h2 style={{ marginTop: 0, color: "#00d2ff" }}>Book & Pay for an Appointment</h2>
          <div className="form-grid">
            <div className="field-group">
              <label>Service Type & Fee</label>
              <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                <option value="1-on-1 Software Coaching">1-on-1 Software Coaching — $120.00</option>
                <option value="Full-Stack Code Review">Full-Stack Code Review — $85.00</option>
                <option value="Technical Consultation">Technical Consultation — $50.00</option>
              </select>
            </div>

            <div className="field-group">
              <label>Select Date</label>
              <input type="date" min={today} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
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
              <label>Email Address (For Confirmation)</label>
              <input
                type="email"
                placeholder="e.g. esosa@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label>Payment Card (Last 4 Digits)</label>
              <input
                type="text"
                maxLength={4}
                placeholder="e.g. 4242"
                value={cardLast4}
                onChange={(e) => setCardLast4(e.target.value)}
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
            Pay ${selectedPrice.toFixed(2)} & Confirm Reservation
          </button>
        </div>
      ) : (
        <AdminPortal apiBase={API_BASE} onAppointmentsCountChange={setAdminCount} />
      )}
    </div>
  );
}
