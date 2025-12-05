import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { loginUser } from "../api/api";

/**
 * Dark glass themed Login page matching the station/owner dashboards:
 * - Deep navy background with teal->indigo radial highlights
 * - Dark glass card
 * - Inputs styled as dark inputs with light text
 * - Buttons use teal->indigo gradient and emerald accent for success
 */

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [focusedInput, setFocusedInput] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    try {
      const res = await loginUser({ email, password });

      if (res.error || !res.token) {
        setMsg(res.error || "Login failed");
        return;
      }

      login(res.token);

      const role = res.user?.role || "user";
      setMsg("Login successful! Redirecting…");

      setTimeout(() => {
        if (role === "super_admin") navigate("/super-admin");
        else if (role === "station_owner") navigate("/admin");
        else navigate("/dashboard");
      }, 900);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      setMsg(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Dark theme styles ----------
  const styles = {
    container: {
      minHeight: "100vh",
      background:
        "radial-gradient(circle at 10% 10%, rgba(6,182,212,0.03), transparent 8%), radial-gradient(circle at 85% 85%, rgba(99,102,241,0.03), transparent 8%), linear-gradient(180deg, #071225 0%, #0b1724 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "18px",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      position: "relative",
      color: "var(--text-color)",
    },

    bgPattern: {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      backgroundImage:
        "radial-gradient(circle at 20% 40%, rgba(6,182,212,0.04) 0%, transparent 40%), radial-gradient(circle at 80% 20%, rgba(99,102,241,0.03) 0%, transparent 40%)",
    },

    // Dark glass card
    card: {
      position: "relative",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      borderRadius: "18px",
      boxShadow: "0 20px 60px rgba(2,6,23,0.7)",
      padding: "40px 36px",
      width: "100%",
      maxWidth: "460px",
      border: "1px solid rgba(255,255,255,0.04)",
      zIndex: 1,
      overflow: "hidden",
    },

    logoContainer: {
      display: "flex",
      justifyContent: "center",
      marginBottom: "20px",
    },

    header: {
      textAlign: "center",
      marginBottom: "26px",
    },

    title: {
      fontSize: "28px",
      fontWeight: 800,
      marginBottom: "6px",
      color: "transparent",
      background:
        "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      letterSpacing: "-0.02em",
    },

    subtitle: {
      fontSize: "14px",
      color: "#93a4b8",
      fontWeight: 500,
      margin: 0,
    },

    form: {
      display: "flex",
      flexDirection: "column",
      gap: "18px",
    },

    inputGroup: {
      position: "relative",
    },

    label: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontSize: "13px",
      fontWeight: 700,
      color: "#94a3b8",
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
      transition: "color 0.18s ease",
    },

    inputIconFocused: {
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

    inputDisabled: {
      opacity: 0.6,
      cursor: "not-allowed",
    },

    button: {
      width: "100%",
      padding: "14px",
      fontSize: "15px",
      fontWeight: 800,
      color: "#fff",
      border: "none",
      borderRadius: "12px",
      cursor: loading ? "not-allowed" : "pointer",
      transition: "all 160ms ease",
      boxShadow: "0 10px 30px rgba(6, 11, 20, 0.6)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "10px",
    },

    buttonPrimary: {
      background:
        "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
    },

    buttonHover: {
      transform: "translateY(-2px)",
      boxShadow: "0 18px 40px rgba(99,102,241,0.12)",
    },

    message: {
      padding: "12px 14px",
      borderRadius: "10px",
      fontSize: "14px",
      fontWeight: 700,
      marginTop: "18px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },

    messageSuccess: {
      background: "linear-gradient(90deg, rgba(16,185,129,0.08), rgba(6,182,212,0.02))",
      border: "1px solid rgba(16,185,129,0.14)",
      color: "#10b981",
    },

    messageError: {
      background: "linear-gradient(90deg, rgba(239,68,68,0.06), rgba(6,182,212,0.01))",
      border: "1px solid rgba(239,68,68,0.14)",
      color: "#ef4444",
    },

    smallNote: {
      marginTop: "10px",
      fontSize: "13px",
      color: "#7b8b98",
      textAlign: "center",
    },
  };

  const getInputStyle = (inputName) => {
    const base = { ...styles.input };
    if (focusedInput === inputName) return { ...base, ...styles.inputFocused };
    if (loading) return { ...base, ...styles.inputDisabled };
    return base;
  };

  const getInputIconStyle = (inputName) => {
    const base = { ...styles.inputIcon };
    if (focusedInput === inputName) return { ...base, ...styles.inputIconFocused };
    return base;
  };

  const getMessageStyle = () => {
    const baseStyle = { ...styles.message };
    if (msg.toLowerCase().includes("successful") || msg.toLowerCase().includes("redirect")) {
      return { ...baseStyle, ...styles.messageSuccess };
    } else if (msg.toLowerCase().includes("failed") || msg.toLowerCase().includes("error")) {
      return { ...baseStyle, ...styles.messageError };
    }
    return { ...baseStyle, background: "rgba(255,255,255,0.02)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.03)" };
  };

  // ---------- Inline SVG icons ----------
  const EmailIcon = ({ style }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 18, height: 18, color: style.color }}
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 6L2 7" />
    </svg>
  );

  const LockIcon = ({ style }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 18, height: 18, color: style.color }}
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );

  // simplified bolt logo for header
  const BoltLogo = () => (
    <svg
      viewBox="0 0 64 64"
      width="60"
      height="60"
      role="img"
      aria-label="logo"
      style={{ display: "block", filter: "drop-shadow(0 8px 28px rgba(6,11,20,0.6))" }}
    >
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="12" fill="url(#g1)" />
      <path d="M40 14L24 34h10l-4 16 18-26H36l4-16z" fill="#a7f3d0" />
    </svg>
  );

  const SpinnerIcon = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" style={{ animation: "spin 0.9s linear infinite" }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.16" fill="none" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );

  const CheckIcon = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  const AlertIcon = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );

  // Inline keyframes and small responsive tweaks
  const keyframes = `
    @keyframes cardEntrance {
      from { opacity:0; transform: translateY(24px) scale(0.98); }
      to { opacity:1; transform: translateY(0) scale(1); }
    }

    @keyframes slideUp {
      from { opacity:0; transform: translateY(12px); }
      to { opacity:1; transform: translateY(0); }
    }

    @keyframes spin {
      from { transform: rotate(0deg); } to { transform: rotate(360deg); }
    }

    @media (max-width: 520px) {
      .login-card { padding: 28px 20px !important; border-radius: 14px !important; }
      .login-title { font-size: 22px !important; }
    }

    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `;

  return (
    <>
      <style>{keyframes}</style>

      <div style={styles.container}>
        <div style={styles.bgPattern} aria-hidden="true" />

        <div style={styles.card} className="login-card" role="main" aria-labelledby="login-heading">
          <div style={styles.logoContainer}>
            <BoltLogo />
          </div>

          <div style={styles.header}>
            <h1 id="login-heading" style={styles.title} className="login-title">Welcome Back</h1>
            <p style={styles.subtitle}>Sign in to your EV charging account</p>
          </div>

          <form onSubmit={handleLogin} style={styles.form} noValidate>
            <div style={styles.inputGroup}>
              <label htmlFor="email" style={styles.label}>Email Address</label>
              <div style={styles.inputWrapper}>
                <div style={getInputIconStyle("email")}>
                  <EmailIcon style={{ color: focusedInput === "email" ? "#06b6d4" : "#6b7280" }} />
                </div>

                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedInput("email")}
                  onBlur={() => setFocusedInput("")}
                  required
                  disabled={loading}
                  autoComplete="email"
                  aria-required="true"
                  aria-invalid={msg.toLowerCase().includes("failed") && email ? "true" : "false"}
                  aria-describedby={msg && msg.toLowerCase().includes("failed") ? "error-message" : undefined}
                  style={getInputStyle("email")}
                  className="login-input"
                />
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label htmlFor="password" style={styles.label}>Password</label>
              <div style={styles.inputWrapper}>
                <div style={getInputIconStyle("password")}>
                  <LockIcon style={{ color: focusedInput === "password" ? "#06b6d4" : "#6b7280" }} />
                </div>

                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedInput("password")}
                  onBlur={() => setFocusedInput("")}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  aria-required="true"
                  aria-invalid={msg.toLowerCase().includes("failed") && password ? "true" : "false"}
                  aria-describedby={msg && msg.toLowerCase().includes("failed") ? "error-message" : undefined}
                  style={getInputStyle("password")}
                  className="login-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              aria-live="polite"
              style={{ ...styles.button, ...styles.buttonPrimary, ...(loading ? styles.inputDisabled : {}) }}
              className="login-button"
              onMouseEnter={(e) => { if (!loading) Object.assign(e.currentTarget.style, styles.buttonHover); }}
              onMouseLeave={(e) => { if (!loading) Object.assign(e.currentTarget.style, { ...styles.button, ...styles.buttonPrimary }); }}
            >
              {loading ? (
                <>
                  <SpinnerIcon />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {msg && (
            <div
              id="error-message"
              role={msg.toLowerCase().includes("successful") ? "status" : "alert"}
              aria-live="polite"
              style={getMessageStyle()}
            >
              {msg.toLowerCase().includes("successful") ? <CheckIcon /> : <AlertIcon />}
              <span style={{ marginLeft: 8 }}>{msg}</span>
            </div>
          )}

          <div style={styles.smallNote}>
            Not a member? Ask your admin to create an account.
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
