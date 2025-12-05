import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import { getAdminAnalytics } from "../api/api";
import {
  Users,
  Home,
  MapPin,
  Clock,
  Calendar,
  CreditCard,
  Search,
  Download,
  X,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [detailsModal, setDetailsModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [animatedValues, setAnimatedValues] = useState({});
  const navigate = useNavigate();
  const modalRef = useRef(null);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (stats) {
      Object.keys(stats).forEach((key) => {
        animateValue(key, 0, stats[key], 1200);
      });
    }
  }, [stats]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && detailsModal) {
        setDetailsModal(null);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [detailsModal]);

  const loadStats = async () => {
    const res = await getAdminAnalytics();
    if (!res.error) {
      setStats(res);
      showToast("Analytics loaded successfully", "success");
    } else {
      showToast("Failed to load analytics", "error");
    }
  };

  const animateValue = (key, start, end, duration) => {
    const startTime = performance.now();
    const isNumber = typeof end === "number" && !isNaN(end);

    if (!isNumber) {
      setAnimatedValues((prev) => ({ ...prev, [key]: end }));
      return;
    }

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = start + (end - start) * easeOutQuart;

      setAnimatedValues((prev) => ({
        ...prev,
        [key]: Math.floor(current),
      }));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const exportCSV = () => {
    if (!stats) return;
    const csv = Object.entries(stats)
      .map(([key, value]) => `${key},${value}`)
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported successfully", "success");
  };

  const cardConfigs = [
    {
      key: "total_users",
      title: "Total Users",
      icon: Users,
      path: "/super-admin/users",
      gradient: "linear-gradient(135deg, var(--accentA), var(--accentB))",
    },
    {
      key: "total_station_owners",
      title: "Station Owners",
      icon: Home,
      path: "/super-admin/owners",
      gradient: "linear-gradient(135deg, #06b6d4, #3b82f6)",
    },
    {
      key: "total_stations",
      title: "Stations",
      icon: MapPin,
      path: "/super-admin/station",
      gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    },
    {
      key: "pending_stations",
      title: "Pending Stations",
      icon: Clock,
      path: "/super-admin/station?filter=pending",
      gradient: "linear-gradient(135deg, #f97316, #fb923c)",
    },
    {
      key: "total_reservations",
      title: "Total Reservations",
      icon: Calendar,
      path: "/super-admin/reservations",
      gradient: "linear-gradient(135deg, #10b981, #22c55e)",
    },
    {
      key: "total_revenue",
      title: "Revenue",
      icon: CreditCard,
      path: "/super-admin/revenue",
      gradient: "linear-gradient(135deg, #ef4444, #f43f5e)",
      format: (val) => `₹${val?.toFixed(2) || 0}`,
    },
  ];

  const openDetails = (config) => {
    setDetailsModal(config);
  };

  const handleCardKeyDown = (e, config) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetails(config);
    }
  };

  return (
    <>
      <style>
        {`
          :root {
            --bg: #0f1724;
            --card: #0b1220;
            --muted: #94a3b8;
            --accentA: #06b6d4;
            --accentB: #6366f1;
            --success: #10b981;
            --danger: #ef4444;
            --glass: rgba(255, 255, 255, 0.04);
          }

          * {
            box-sizing: border-box;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes skeletonPulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.7; }
          }

          @keyframes slideDown {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }

          @keyframes iconBob {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }

          @keyframes modalFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes modalSlideUp {
            from { transform: translateY(50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }

          @keyframes toastSlideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }

          @keyframes barGrow {
            from { transform: scaleY(0); }
            to { transform: scaleY(1); }
          }

          .admin-dashboard-container {
            padding: clamp(16px, 4vw, 32px);
            background: var(--bg);
            min-height: 100vh;
            color: #fff;
          }

          .dashboard-header {
            margin-bottom: clamp(24px, 5vw, 40px);
            animation: fadeIn 0.5s ease-out;
          }

          .dashboard-title {
            font-size: clamp(28px, 5vw, 40px);
            font-weight: 800;
            margin: 0 0 8px 0;
            display: flex;
            align-items: center;
            gap: 12px;
            color: #fff;
          }

          .dashboard-subtitle {
            color: var(--muted);
            font-size: clamp(14px, 2.5vw, 16px);
            margin: 0 0 20px 0;
          }

          .action-row {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 16px;
          }

          .glass-control {
            background: var(--glass);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 10px 16px;
            color: #fff;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
            min-height: 44px;
          }

          .glass-control:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.2);
          }

          .glass-control input {
            background: transparent;
            border: none;
            outline: none;
            color: #fff;
            font-size: 14px;
            width: 100%;
            min-width: 150px;
          }

          .glass-control input::placeholder {
            color: var(--muted);
          }

          .glass-control button {
            background: transparent;
            border: none;
            color: #fff;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            padding: 0;
          }

          .export-btn {
            background: linear-gradient(135deg, var(--accentA), var(--accentB));
            cursor: pointer;
            font-weight: 600;
          }

          .export-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(6, 182, 212, 0.4);
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: clamp(16px, 3vw, 24px);
            margin-bottom: 32px;
          }

          @media (max-width: 640px) {
            .stats-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (min-width: 641px) and (max-width: 1024px) {
            .stats-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          .stat-card {
            background: var(--card);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 24px;
            position: relative;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            min-height: 180px;
            display: flex;
            flex-direction: column;
            animation: fadeIn 0.5s ease-out backwards;
          }

          .stat-card:nth-child(1) { animation-delay: 0.05s; }
          .stat-card:nth-child(2) { animation-delay: 0.1s; }
          .stat-card:nth-child(3) { animation-delay: 0.15s; }
          .stat-card:nth-child(4) { animation-delay: 0.2s; }
          .stat-card:nth-child(5) { animation-delay: 0.25s; }
          .stat-card:nth-child(6) { animation-delay: 0.3s; }

          .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--gradient);
            opacity: 0;
            transition: opacity 0.3s ease;
          }

          .stat-card:hover {
            transform: translateY(-6px);
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
            border-color: rgba(255, 255, 255, 0.15);
          }

          .stat-card:hover::before {
            opacity: 1;
          }

          .stat-card:hover .stat-icon {
            animation: iconBob 0.6s ease-in-out infinite;
          }

          .stat-card:focus {
            outline: 2px solid var(--accentA);
            outline-offset: 2px;
          }

          @media (prefers-reduced-motion: reduce) {
            .stat-card,
            .stat-card *,
            .glass-control,
            .export-btn {
              animation: none !important;
              transition: none !important;
            }
            .stat-card:hover {
              transform: none;
            }
          }

          .stat-card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
          }

          .stat-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: var(--gradient);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.3s ease;
          }

          .stat-title {
            color: var(--muted);
            font-size: 14px;
            font-weight: 500;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .stat-value {
            font-size: clamp(32px, 6vw, 44px);
            font-weight: 800;
            margin: 8px 0 12px 0;
            color: #fff;
            line-height: 1.2;
          }

          .stat-sparkline {
            height: 30px;
            display: flex;
            align-items: flex-end;
            gap: 2px;
            margin-top: auto;
          }

          .sparkline-bar {
            flex: 1;
            background: var(--gradient);
            opacity: 0.3;
            border-radius: 2px 2px 0 0;
            transition: opacity 0.2s ease;
          }

          .stat-card:hover .sparkline-bar {
            opacity: 0.6;
          }

          .stat-footer {
            display: flex;
            align-items: center;
            gap: 4px;
            color: var(--accentA);
            font-size: 13px;
            font-weight: 600;
            margin-top: 12px;
          }

          .skeleton-card {
            background: var(--card);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 24px;
            min-height: 180px;
            animation: skeletonPulse 1.5s ease-in-out infinite;
          }

          .skeleton-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.1);
            margin-bottom: 16px;
          }

          .skeleton-text {
            height: 14px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            margin-bottom: 12px;
            width: 60%;
          }

          .skeleton-value {
            height: 40px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            margin-bottom: 16px;
            width: 80%;
          }

          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
            animation: modalFadeIn 0.2s ease-out;
          }

          .modal-content {
            background: var(--card);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 32px;
            max-width: 600px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
            animation: modalSlideUp 0.3s ease-out;
            position: relative;
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 24px;
          }

          .modal-title {
            font-size: 24px;
            font-weight: 700;
            color: #fff;
            margin: 0;
          }

          .modal-close {
            background: rgba(255, 255, 255, 0.1);
            border: none;
            width: 36px;
            height: 36px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            color: #fff;
          }

          .modal-close:hover {
            background: rgba(255, 255, 255, 0.2);
          }

          .modal-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
          }

          .modal-stat-item {
            background: var(--glass);
            padding: 16px;
            border-radius: 12px;
            text-align: center;
          }

          .modal-stat-value {
            font-size: 28px;
            font-weight: 700;
            color: #fff;
            margin-bottom: 4px;
          }

          .modal-stat-label {
            font-size: 12px;
            color: var(--muted);
            text-transform: uppercase;
          }

          .modal-chart {
            background: var(--glass);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 24px;
            height: 150px;
            display: flex;
            align-items: flex-end;
            justify-content: space-around;
          }

          .chart-bar {
            width: 100%;
            background: linear-gradient(to top, var(--accentA), var(--accentB));
            border-radius: 4px 4px 0 0;
            transform-origin: bottom;
            animation: barGrow 0.6s ease-out backwards;
          }

          .chart-bar:nth-child(1) { animation-delay: 0.1s; }
          .chart-bar:nth-child(2) { animation-delay: 0.15s; }
          .chart-bar:nth-child(3) { animation-delay: 0.2s; }
          .chart-bar:nth-child(4) { animation-delay: 0.25s; }
          .chart-bar:nth-child(5) { animation-delay: 0.3s; }
          .chart-bar:nth-child(6) { animation-delay: 0.35s; }
          .chart-bar:nth-child(7) { animation-delay: 0.4s; }

          .modal-action {
            background: linear-gradient(135deg, var(--accentA), var(--accentB));
            border: none;
            color: #fff;
            padding: 14px 24px;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s ease;
            min-height: 44px;
          }

          .modal-action:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(6, 182, 212, 0.4);
          }

          .toast-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 2000;
            pointer-events: none;
          }

          .toast {
            background: var(--card);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-left: 4px solid var(--color);
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
            color: #fff;
            font-size: 14px;
            font-weight: 500;
            animation: toastSlideIn 0.3s ease-out;
            pointer-events: auto;
            min-width: 250px;
          }

          .toast.success {
            --color: var(--success);
          }

          .toast.error {
            --color: var(--danger);
          }

          .dashboard-footer {
            margin-top: 48px;
            padding-top: 32px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            animation: fadeIn 0.8s ease-out 0.4s backwards;
          }

          .footer-title {
            font-size: 20px;
            font-weight: 700;
            color: #fff;
            margin: 0 0 20px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .footer-charts {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 24px;
          }

          .footer-chart-card {
            background: var(--card);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 20px;
          }

          .footer-chart-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--muted);
            margin: 0 0 16px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .mini-bar-chart {
            display: flex;
            align-items: flex-end;
            gap: 8px;
            height: 100px;
          }

          .mini-bar {
            flex: 1;
            background: linear-gradient(to top, var(--accentA), var(--accentB));
            border-radius: 4px 4px 0 0;
            transition: opacity 0.2s ease;
            transform-origin: bottom;
            animation: barGrow 0.5s ease-out backwards;
          }

          .mini-bar:hover {
            opacity: 0.8;
          }

          .responsive-table {
            display: none;
          }

          @media (max-width: 480px) {
            .responsive-table {
              display: block;
              margin-top: 32px;
              overflow-x: auto;
            }

            .responsive-table table {
              width: 100%;
              border-collapse: collapse;
              background: var(--card);
              border-radius: 12px;
              overflow: hidden;
            }

            .responsive-table th,
            .responsive-table td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }

            .responsive-table th {
              background: rgba(255, 255, 255, 0.05);
              font-size: 12px;
              font-weight: 600;
              color: var(--muted);
              text-transform: uppercase;
            }

            .responsive-table td {
              font-size: 14px;
              color: #fff;
            }
          }
        `}
      </style>

      <AdminLayout>
        <div className="admin-dashboard-container">
          <div className="dashboard-header">
            <h1 className="dashboard-title">
              <TrendingUp size={36} />
              Super Admin Dashboard
            </h1>
            <p className="dashboard-subtitle">
              Real-time analytics and insights for your EV charging network
            </p>

            <div className="action-row">
              <div className="glass-control">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search metrics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search dashboard metrics"
                />
              </div>

              <div className="glass-control">
                <Calendar size={18} />
                <span>Last 30 days</span>
              </div>

              <div className="glass-control export-btn" onClick={exportCSV}>
                <button aria-label="Export analytics to CSV">
                  <Download size={18} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>

          {!stats ? (
            <div className="stats-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-icon"></div>
                  <div className="skeleton-text"></div>
                  <div className="skeleton-value"></div>
                  <div className="skeleton-text" style={{ width: "40%" }}></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="stats-grid">
                {cardConfigs.map((config) => {
                  const Icon = config.icon;
                  const value = animatedValues[config.key] ?? stats[config.key];
                  const displayValue = config.format
                    ? config.format(value)
                    : value;

                  return (
                    <div
                      key={config.key}
                      className="stat-card"
                      style={{ "--gradient": config.gradient }}
                      onClick={() => openDetails(config)}
                      onKeyDown={(e) => handleCardKeyDown(e, config)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${config.title}: ${displayValue}. Press Enter to view details.`}
                    >
                      <div className="stat-card-header">
                        <h3 className="stat-title">{config.title}</h3>
                        <div className="stat-icon">
                          <Icon size={24} color="#fff" />
                        </div>
                      </div>

                      <div className="stat-value">{displayValue}</div>

                      <div className="stat-sparkline">
                        {[40, 60, 45, 75, 55, 80, 70].map((height, i) => (
                          <div
                            key={i}
                            className="sparkline-bar"
                            style={{ height: `${height}%` }}
                          ></div>
                        ))}
                      </div>

                      <div className="stat-footer">
                        View details <ArrowRight size={14} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="dashboard-footer">
                <h2 className="footer-title">
                  <TrendingUp size={24} />
                  Performance Overview
                </h2>

                <div className="footer-charts">
                  <div className="footer-chart-card">
                    <h3 className="footer-chart-title">Monthly Growth</h3>
                    <div className="mini-bar-chart">
                      {[45, 60, 55, 75, 65, 85, 80].map((height, i) => (
                        <div
                          key={i}
                          className="mini-bar"
                          style={{
                            height: `${height}%`,
                            animationDelay: `${i * 0.05}s`,
                          }}
                        ></div>
                      ))}
                    </div>
                  </div>

                  <div className="footer-chart-card">
                    <h3 className="footer-chart-title">Revenue Trend</h3>
                    <div className="mini-bar-chart">
                      {[30, 50, 45, 70, 60, 85, 95].map((height, i) => (
                        <div
                          key={i}
                          className="mini-bar"
                          style={{
                            height: `${height}%`,
                            animationDelay: `${i * 0.05}s`,
                          }}
                        ></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardConfigs.map((config) => (
                      <tr key={config.key}>
                        <td>{config.title}</td>
                        <td>
                          {config.format
                            ? config.format(stats[config.key])
                            : stats[config.key]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {detailsModal && (
          <div
            className="modal-overlay"
            onClick={() => setDetailsModal(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              ref={modalRef}
            >
              <div className="modal-header">
                <h2 id="modal-title" className="modal-title">
                  {detailsModal.title}
                </h2>
                <button
                  className="modal-close"
                  onClick={() => setDetailsModal(null)}
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-stats">
                <div className="modal-stat-item">
                  <div className="modal-stat-value">
                    {detailsModal.format
                      ? detailsModal.format(stats[detailsModal.key])
                      : stats[detailsModal.key]}
                  </div>
                  <div className="modal-stat-label">Current</div>
                </div>
                <div className="modal-stat-item">
                  <div className="modal-stat-value">+12%</div>
                  <div className="modal-stat-label">vs Last Month</div>
                </div>
                <div className="modal-stat-item">
                  <div className="modal-stat-value">+28%</div>
                  <div className="modal-stat-label">vs Last Year</div>
                </div>
              </div>

              <div className="modal-chart">
                {[60, 75, 65, 85, 70, 90, 80].map((height, i) => (
                  <div
                    key={i}
                    className="chart-bar"
                    style={{ height: `${height}%` }}
                  ></div>
                ))}
              </div>

              <button
                className="modal-action"
                onClick={() => {
                  navigate(detailsModal.path);
                  setDetailsModal(null);
                }}
              >
                Go to {detailsModal.title} Page
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {toast && (
          <div className="toast-container" aria-live="polite" aria-atomic="true">
            <div className={`toast ${toast.type}`}>{toast.message}</div>
          </div>
        )}
      </AdminLayout>
    </>
  );
}
