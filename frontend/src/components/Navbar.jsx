import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import {
  Menu,
  X,
  Zap,
  Battery,
  Settings,
  MapPin,
  Calendar,
  Shield,
  LogOut,
  User,
  UserPlus,
  Navigation,
  Users,
  Flag,
  CreditCard,
  BarChart,
  Moon,
  Sun,
  Bell,
} from "lucide-react";

/**
 * POLISHED EV SMART HUB NAVBAR
 *
 * Features:
 * - Glassy, modern design with gradient accents
 * - Sticky-on-scroll with compact mode
 * - Animated mobile drawer
 * - Avatar with initials + status badge
 * - Notification badges (ready for API integration)
 * - Dark/light theme toggle
 * - Full accessibility (ARIA, keyboard nav, focus rings)
 * - Micro-interactions (hover, active, bounce, lift)
 * - Prefers-reduced-motion support
 *
 * Color System:
 * - Background: #0b1220 (deep navy)
 * - Primary gradient: #06b6d4 → #6366f1 (teal → indigo)
 * - Success accent: #a3e635 (warm lime)
 * - Surfaces: rgba(255,255,255,0.06)
 *
 * Customization Points:
 * - Line 80-200: CSS variables for theme colors
 * - Line 650: Badge count logic (connect to API)
 * - Line 750: Avatar image source (swap initials for photo)
 * - Line 300-400: Animation timings
 */

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [theme, setTheme] = useState("dark"); // 'dark' | 'light'

  // TODO: Connect to real notification/reservation API
  const [notificationCount] = useState(3); // Example: fetch from useNotifications() hook
  const [reservationCount] = useState(2); // Example: fetch from API

  // Check screen size
  useEffect(() => {
    const checkScreen = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setIsMobileMenuOpen(false);
    };
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  // Scroll listener for sticky compact mode
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/login");
      setIsMobileMenuOpen(false);
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isActiveLink = (path) => location.pathname === path;

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Role-based navigation
  const navLinks = user
    ? user.role === "station_owner"
      ? [
          { path: "/admin", label: "Dashboard", icon: Battery },
          { path: "/admin/panel", label: "Manage Stations", icon: Shield },
          { path: "/admin/reservations", label: "Reservations", icon: Calendar, badge: reservationCount },
          { path: "/admin/charging", label: "Charging", icon: Battery },
        ]
      : user.role === "super_admin"
      ? [
          { path: "/super-admin/dashboard", label: "Dashboard", icon: BarChart },
          { path: "/super-admin/stations", label: "Stations Approval", icon: MapPin },
          { path: "/super-admin/reservations", label: "Reservations", icon: Calendar, badge: reservationCount },
          { path: "/super-admin/revenue", label: "Revenue", icon: CreditCard },
          { path: "/super-admin/refunds", label: "Refund Logs", icon: Flag },
          { path: "/super-admin/performance", label: "Performance", icon: BarChart },
        ]
      : [
          { path: "/dashboard", label: "Dashboard", icon: Zap },
          { path: "/smart-charging", label: "Smart Charging", icon: Settings },
          { path: "/stations", label: "Stations", icon: MapPin },
          { path: "/trip-planner", label: "Trip Planner", icon: Navigation },
          { path: "/my-reservations", label: "My Reservations", icon: Calendar, badge: reservationCount },
        ]
    : [];

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return "?";
    const email = user.email || "";
    const parts = email.split("@")[0].split(".");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <>
      {/* ============================================
          INLINE STYLES WITH CSS VARIABLES
          Adjust these tokens to customize theme
          ============================================ */}
      <style>{`
        :root {
          /* Color System - DARK THEME */
          --nav-bg-dark: #0b1220;
          --nav-surface-dark: rgba(255, 255, 255, 0.06);
          --nav-text-dark: #ffffff;
          --nav-text-muted-dark: rgba(255, 255, 255, 0.7);
          --nav-border-dark: rgba(255, 255, 255, 0.1);

          /* Color System - LIGHT THEME (optional) */
          --nav-bg-light: #f8fafc;
          --nav-surface-light: #ffffff;
          --nav-text-light: #0f172a;
          --nav-text-muted-light: #64748b;
          --nav-border-light: rgba(15, 23, 42, 0.1);

          /* Gradients & Accents */
          --gradient-primary: linear-gradient(135deg, #06b6d4 0%, #6366f1 100%);
          --gradient-hover: linear-gradient(135deg, #0891b2 0%, #4f46e5 100%);
          --accent-success: #a3e635;
          --accent-warning: #fbbf24;
          --accent-danger: #ef4444;

          /* Shadows */
          --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          --shadow-glow: 0 0 20px rgba(99, 102, 241, 0.3);

          /* Timings - Adjust for faster/slower animations */
          --transition-fast: 150ms;
          --transition-base: 250ms;
          --transition-slow: 350ms;
          --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
          --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* Theme application */
        [data-theme="dark"] {
          --nav-bg: var(--nav-bg-dark);
          --nav-surface: var(--nav-surface-dark);
          --nav-text: var(--nav-text-dark);
          --nav-text-muted: var(--nav-text-muted-dark);
          --nav-border: var(--nav-border-dark);
        }

        [data-theme="light"] {
          --nav-bg: var(--nav-bg-light);
          --nav-surface: var(--nav-surface-light);
          --nav-text: var(--nav-text-light);
          --nav-text-muted: var(--nav-text-muted-light);
          --nav-border: var(--nav-border-light);
        }

        /* Global navbar container */
        .navbar-container {
          position: sticky;
          top: 0;
          z-index: 1000;
          background: var(--nav-bg, #0b1220);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--nav-border, rgba(255, 255, 255, 0.1));
          transition: all var(--transition-base) var(--ease-out);
        }

        .navbar-container.scrolled {
          box-shadow: var(--shadow-lg);
        }

        .navbar-container.scrolled .navbar-inner {
          padding-top: 0.5rem;
          padding-bottom: 0.5rem;
        }

        /* Inner navbar with radial gradient highlights */
        .navbar-inner {
          position: relative;
          max-width: 1400px;
          margin: 0 auto;
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: padding var(--transition-base) var(--ease-out);
        }

        .navbar-inner::before {
          content: "";
          position: absolute;
          top: -50%;
          left: 10%;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%);
          pointer-events: none;
          z-index: -1;
        }

        .navbar-inner::after {
          content: "";
          position: absolute;
          top: -50%;
          right: 10%;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
          pointer-events: none;
          z-index: -1;
        }

        /* Logo */
        .navbar-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--nav-text, #ffffff);
          font-weight: 700;
          font-size: 1.25rem;
          text-decoration: none;
          transition: all var(--transition-fast) var(--ease-out);
          position: relative;
        }

        .navbar-logo:hover {
          transform: translateY(-1px);
        }

        .navbar-logo:focus-visible {
          outline: 2px solid #06b6d4;
          outline-offset: 4px;
          border-radius: 0.375rem;
        }

        .navbar-logo svg {
          transition: transform var(--transition-base) var(--ease-bounce);
        }

        .navbar-logo:hover svg {
          transform: rotate(-10deg) scale(1.1);
        }

        /* Desktop nav links container */
        .nav-desktop {
          display: none;
          align-items: center;
          gap: 0.25rem;
        }

        @media (min-width: 768px) {
          .nav-desktop {
            display: flex;
          }
        }

        /* Nav link item */
        .nav-link {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.625rem 1rem;
          border-radius: 0.5rem;
          text-decoration: none;
          color: var(--nav-text-muted, rgba(255, 255, 255, 0.7));
          font-weight: 500;
          font-size: 0.9375rem;
          transition: all var(--transition-base) var(--ease-out);
          white-space: nowrap;
        }

        .nav-link:hover {
          color: var(--nav-text, #ffffff);
          background: var(--nav-surface, rgba(255, 255, 255, 0.06));
          transform: translateY(-1px);
        }

        .nav-link:focus-visible {
          outline: 2px solid #06b6d4;
          outline-offset: 2px;
        }

        .nav-link.active {
          color: #06b6d4;
          background: var(--nav-surface, rgba(255, 255, 255, 0.06));
        }

        /* Animated underline for active link */
        .nav-link::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 50%;
          width: 0;
          height: 2px;
          background: var(--gradient-primary);
          border-radius: 2px;
          transform: translateX(-50%);
          transition: width var(--transition-base) var(--ease-out);
        }

        .nav-link.active::after {
          width: calc(100% - 2rem);
        }

        /* Icon micro-bounce on click */
        .nav-link:active svg {
          animation: iconBounce 0.3s var(--ease-bounce);
        }

        @keyframes iconBounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }

        /* Badge indicator */
        .nav-badge {
          position: absolute;
          top: 0.25rem;
          right: 0.25rem;
          min-width: 1.125rem;
          height: 1.125rem;
          padding: 0 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-danger, #ef4444);
          color: white;
          font-size: 0.625rem;
          font-weight: 700;
          border-radius: 9999px;
          box-shadow: 0 0 0 2px var(--nav-bg, #0b1220);
        }

        /* Avatar container */
        .nav-avatar {
          position: relative;
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 50%;
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all var(--transition-base) var(--ease-out);
          box-shadow: var(--shadow-md);
        }

        .nav-avatar:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow: var(--shadow-glow);
        }

        .nav-avatar:focus-visible {
          outline: 2px solid #06b6d4;
          outline-offset: 2px;
        }

        /* Status badge on avatar */
        .avatar-status {
          position: absolute;
          bottom: -1px;
          right: -1px;
          width: 0.75rem;
          height: 0.75rem;
          border-radius: 50%;
          background: var(--accent-success, #a3e635);
          border: 2px solid var(--nav-bg, #0b1220);
          box-shadow: var(--shadow-sm);
        }

        /* CTA Button (Logout, Theme Toggle, etc.) */
        .nav-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          border-radius: 0.5rem;
          border: none;
          background: var(--nav-surface, rgba(255, 255, 255, 0.06));
          color: var(--nav-text, #ffffff);
          font-weight: 500;
          font-size: 0.9375rem;
          cursor: pointer;
          transition: all var(--transition-base) var(--ease-out);
          white-space: nowrap;
        }

        .nav-button:hover {
          background: var(--nav-surface, rgba(255, 255, 255, 0.12));
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        .nav-button:active {
          transform: translateY(0);
        }

        .nav-button:focus-visible {
          outline: 2px solid #06b6d4;
          outline-offset: 2px;
        }

        .nav-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .nav-button.primary {
          background: var(--gradient-primary);
          color: white;
          font-weight: 600;
        }

        .nav-button.primary:hover {
          background: var(--gradient-hover);
          box-shadow: var(--shadow-glow);
        }

        .nav-button.danger {
          background: rgba(239, 68, 68, 0.1);
          color: var(--accent-danger, #ef4444);
          border: 1px solid var(--accent-danger, #ef4444);
        }

        .nav-button.danger:hover {
          background: var(--accent-danger, #ef4444);
          color: white;
        }

        /* Icon button (mobile menu, theme toggle) */
        .icon-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 0.5rem;
          border: none;
          background: var(--nav-surface, rgba(255, 255, 255, 0.06));
          color: var(--nav-text, #ffffff);
          cursor: pointer;
          transition: all var(--transition-base) var(--ease-out);
        }

        .icon-button:hover {
          background: var(--nav-surface, rgba(255, 255, 255, 0.12));
          transform: scale(1.05);
        }

        .icon-button:active {
          transform: scale(0.95);
        }

        .icon-button:focus-visible {
          outline: 2px solid #06b6d4;
          outline-offset: 2px;
        }

        /* Mobile menu button */
        .mobile-menu-button {
          display: flex;
        }

        @media (min-width: 768px) {
          .mobile-menu-button {
            display: none;
          }
        }

        /* Mobile drawer overlay */
        .mobile-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          z-index: 999;
          animation: fadeIn var(--transition-base) var(--ease-out);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Mobile drawer */
        .mobile-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 85%;
          max-width: 320px;
          background: var(--nav-bg, #0b1220);
          border-left: 1px solid var(--nav-border, rgba(255, 255, 255, 0.1));
          box-shadow: var(--shadow-lg);
          overflow-y: auto;
          z-index: 1000;
          animation: slideInRight var(--transition-slow) var(--ease-out);
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .mobile-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid var(--nav-border, rgba(255, 255, 255, 0.1));
        }

        .mobile-drawer-content {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        /* Mobile nav link */
        .mobile-nav-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          border-radius: 0.5rem;
          text-decoration: none;
          color: var(--nav-text-muted, rgba(255, 255, 255, 0.7));
          font-weight: 500;
          transition: all var(--transition-base) var(--ease-out);
          min-height: 44px; /* Touch-friendly */
        }

        .mobile-nav-link:hover,
        .mobile-nav-link.active {
          color: var(--nav-text, #ffffff);
          background: var(--nav-surface, rgba(255, 255, 255, 0.06));
        }

        .mobile-nav-link.active {
          background: var(--gradient-primary);
          color: white;
        }

        .mobile-nav-link:active {
          transform: scale(0.98);
        }

        /* Divider */
        .nav-divider {
          height: 1px;
          background: var(--nav-border, rgba(255, 255, 255, 0.1));
          margin: 0.5rem 0;
        }

        /* Notification bell */
        .notification-button {
          position: relative;
        }

        .notification-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 1rem;
          height: 1rem;
          padding: 0 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-danger, #ef4444);
          color: white;
          font-size: 0.625rem;
          font-weight: 700;
          border-radius: 9999px;
          box-shadow: 0 0 0 2px var(--nav-bg, #0b1220);
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        /* Loading spinner */
        .spinner {
          width: 1rem;
          height: 1rem;
          border: 2px solid var(--nav-surface, rgba(255, 255, 255, 0.2));
          border-top-color: var(--nav-text, #ffffff);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Auth buttons (login/register) */
        .auth-buttons {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .auth-link {
          padding: 0.625rem 1.25rem;
          border-radius: 0.5rem;
          text-decoration: none;
          font-weight: 600;
          transition: all var(--transition-base) var(--ease-out);
          min-height: 44px;
          display: flex;
          align-items: center;
        }

        .auth-link.login {
          color: var(--nav-text, #ffffff);
          background: var(--nav-surface, rgba(255, 255, 255, 0.06));
        }

        .auth-link.login:hover {
          background: var(--nav-surface, rgba(255, 255, 255, 0.12));
          transform: translateY(-1px);
        }

        .auth-link.register {
          color: white;
          background: var(--gradient-primary);
        }

        .auth-link.register:hover {
          background: var(--gradient-hover);
          transform: translateY(-2px);
          box-shadow: var(--shadow-glow);
        }

        /* Utility classes */
        .flex {
          display: flex;
        }

        .items-center {
          align-items: center;
        }

        .gap-2 {
          gap: 0.5rem;
        }

        .gap-4 {
          gap: 1rem;
        }
      `}</style>

      {/* ============================================
          NAVBAR MARKUP
          ============================================ */}
      <nav
        className={`navbar-container ${isScrolled ? "scrolled" : ""}`}
        data-theme={theme}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="navbar-inner">
          {/* LOGO */}
          <Link
            to={user ? "/dashboard" : "/"}
            className="navbar-logo"
            aria-label="EV Smart Hub Home"
          >
            <Zap size={24} strokeWidth={2.5} />
            <span>EV Smart Hub</span>
          </Link>

          {/* DESKTOP NAVIGATION */}
          {!isMobile && (
            <div className="nav-desktop">
              {user ? (
                <>
                  {/* Nav Links */}
                  {navLinks.map((link) => {
                    const Icon = link.icon;
                    const active = isActiveLink(link.path);
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        className={`nav-link ${active ? "active" : ""}`}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon size={18} strokeWidth={2} />
                        <span>{link.label}</span>
                        {link.badge && link.badge > 0 && (
                          <span className="nav-badge" aria-label={`${link.badge} notifications`}>
                            {link.badge > 9 ? "9+" : link.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}

                  {/* Notification Bell */}
                  <button
                    className="icon-button notification-button"
                    aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ""}`}
                    title="Notifications"
                  >
                    <Bell size={20} strokeWidth={2} />
                    {notificationCount > 0 && (
                      <span className="notification-badge">
                        {notificationCount > 9 ? "9+" : notificationCount}
                      </span>
                    )}
                  </button>

                  {/* Theme Toggle */}
                  <button
                    className="icon-button"
                    onClick={toggleTheme}
                    aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                    title="Toggle theme"
                  >
                    {theme === "dark" ? (
                      <Sun size={20} strokeWidth={2} />
                    ) : (
                      <Moon size={20} strokeWidth={2} />
                    )}
                  </button>

                  {/* Avatar with Profile Link */}
                  <Link
                    to="/profile"
                    className="nav-avatar"
                    aria-label="View profile"
                    title="Profile"
                  >
                    {/* TODO: Replace with <img src={user.avatarUrl} alt="" /> when available */}
                    {getUserInitials()}
                    <span className="avatar-status" aria-hidden="true" />
                  </Link>

                  {/* Logout */}
                  <button
                    className="nav-button danger"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    aria-label="Logout"
                  >
                    {isLoggingOut ? (
                      <div className="spinner" aria-hidden="true" />
                    ) : (
                      <LogOut size={18} strokeWidth={2} />
                    )}
                    <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
                  </button>
                </>
              ) : (
                <div className="auth-buttons">
                  <Link to="/login" className="auth-link login">
                    Login
                  </Link>
                  <Link to="/register" className="auth-link register">
                    Register
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* MOBILE MENU BUTTON */}
          {isMobile && (
            <button
              className="icon-button mobile-menu-button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMobileMenuOpen ? (
                <X size={24} strokeWidth={2} />
              ) : (
                <Menu size={24} strokeWidth={2} />
              )}
            </button>
          )}
        </div>
      </nav>

      {/* ============================================
          MOBILE DRAWER
          ============================================ */}
      {isMobile && isMobileMenuOpen && (
        <>
          {/* Overlay */}
          <div
            className="mobile-overlay"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <div
            id="mobile-menu"
            className="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation menu"
          >
            {/* Header */}
            <div className="mobile-drawer-header">
              {user && (
                <div className="flex items-center gap-2">
                  <div className="nav-avatar" style={{ width: "2.5rem", height: "2.5rem" }}>
                    {getUserInitials()}
                    <span className="avatar-status" />
                  </div>
                  <div>
                    <div style={{ color: "var(--nav-text)", fontWeight: 600, fontSize: "0.875rem" }}>
                      {user.email?.split("@")[0]}
                    </div>
                    <div style={{ color: "var(--nav-text-muted)", fontSize: "0.75rem", textTransform: "capitalize" }}>
                      {user.role?.replace("_", " ") || "User"}
                    </div>
                  </div>
                </div>
              )}
              <button
                className="icon-button"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X size={24} strokeWidth={2} />
              </button>
            </div>

            {/* Content */}
            <div className="mobile-drawer-content">
              {user ? (
                <>
                  {/* Nav Links */}
                  {navLinks.map((link) => {
                    const Icon = link.icon;
                    const active = isActiveLink(link.path);
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        className={`mobile-nav-link ${active ? "active" : ""}`}
                        onClick={() => setIsMobileMenuOpen(false)}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon size={20} strokeWidth={2} />
                        <span style={{ flex: 1 }}>{link.label}</span>
                        {link.badge && link.badge > 0 && (
                          <span className="nav-badge" style={{ position: "static" }}>
                            {link.badge > 9 ? "9+" : link.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}

                  <div className="nav-divider" />

                  {/* Notifications */}
                  <button className="mobile-nav-link" style={{ border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                    <Bell size={20} strokeWidth={2} />
                    <span style={{ flex: 1 }}>Notifications</span>
                    {notificationCount > 0 && (
                      <span className="nav-badge" style={{ position: "static" }}>
                        {notificationCount > 9 ? "9+" : notificationCount}
                      </span>
                    )}
                  </button>

                  {/* Profile */}
                  <Link
                    to="/profile"
                    className="mobile-nav-link"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <User size={20} strokeWidth={2} />
                    <span>Profile</span>
                  </Link>

                  {/* Theme Toggle */}
                  <button
                    className="mobile-nav-link"
                    onClick={toggleTheme}
                    style={{ border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
                  >
                    {theme === "dark" ? (
                      <>
                        <Sun size={20} strokeWidth={2} />
                        <span>Light Mode</span>
                      </>
                    ) : (
                      <>
                        <Moon size={20} strokeWidth={2} />
                        <span>Dark Mode</span>
                      </>
                    )}
                  </button>

                  <div className="nav-divider" />

                  {/* Logout */}
                  <button
                    className="nav-button danger"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    style={{ width: "100%", minHeight: "44px" }}
                  >
                    {isLoggingOut ? (
                      <div className="spinner" />
                    ) : (
                      <LogOut size={20} strokeWidth={2} />
                    )}
                    <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="mobile-nav-link"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <User size={20} strokeWidth={2} />
                    <span>Login</span>
                  </Link>
                  <Link
                    to="/register"
                    className="mobile-nav-link active"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <UserPlus size={20} strokeWidth={2} />
                    <span>Register</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Navbar;
