import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { requestOtp, verifyAndRegister } from "../api/api";

/**
 * Dark glass themed Register page matching other screens:
 * - Deep navy background with teal->indigo radial highlights
 * - Dark glass card with soft glow
 * - Inputs are dark / glass style with light text
 * - Buttons use teal -> indigo gradient, secondary and tertiary styles
 *
 * Behavior unchanged: OTP request/resend, cooldown, verify & register
 */

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [focusedInput, setFocusedInput] = useState("");

  // cooldown countdown
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    try {
      const res = await requestOtp(form);
      setLoading(false);

      if (res?.error) {
        if (res.status === 429) {
          const wait = res.retry_after || 60;
          setCooldown(wait);
          setMsg("Too many requests. Please wait before retrying.");
        } else {
          setMsg(res.error || "Failed to send OTP");
        }
      } else {
        setMsg("OTP sent to your email.");
        setStep(2);
        setCooldown(res.retry_after || 60);
      }
    } catch (err) {
      setLoading(false);
      setMsg(err?.message || "Network error");
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setMsg("");
    try {
      const res = await requestOtp(form);
      setLoading(false);
      if (res?.error) setMsg(res.error || "Failed to resend");
      else {
        setMsg("OTP resent to your email.");
        setCooldown(res.retry_after || 60);
      }
    } catch (err) {
      setLoading(false);
      setMsg(err?.message || "Network error");
    }
  };

  const handleVerifyRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const res = await verifyAndRegister({ ...form, otp });
      setLoading(false);
      if (res?.error) setMsg(res.error || "Verification failed");
      else {
        setMsg("Registration successful! Redirecting…");
        setTimeout(() => navigate("/login"), 1400);
      }
    } catch (err) {
      setLoading(false);
      setMsg(err?.message || "Network error");
    }
  };

  /* ---------------- theme & styles (dark glass) ---------------- */
  const styles = {
    root: {
      minHeight: "100vh",
      background:
        "radial-gradient(circle at 15% 20%, rgba(6,182,212,0.03), transparent 8%), radial-gradient(circle at 85% 85%, rgba(99,102,241,0.03), transparent 8%), linear-gradient(180deg, #071225 0%, #0b1724 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "18px",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      color: "#e6eef6",
    },
    card: {
      position: "relative",
      width: "100%",
      maxWidth: "560px",
      borderRadius: "18px",
      padding: "40px",
      background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      border: "1px solid rgba(255,255,255,0.04)",
      boxShadow: "0 20px 60px rgba(2,6,23,0.7)",
      overflow: "hidden",
    },
    cardGlow: {
      content: "''",
      position: "absolute",
      top: "-30%",
      left: "-30%",
      width: "200%",
      height: "200%",
      background:
        "radial-gradient(circle at 40% 40%, rgba(99,102,241,0.06), transparent 20%), radial-gradient(circle at 80% 20%, rgba(6,182,212,0.05), transparent 20%)",
      pointerEvents: "none",
      zIndex: 0,
    },
    decoration: {
      position: "absolute",
      right: "-40px",
      top: "-40px",
      fontSize: "140px",
      opacity: 0.05,
      color: "#06b6d4",
      zIndex: 0,
      userSelect: "none",
      pointerEvents: "none",
    },
    header: {
      position: "relative",
      zIndex: 1,
      textAlign: "center",
      marginBottom: "28px",
    },
    title: {
      fontSize: "28px",
      fontWeight: 800,
      margin: 0,
      color: "transparent",
      background: "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      display: "inline-block",
      letterSpacing: "-0.02em",
    },
    subtitle: {
      marginTop: "6px",
      color: "#93a4b8",
      fontSize: "14px",
      fontWeight: 500,
    },

    form: {
      position: "relative",
      zIndex: 1,
      display: "flex",
      flexDirection: "column",
      gap: "18px",
    },

    inputGroup: {
      position: "relative",
    },

    label: {
      display: "block",
      fontSize: "13px",
      fontWeight: 700,
      color: "#93a4b8",
      marginBottom: "8px",
    },

    inputWrapper: {
      position: "relative",
    },

    inputIcon: {
      position: "absolute",
      left: "12px",
      top: "50%",
      transform: "translateY(-50%)",
      width: "20px",
      height: "20px",
      color: "#6b7280",
      pointerEvents: "none",
      transition: "color 0.16s ease",
      zIndex: 2,
    },

    inputIconActive: {
      color: "#06b6d4",
    },

    input: {
      width: "100%",
      padding: "12px 16px 12px 44px",
      fontSize: "15px",
      color: "#e6eef6",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.04)",
      borderRadius: "12px",
      outline: "none",
      transition: "all 140ms ease",
      boxSizing: "border-box",
      minHeight: "44px",
    },

    inputFocused: {
      borderColor: "rgba(99,102,241,0.5)",
      boxShadow: "0 8px 20px rgba(99,102,241,0.06)",
      transform: "translateY(-1px)",
    },

    select: {
      width: "100%",
      padding: "12px 16px 12px 44px",
      fontSize: "15px",
      color: "#e6eef6",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.04)",
      borderRadius: "12px",
      outline: "none",
      appearance: "none",
      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2393a4b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 12px center",
      backgroundSize: "18px",
    },

    otpInput: {
      width: "100%",
      padding: "18px",
      fontSize: "26px",
      color: "#e6eef6",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.04)",
      borderRadius: "12px",
      outline: "none",
      textAlign: "center",
      letterSpacing: "10px",
      fontFamily: "monospace",
      fontWeight: 800,
    },

    button: {
      width: "100%",
      padding: "14px",
      fontSize: "15px",
      fontWeight: 800,
      color: "#fff",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      transition: "all 160ms ease",
      background: "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
      boxShadow: "0 10px 30px rgba(6,11,20,0.6)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "10px",
    },

    buttonHover: {
      transform: "translateY(-2px)",
      boxShadow: "0 18px 40px rgba(99,102,241,0.12)",
    },

    buttonSecondary: {
      background: "transparent",
      color: "#06b6d4",
      border: "1px solid rgba(6,182,212,0.18)",
      boxShadow: "none",
      fontWeight: 700,
    },

    buttonTertiary: {
      background: "transparent",
      color: "#93a4b8",
      border: "1px solid rgba(255,255,255,0.04)",
    },

    message: {
      marginTop: "14px",
      padding: "12px 14px",
      borderRadius: "10px",
      display: "flex",
      gap: "10px",
      alignItems: "center",
      fontWeight: 700,
    },

    msgSuccess: {
      background: "linear-gradient(90deg, rgba(16,185,129,0.08), rgba(6,182,212,0.02))",
      color: "#10b981",
      border: "1px solid rgba(16,185,129,0.14)",
    },

    msgError: {
      background: "linear-gradient(90deg, rgba(239,68,68,0.06), rgba(6,182,212,0.01))",
      color: "#ef4444",
      border: "1px solid rgba(239,68,68,0.14)",
    },

    stepWrapper: {
      display: "flex",
      justifyContent: "center",
      gap: "10px",
      marginBottom: "18px",
      zIndex: 1,
    },

    stepDot: {
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.04)",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
      transition: "all 200ms ease",
    },

    stepDotActive: {
      background: "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
      boxShadow: "0 6px 18px rgba(99,102,241,0.16)",
      transform: "scale(1.25)",
    },
  };

  const keyframes = `
    @keyframes cardEntrance {
      from { opacity:0; transform: translateY(24px) scale(0.98); }
      to { opacity:1; transform: translateY(0) scale(1); }
    }
    @keyframes slideUp {
      from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); }
    }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @media (max-width: 640px) {
      .register-card { padding: 24px !important; border-radius: 14px !important; }
      .register-title { font-size: 22px !important; }
    }
    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `;

  const getInputStyle = (name) => {
    const base = { ...styles.input };
    if (focusedInput === name) return { ...base, ...styles.inputFocused };
    return base;
  };

  const getIconStyle = (name) => {
    return { ...styles.inputIcon, ...(focusedInput === name ? styles.inputIconActive : {}) };
  };

  const getSelectStyle = () => {
    return { ...styles.select, ...(focusedInput === "role" ? styles.inputFocused : {}) };
  };

  const getOtpStyle = () => {
    return { ...styles.otpInput, ...(focusedInput === "otp" ? styles.inputFocused : {}) };
  };

  const getMessageStyle = () => {
    if (!msg) return null;
    if (msg.toLowerCase().includes("success") || msg.toLowerCase().includes("sent")) return { ...styles.message, ...styles.msgSuccess };
    if (msg.toLowerCase().includes("too many") || msg.toLowerCase().includes("wait") || msg.toLowerCase().includes("resent")) return { ...styles.message, ...styles.msgSuccess };
    return { ...styles.message, ...styles.msgError };
  };

  // small svg icons
  const UserIcon = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" style={getIconStyle("name")} aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.6" fill="none"/>
    </svg>
  );

  const EmailIcon = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" style={getIconStyle("email")} aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none"/>
      <path d="M22 7l-10 6L2 7" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const LockIcon = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" style={getIconStyle("password")} aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const CarIcon = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" style={getIconStyle("role")} aria-hidden>
      <path d="M3 13h18l-1-4c-1-3-5-4-8-4s-7 1-8 4l-1 4z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="7.5" cy="17.5" r="1.8" stroke="currentColor" strokeWidth="1.6" fill="none"/>
      <circle cx="16.5" cy="17.5" r="1.8" stroke="currentColor" strokeWidth="1.6" fill="none"/>
    </svg>
  );

  const Spinner = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" style={{ animation: "spin 0.9s linear infinite" }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.12" fill="none"/>
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
    </svg>
  );

  const CheckIcon = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const AlertIcon = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
      <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2"/>
      <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );

  const BoltIcon = () => (
    <svg viewBox="0 0 24 24" width="22" height="22" style={{ marginRight: 8 }} aria-hidden>
      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="#a3e635" />
    </svg>
  );

  return (
    <>
      <style>{keyframes}</style>

      <div style={styles.root}>
        <div style={styles.card} className="register-card" role="main" aria-labelledby="register-heading">
          <div style={styles.cardGlow} />
          <div style={styles.decoration}>⚡</div>

          <div style={styles.header}>
            <h2 id="register-heading" style={styles.title} className="register-title">
              <BoltIcon />
              {step === 1 ? "Create Account" : "Verify Email"}
            </h2>
            <p style={styles.subtitle} className="register-subtitle">
              {step === 1 ? "Join the EV charging network" : `A verification code was sent to ${form.email || "your email"}`}
            </p>
          </div>

          <div style={{ ...styles.stepWrapper }}>
            <div style={{ ...styles.stepDot, ...(step >= 1 ? styles.stepDotActive : {}) }} aria-hidden />
            <div style={{ width: 32 }} />
            <div style={{ ...styles.stepDot, ...(step >= 2 ? styles.stepDotActive : {}) }} aria-hidden />
          </div>

          {step === 1 && (
            <form onSubmit={handleRequestOtp} style={styles.form} className="register-form" noValidate>
              <div style={styles.inputGroup}>
                <label htmlFor="name" style={styles.label}>Full name</label>
                <div style={styles.inputWrapper}>
                  <UserIcon />
                  <input
                    id="name"
                    className="register-input"
                    type="text"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    onFocus={() => setFocusedInput("name")}
                    onBlur={() => setFocusedInput("")}
                    required
                    disabled={loading}
                    autoComplete="name"
                    style={getInputStyle("name")}
                    aria-required
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label htmlFor="email" style={styles.label}>Email address</label>
                <div style={styles.inputWrapper}>
                  <EmailIcon />
                  <input
                    id="email"
                    className="register-input"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    onFocus={() => setFocusedInput("email")}
                    onBlur={() => setFocusedInput("")}
                    required
                    disabled={loading}
                    autoComplete="email"
                    style={getInputStyle("email")}
                    aria-required
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label htmlFor="password" style={styles.label}>Password</label>
                <div style={styles.inputWrapper}>
                  <LockIcon />
                  <input
                    id="password"
                    className="register-input"
                    type="password"
                    placeholder="Create a strong password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    onFocus={() => setFocusedInput("password")}
                    onBlur={() => setFocusedInput("")}
                    required
                    disabled={loading}
                    autoComplete="new-password"
                    style={getInputStyle("password")}
                    aria-required
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label htmlFor="role" style={styles.label}>Account type</label>
                <div style={styles.inputWrapper}>
                  <CarIcon />
                  <select
                    id="role"
                    className="register-select"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    onFocus={() => setFocusedInput("role")}
                    onBlur={() => setFocusedInput("")}
                    disabled={loading}
                    style={getSelectStyle()}
                    aria-required
                  >
                    <option value="user">EV Driver — find stations</option>
                    <option value="station_owner">Station Owner — manage network</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="register-button"
                disabled={loading || cooldown > 0}
                aria-busy={loading}
                style={{
                  ...styles.button,
                  ...(loading || cooldown > 0 ? { opacity: 0.7, cursor: "not-allowed" } : {}),
                }}
                onMouseEnter={(e) => {
                  if (!loading && cooldown === 0) Object.assign(e.currentTarget.style, styles.buttonHover);
                }}
                onMouseLeave={(e) => {
                  if (!loading && cooldown === 0) Object.assign(e.currentTarget.style, styles.button);
                }}
              >
                {loading ? (
                  <>
                    <Spinner /> Sending code...
                  </>
                ) : cooldown > 0 ? (
                  <>
                    ⏳ Wait {cooldown}s
                  </>
                ) : (
                  <>
                    🚀 Continue to verification
                  </>
                )}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyRegister} style={styles.form} className="register-form">
              <div style={styles.inputGroup}>
                <label htmlFor="otp" style={styles.label}>6-digit code</label>
                <input
                  id="otp"
                  className="register-otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onFocus={() => setFocusedInput("otp")}
                  onBlur={() => setFocusedInput("")}
                  required
                  disabled={loading}
                  maxLength={6}
                  style={getOtpStyle()}
                  aria-required
                  autoComplete="one-time-code"
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button
                  type="submit"
                  className="register-button"
                  disabled={loading || otp.length !== 6}
                  aria-busy={loading}
                  style={{
                    ...styles.button,
                    ...(loading || otp.length !== 6 ? { opacity: 0.65, cursor: "not-allowed" } : {}),
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && otp.length === 6) Object.assign(e.currentTarget.style, styles.buttonHover);
                  }}
                  onMouseLeave={(e) => {
                    if (!loading && otp.length === 6) Object.assign(e.currentTarget.style, styles.button);
                  }}
                >
                  {loading ? <Spinner /> : <CheckIcon />} Complete registration
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={cooldown > 0 || loading}
                  style={{
                    ...styles.button,
                    ...styles.buttonSecondary,
                    ...(cooldown > 0 || loading ? { opacity: 0.7, cursor: "not-allowed" } : {}),
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && cooldown === 0) Object.assign(e.currentTarget.style, { transform: "translateY(-2px)" });
                  }}
                  onMouseLeave={(e) => {
                    if (!loading && cooldown === 0) Object.assign(e.currentTarget.style, { transform: "translateY(0)" });
                  }}
                >
                  {cooldown > 0 ? `⏳ Resend in ${cooldown}s` : "🔄 Resend code"}
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{ ...styles.button, ...styles.buttonTertiary }}
                >
                  ← Back to registration
                </button>
              </div>
            </form>
          )}

          {msg && (
            <div style={getMessageStyle()} role={msg.toLowerCase().includes("success") ? "status" : "alert"} aria-live="polite">
              {msg.toLowerCase().includes("success") || msg.toLowerCase().includes("sent") ? <CheckIcon /> : <AlertIcon />}
              <span style={{ marginLeft: 8 }}>{msg}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Register;
