import React, { useState, useEffect, useRef } from "react";
import { verifyOwnerOtp, startCharging, stopCharging } from "../api/api";
import axios from "axios";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { io } from "socket.io-client";

// ============================================================================
// THEME & ANIMATION STYLES (DARK GLASS VARIANT matching previous layout)
// ============================================================================

const COMPONENT_STYLES = `
  :root{
    /* Dark brand tokens (navy base, teal→indigo gradient, emerald accents) */
    --bg: #071225;                 /* deep navy */
    --panel-dark: rgba(6,11,20,0.7); /* dark glass panel */
    --panel-border: rgba(255,255,255,0.03);
    --surface-dark: rgba(255,255,255,0.02);
    --text-inverse: #e6eef6;
    --muted: #93a4b8;
    --primary-from: #06b6d4; /* teal */
    --primary-to: #6366f1;   /* indigo */
    --primary-gradient: linear-gradient(135deg, var(--primary-from), var(--primary-to));
    --accent: #10b981; /* emerald */
    --warning: #f59e0b;
    --danger: #ef4444;
    --glass-glow: 0 8px 30px rgba(6,182,212,0.06);
    --radius-lg: 14px;
    --radius-md: 10px;
    --shadow-deep: 0 12px 40px rgba(0,0,0,0.6);
    --timing-fast: 150ms;
    --timing-normal: 250ms;
    --timing-slow: 400ms;
  }

  /* Reset */
  .owner-verify-root * { box-sizing: border-box; }

  /* Keyframes */
  @keyframes fadeSlideIn { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0);} }
  @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
  @keyframes slideInRight { from { opacity:0; transform: translateX(30px);} to { opacity:1; transform: translateX(0);} }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes glow { 0%,100% { box-shadow: 0 0 8px rgba(99,102,241,0.4); } 50% { box-shadow: 0 0 16px rgba(99,102,241,0.6); } }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .owner-verify-root * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }

  /* Responsive */
  @media (max-width: 640px) {
    .owner-verify-root .details-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
    .owner-verify-root .button-group { flex-direction: column !important; }
    .owner-verify-root .button-group button { width: 100% !important; }
  }

  @media (min-width: 768px) {
    .owner-verify-root .main-card { max-width: 720px; }
    .owner-verify-root .details-grid { grid-template-columns: repeat(2, 1fr); }
  }

  /* small helper classes */
  .mono { font-family: monospace; letter-spacing: 2px; }
`;

// ============================================================================
// SOCKET.IO
// ============================================================================

const socket = io("http://localhost:5000");

// ============================================================================
// COMPONENT
// ============================================================================

const OwnerVerify = () => {
  // State
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [reservation, setReservation] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [countdown, setCountdown] = useState(null);
  const [totalSeconds, setTotalSeconds] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const intervalRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // TOAST
  const showToast = (text, type = "info", duration = 4200) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ text, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), duration);
  };

  const showConfirm = (text, onConfirm) => setConfirmModal({ text, onConfirm });
  const closeConfirm = () => setConfirmModal(null);

  // SOCKET listeners
  useEffect(() => {
    socket.on("otp_verified", (data) => {
      setMessage("OTP verified successfully.");
      setMessageType("success");
      showToast("✓ OTP verified", "success");
    });

    socket.on("charging_started", (data) => {
      if (reservation?.reservation_id === data.reservation_id) {
        const updated = {
          ...reservation,
          charging_status: "running",
          charging_start_time: data.start_time,
          charging_end_time: data.end_time,
        };
        setReservation(updated);
        restoreCountdown(data.start_time, data.end_time);
        showToast("⚡ Charging session started", "success");
      }
    });

    socket.on("charging_stopped", (data) => {
      if (reservation?.reservation_id === data.reservation_id) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setCountdown(0);
        setReservation((prev) => ({ ...prev, charging_status: "completed", charging_end_time: new Date().toISOString() }));
        setMessage("Charging completed.");
        setMessageType("info");
        showToast("✓ Charging completed", "info");
      }
    });

    socket.on("reservation_expired", (data) => {
      if (reservation?.reservation_id === data.reservation_id) {
        setMessage("Reservation expired.");
        setMessageType("error");
        showToast("⚠ Reservation expired", "error");
      }
    });

    return () => {
      socket.off("otp_verified");
      socket.off("charging_started");
      socket.off("charging_stopped");
      socket.off("reservation_expired");
    };
  }, [reservation]);

  // Download invoice
  const downloadInvoice = () => {
    if (!reservation?.reservation_id) { showToast("⚠ Reservation ID missing", "error"); return; }
    const url = `http://localhost:5000/api/invoice/download/${reservation.reservation_id}`;
    window.open(url, "_blank");
    showToast("📄 Opening invoice...", "info");
  };

  // Email invoice
  const emailInvoice = async () => {
    if (!reservation?.reservation_id) { showToast("⚠ Reservation ID missing", "error"); return; }
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/invoice/email/${reservation.reservation_id}`);
      const msg = res.data?.message || "Invoice sent successfully";
      setMessage(msg); setMessageType("success"); showToast(`✓ ${msg}`, "success");
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to email invoice";
      setMessage(errorMsg); setMessageType("error"); showToast(`✗ ${errorMsg}`, "error");
    } finally { setLoading(false); }
  };

  // Verify OTP
  const handleVerify = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!email || !otp) { showToast("⚠ Please enter both email and OTP", "error"); return; }
    setLoading(true);
    try {
      const res = await verifyOwnerOtp({ email, otp });
      if (res.error) throw new Error(res.error);
      socket.emit("owner_verified", { email });
      setReservation(res);
      setMessage("User verified successfully.");
      setMessageType("success");
      showToast("✓ User verified", "success");
      if (res.charging_status === "running") restoreCountdown(res.charging_start_time, res.charging_end_time);
    } catch (err) {
      const errorMsg = err.message || "Verification failed";
      setMessage(errorMsg); setMessageType("error"); showToast(`✗ ${errorMsg}`, "error");
    } finally { setLoading(false); }
  };

  // Restore countdown
  const restoreCountdown = (startStr, endStr) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    const total = Math.max(1, Math.floor((end - start) / 1000));
    setTotalSeconds(total);
    const tick = () => {
      const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) {
        clearInterval(intervalRef.current); intervalRef.current = null;
        handleStop(true);
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);
  };

  // Start charging (REST)
  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await startCharging({ reservation_id: reservation.reservation_id });
      if (res.error) throw new Error(res.error);
      setMessage("Charging started."); setMessageType("success"); showToast("⚡ Charging started", "success");
      restoreCountdown(res.charging_start_time, res.charging_end_time);
    } catch (err) {
      const errorMsg = err.message || "Failed to start charging";
      setMessage(errorMsg); setMessageType("error"); showToast(`✗ ${errorMsg}`, "error");
    } finally { setLoading(false); }
  };

  // Stop charging (with confirmation)
  const handleStop = async (auto = false) => {
    if (!auto) {
      showConfirm("Are you sure you want to stop charging early?", async () => { await executeStop(false); closeConfirm(); });
      return;
    }
    await executeStop(true);
  };

  const executeStop = async (auto) => {
    setLoading(true);
    try {
      const res = await stopCharging({ reservation_id: reservation.reservation_id });
      if (!auto) { setMessage(res.message); setMessageType("info"); showToast(res.message || "Charging stopped", "info"); }
      if (intervalRef.current) clearInterval(intervalRef.current);
      setCountdown(0);
      setReservation({ ...reservation, charging_status: "completed", charging_end_time: new Date().toISOString() });
    } catch (err) {
      if (!auto) { const errorMsg = err.message || "Failed to stop charging"; setMessage(errorMsg); setMessageType("error"); showToast(`✗ ${errorMsg}`, "error"); }
    } finally { setLoading(false); }
  };

  // cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Escape") {
        if (confirmModal) closeConfirm();
        else if (!reservation) { setEmail(""); setOtp(""); }
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [confirmModal, reservation]);

  // countdown UI
  const renderCountdown = () => {
    if (countdown === null || !totalSeconds) return null;
    const percent = (countdown / totalSeconds) * 100;
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    const timeDisplay = `${minutes}:${String(seconds).padStart(2, "0")}`;
    return (
      <div style={styles.countdownContainer}>
        <div style={styles.countdownCircle}>
          <CircularProgressbar
            value={percent}
            text={timeDisplay}
            styles={buildStyles({
              textColor: "var(--text-inverse)",
              textSize: "20px",
              pathColor: "var(--accent)",
              trailColor: "rgba(255,255,255,0.06)",
              pathTransitionDuration: 0.5,
            })}
          />
        </div>
        <div style={styles.countdownFallback} aria-live="polite" aria-atomic="true">
          Time remaining: {timeDisplay}
        </div>
      </div>
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return "var(--warning)";
      case "running": return "var(--accent)";
      case "completed": return "var(--primary-from)";
      default: return "var(--muted)";
    }
  };

  // Inline styles updated for dark theme
  const styles = {
    root: {
      minHeight: "100vh",
      background: `radial-gradient(circle at 10% 10%, rgba(6,182,212,0.04), transparent 8%), radial-gradient(circle at 90% 80%, rgba(99,102,241,0.03), transparent 8%), linear-gradient(180deg, var(--bg) 0%, #0b1724 100%)`,
      padding: "28px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
      position: "relative",
      color: "var(--text-inverse)",
    },
    mainCard: {
      background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
      backdropFilter: "blur(14px)",
      borderRadius: "18px",
      padding: "36px",
      width: "100%",
      maxWidth: "720px",
      boxShadow: "var(--shadow-deep)",
      border: "1px solid var(--panel-border)",
      animation: "fadeSlideIn var(--timing-slow) ease-out",
      position: "relative",
      overflow: "hidden",
    },
    cardGlow: {
      position: "absolute",
      top: "-40%",
      left: "-40%",
      width: "180%",
      height: "180%",
      background: "radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.06), transparent 30%)",
      pointerEvents: "none",
      zIndex: 0,
    },
    cardContent: { position: "relative", zIndex: 1 },
    title: {
      fontSize: "26px",
      fontWeight: 800,
      color: "var(--text-inverse)",
      marginBottom: "22px",
      textAlign: "center",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "10px",
    },
    form: { display: "flex", flexDirection: "column", gap: "16px" },
    inputGroup: { display: "flex", flexDirection: "column", gap: "8px" },
    label: { fontSize: "13px", fontWeight: 700, color: "var(--muted)", display: "flex", gap: "8px", alignItems: "center" },
    input: {
      width: "100%",
      padding: "14px",
      fontSize: "15px",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "10px",
      background: "rgba(255,255,255,0.02)",
      color: "var(--text-inverse)",
      transition: "all 140ms ease",
      outline: "none",
      minHeight: "46px",
    },
    inputFocus: { borderColor: "rgba(99,102,241,0.5)", boxShadow: "0 8px 20px rgba(99,102,241,0.08)" },
    button: {
      padding: "12px 20px",
      fontSize: "15px",
      fontWeight: 800,
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      minHeight: "48px",
      transition: "all 160ms ease",
    },
    buttonPrimary: {
      background: "linear-gradient(135deg, var(--primary-from), var(--primary-to))",
      color: "#fff",
      boxShadow: "0 12px 36px rgba(99,102,241,0.08)",
    },
    buttonSuccess: {
      background: "linear-gradient(90deg, var(--accent), #059669)",
      color: "#fff",
    },
    buttonDanger: { background: "linear-gradient(90deg, var(--danger), #dc2626)", color: "#fff" },
    buttonInfo: { background: "linear-gradient(90deg, var(--primary-from), var(--primary-to))", color: "#fff" },
    buttonSecondary: { background: "linear-gradient(90deg,#7c3aed,#a78bfa)", color: "#fff" },
    buttonDisabled: { opacity: 0.6, cursor: "not-allowed", pointerEvents: "none" },
    detailsSection: { animation: "fadeSlideIn var(--timing-slow) ease-out" },
    detailsTitle: { fontSize: "20px", fontWeight: 800, color: "var(--text-inverse)", marginBottom: "18px", display: "flex", gap: "8px", alignItems: "center" },
    detailsGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "18px" },
    detailItem: {
      padding: "14px",
      background: "rgba(255,255,255,0.02)",
      borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.03)",
    },
    detailLabel: { fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "6px" },
    detailValue: { fontSize: "15px", fontWeight: 700, color: "var(--text-inverse)" },
    statusBadge: { display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 14px", borderRadius: "999px", fontSize: "13px", fontWeight: 800 },
    countdownContainer: { textAlign: "center", marginTop: "18px", marginBottom: "18px" },
    countdownCircle: { width: "150px", height: "150px", margin: "0 auto 10px" },
    countdownFallback: { fontSize: "15px", fontWeight: 700, color: "var(--muted)" },
    buttonGroup: { display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap" },
    banner: { padding: "12px", borderRadius: "10px", marginTop: "14px", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", animation: "slideInRight var(--timing-normal) ease-out" },
    bannerSuccess: { background: "linear-gradient(90deg, rgba(16,185,129,0.08), rgba(6,182,212,0.02))", color: "var(--accent)", border: "1px solid rgba(16,185,129,0.12)" },
    bannerError: { background: "linear-gradient(90deg, rgba(239,68,68,0.06), rgba(6,182,212,0.01))", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.12)" },
    bannerInfo: { background: "linear-gradient(90deg, rgba(99,102,241,0.06), rgba(6,182,212,0.02))", color: "var(--primary-to)", border: "1px solid rgba(99,102,241,0.12)" },
    toast: { position: "fixed", bottom: "18px", right: "18px", padding: "12px 18px", borderRadius: "10px", boxShadow: "var(--shadow-deep)", fontSize: "13px", fontWeight: 800, zIndex: 9999, animation: "slideInRight var(--timing-normal) ease-out", minWidth: "220px" },
    toastSuccess: { background: "var(--accent)", color: "#fff" },
    toastError: { background: "var(--danger)", color: "#fff" },
    toastInfo: { background: "linear-gradient(90deg, var(--primary-from), var(--primary-to))", color: "#fff" },
    modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "18px" },
    modal: { background: "#06111a", borderRadius: "12px", padding: "22px", maxWidth: "420px", width: "100%", boxShadow: "0 20px 60px rgba(2,6,23,0.9)", border: "1px solid rgba(255,255,255,0.04)" },
    modalTitle: { fontSize: "18px", fontWeight: 800, color: "var(--text-inverse)", marginBottom: "12px" },
    modalButtons: { display: "flex", gap: "10px", marginTop: "16px" },
    spinner: { width: "18px", height: "18px", border: "3px solid rgba(255,255,255,0.12)", borderTop: "3px solid rgba(255,255,255,0.9)", borderRadius: "50%", animation: "spin 0.9s linear infinite" },
  };

  // INLINE ICONS (simple)
  const KeyIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="15" r="4"/><path d="m11.3 11.3 6.4-6.4 2.8 2.8-1.4 1.4 2.8 2.8-2.8 2.8-1.4-1.4-2.8 2.8z"/></svg>
  );
  const BoltIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/></svg>);
  const PlayIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>);
  const StopIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>);
  const DownloadIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>);
  const MailIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>);
  const UserIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
  const ClockIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);
  const CheckIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>);

  // RENDER
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: COMPONENT_STYLES }} />

      <div style={styles.root} className="owner-verify-root">
        <div style={styles.mainCard} className="main-card">
          <div style={styles.cardGlow} />

          <div style={styles.cardContent}>
            {!reservation ? (
              <>
                <h1 style={styles.title}>
                  <KeyIcon />
                  Verify User Reservation
                </h1>

                <form style={styles.form} onSubmit={handleVerify} aria-label="Verification form">
                  <div style={styles.inputGroup}>
                    <label htmlFor="email-input" style={styles.label}><MailIcon /> Email Address</label>
                    <input
                      id="email-input"
                      type="email"
                      placeholder="user@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={styles.input}
                      onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
                      onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.06)"; e.target.style.boxShadow = "none"; }}
                      disabled={loading}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div style={styles.inputGroup}>
                    <label htmlFor="otp-input" style={styles.label}><KeyIcon /> One-Time Password</label>
                    <input
                      id="otp-input"
                      type="text"
                      placeholder="●●●●●●"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      style={{ ...styles.input, fontFamily: "monospace", fontSize: "18px", letterSpacing: "6px", textAlign: "center" }}
                      onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
                      onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.06)"; e.target.style.boxShadow = "none"; }}
                      maxLength={6}
                      disabled={loading}
                      required
                      autoComplete="one-time-code"
                    />
                  </div>

                  <button
                    type="submit"
                    style={{ ...styles.button, ...styles.buttonPrimary, ...(loading ? styles.buttonDisabled : {}) }}
                    disabled={loading}
                    aria-label="Verify user reservation"
                    onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(99,102,241,0.12)"; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    {loading ? <div style={styles.spinner} aria-hidden="true" /> : <KeyIcon />} &nbsp;
                    {loading ? "Verifying..." : "Verify User"}
                  </button>
                </form>
              </>
            ) : (
              <div style={styles.detailsSection}>
                <h2 style={styles.detailsTitle}><BoltIcon /> Charging Session</h2>

                <div style={styles.detailsGrid} className="details-grid">
                  <div style={styles.detailItem}>
                    <div style={styles.detailLabel}><UserIcon /> User</div>
                    <div style={styles.detailValue}>{reservation.username || "—"}</div>
                  </div>

                  <div style={styles.detailItem}>
                    <div style={styles.detailLabel}><MailIcon /> Email</div>
                    <div style={styles.detailValue}>{reservation.user_email || "—"}</div>
                  </div>

                  <div style={styles.detailItem}>
                    <div style={styles.detailLabel}><ClockIcon /> Duration</div>
                    <div style={styles.detailValue}>{reservation.duration ?? "—"} minutes</div>
                  </div>

                  <div style={styles.detailItem}>
                    <div style={styles.detailLabel}>Status</div>
                    <div>
                      <span
                        style={{
                          ...styles.statusBadge,
                          background: `${getStatusColor(reservation.charging_status)}22`,
                          color: getStatusColor(reservation.charging_status),
                          border: `1px solid ${getStatusColor(reservation.charging_status)}33`,
                        }}
                        role="status"
                        aria-live="polite"
                      >
                        {reservation.charging_status === "running" && <BoltIcon />} {reservation.charging_status}
                      </span>
                    </div>
                  </div>
                </div>

                {renderCountdown()}

                <div style={styles.buttonGroup} className="button-group">
                  {reservation.charging_status === "pending" && (
                    <button
                      onClick={handleStart}
                      style={{ ...styles.button, ...styles.buttonSuccess, ...(loading ? styles.buttonDisabled : {}), flex: 1 }}
                      disabled={loading}
                    >
                      {loading ? <div style={styles.spinner} /> : <PlayIcon />} &nbsp; Start Charging
                    </button>
                  )}

                  {reservation.charging_status === "running" && (
                    <button
                      onClick={() => handleStop(false)}
                      style={{ ...styles.button, ...styles.buttonDanger, ...(loading ? styles.buttonDisabled : {}), flex: 1 }}
                      disabled={loading}
                    >
                      {loading ? <div style={styles.spinner} /> : <StopIcon />} &nbsp; Stop Charging
                    </button>
                  )}

                  {reservation.charging_status === "completed" && (
                    <>
                      <button
                        onClick={downloadInvoice}
                        style={{ ...styles.button, ...styles.buttonSecondary, flex: 1 }}
                      >
                        <DownloadIcon /> &nbsp; Download Invoice
                      </button>

                      <button
                        onClick={emailInvoice}
                        style={{ ...styles.button, ...styles.buttonInfo, ...(loading ? styles.buttonDisabled : {}), flex: 1 }}
                        disabled={loading}
                      >
                        {loading ? <div style={styles.spinner} /> : <MailIcon />} &nbsp; Email Invoice
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {message && (
              <div
                style={{
                  ...styles.banner,
                  ...(messageType === "success" ? styles.bannerSuccess : {}),
                  ...(messageType === "error" ? styles.bannerError : {}),
                  ...(messageType === "info" ? styles.bannerInfo : {}),
                }}
                role="alert"
                aria-live="assertive"
              >
                {message}
              </div>
            )}
          </div>
        </div>

        {/* toast */}
        {toast && (
          <div
            style={{
              ...styles.toast,
              ...(toast.type === "success" ? styles.toastSuccess : {}),
              ...(toast.type === "error" ? styles.toastError : {}),
              ...(toast.type === "info" ? styles.toastInfo : {}),
            }}
            role="status"
            aria-live="polite"
          >
            {toast.text}
          </div>
        )}

        {/* confirmation modal */}
        {confirmModal && (
          <div style={styles.modalOverlay} onClick={closeConfirm} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div id="confirm-modal-title" style={styles.modalTitle}>Confirm Action</div>
              <p style={{ color: "var(--muted)" }}>{confirmModal.text}</p>
              <div style={styles.modalButtons}>
                <button
                  onClick={closeConfirm}
                  style={{ ...styles.button, background: "transparent", border: "1px solid rgba(255,255,255,0.04)", color: "var(--muted)", flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => { await confirmModal.onConfirm(); closeConfirm(); }}
                  style={{ ...styles.button, ...styles.buttonDanger, flex: 1 }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default OwnerVerify;
