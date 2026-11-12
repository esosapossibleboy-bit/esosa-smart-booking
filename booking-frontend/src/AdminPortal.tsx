import { useState, useEffect } from "react";

interface Appointment {
  id: number;
  client_name: string;
  client_email: string;
  service_type: string;
  amount: number;
  payment_status: string;
  appointment_date: string;
  time_slot: string;
}

interface AdminPortalProps {
  apiBase: string;
  onAppointmentsCountChange: (count: number) => void;
}

export default function AdminPortal({ apiBase, onAppointmentsCountChange }: AdminPortalProps) {
  const [adminToken, setAdminToken] = useState<string | null>(localStorage.getItem("booking_admin_token"));
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [appointments, setAppointments] = useState<Array<Appointment>>([]);

  useEffect(() => {
    if (adminToken) {
      fetchAdminAppointments();
    }
  }, [adminToken]);

  const handleAdminLogin = async () => {
    const res = await fetch(`${apiBase}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.status === "Success") {
      localStorage.setItem("booking_admin_token", data.token);
      setAdminToken(data.token);
    } else {
      alert("❌ " + data.message);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("booking_admin_token");
    setAdminToken(null);
  };

  const fetchAdminAppointments = async () => {
    const res = await fetch(`${apiBase}/appointments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.status === 401) {
      handleAdminLogout();
      return;
    }
    const data = await res.json();
    if (data.status === "Success") {
      setAppointments(data.appointments);
      onAppointmentsCountChange(data.appointments.length);
    }
  };

  const handleCancel = async (id: number) => {
    await fetch(`${apiBase}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ id }),
    });
    fetchAdminAppointments();
  };

  if (!adminToken) {
    return (
      <div className="card-panel">
        <div className="admin-login-box">
          <h2 style={{ color: "#00d2ff", marginTop: 0 }}>🔐 Provider Admin Login</h2>
          <p style={{ color: "#8f9cae", fontSize: "14px" }}>
            Sign in with your admin account to view paid bookings.
          </p>
          <input
            type="text"
            placeholder="Admin Username (default: admin)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Admin Password (default: admin123)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="confirm-btn" onClick={handleAdminLogin}>
            Sign In as Provider
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ margin: 0, color: "#00d2ff" }}>Provider Schedule & Paid Bookings</h2>
        <button className="cancel-btn" onClick={handleAdminLogout}>
          Lock Admin Panel
        </button>
      </div>

      {appointments.length === 0 ? (
        <p style={{ color: "#8f9cae" }}>No appointments booked yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Client</th>
              <th>Service & Payment</th>
              <th>Receipt</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((appt) => (
              <tr key={appt.id}>
                <td>
                  <strong>{appt.appointment_date}</strong>
                  <br />
                  <span style={{ color: "#2cfd73", fontWeight: "bold" }}>{appt.time_slot}</span>
                </td>
                <td>
                  {appt.client_name}
                  <br />
                  <span style={{ fontSize: "12px", color: "#8f9cae" }}>{appt.client_email}</span>
                </td>
                <td>
                  {appt.service_type}
                  <br />
                  <span style={{ fontSize: "12px", color: "#2cfd73" }}>
                    ${Number(appt.amount).toFixed(2)} • {appt.payment_status}
                  </span>
                </td>
                <td>
                  <a
                    href={`${apiBase}/receipt/${appt.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#00d2ff", fontWeight: "bold", textDecoration: "none" }}
                  >
                    📄 PDF
                  </a>
                </td>
                <td>
                  <button className="cancel-btn" onClick={() => handleCancel(appt.id)}>
                    Cancel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
