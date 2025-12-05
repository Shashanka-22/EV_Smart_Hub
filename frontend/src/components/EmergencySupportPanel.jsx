import React, { useState, useEffect } from "react";
import { sendEmergencyAlert } from "../api/api";

/**
 * EmergencySupportPanel - Production-ready emergency support component
 *
 * Features:
 * - Inline CSS with CSS variables for easy theming
 * - Accessible, touch-friendly CTAs (≥44px tap targets)
 * - In-component modals and toasts (no native alerts)
 * - Geolocation with graceful fallbacks
 * - Micro-interactions and animations
 * - Responsive design with media queries
 * - Prefers-reduced-motion support
 */
export default function EmergencySupportPanel({ station }) {
  const [sending, setSending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [coords, setCoords] = useState(null);

  // Support contact numbers - CUSTOMIZE HERE
  const supportNumber = station?.support_phone || "+91-9482994615";
  const ownerNumber = station?.owner_phone || supportNumber;
  const centralSupportNumber = "+919482994615"; // Central EV support hotline

  // Auto-dismiss toasts after 5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  const handleEmergencyClick = () => {
    if (!navigator.geolocation) {
      showToast("Geolocation not supported in this browser.", "error");
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmAndSendAlert = () => {
    setShowConfirmModal(false);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });

        setSending(true);

        try {
          // CUSTOMIZE MESSAGE TEMPLATE HERE
          const res = await sendEmergencyAlert({
            station_id: station?.id,
            issue_type: "emergency",
            message: `Emergency reported at station: ${station?.name || "Unknown"}`,
            lat,
            lng,
          });

          setSending(false);

          if (!res.error) {
            showToast("Emergency reported! Support will contact you shortly.", "success");
          } else {
            showToast(res.error || "Failed to send emergency alert.", "error");
          }
        } catch (error) {
          setSending(false);
          showToast("Network error. Please try calling support directly.", "error");
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        showToast("Unable to fetch location. Please enable location services.", "error");
      }
    );
  };

  const copyCoordinates = () => {
    if (coords) {
      navigator.clipboard.writeText(`${coords.lat}, ${coords.lng}`);
      showToast("Coordinates copied to clipboard!", "success");
    }
  };

  return (
    <>
      <style>{`
        :root {
          --esp-base: #0b1220;
          --esp-danger: #ef4444;
          --esp-danger-deep: #dc2626;
          --esp-danger-dark: #991b1b;
          --esp-coral: #fff1f2;
          --esp-rose: #fee2e2;
          --esp-success: #a3e635;
          --esp-success-dark: #65a30d;
        }

        .esp-panel {
          margin-top: 30px;
          padding: 24px;
          border-radius: 16px;
          background: linear-gradient(135deg, var(--esp-rose) 0%, var(--esp-coral) 100%);
          border: 2px solid #fecaca;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          position: relative;
          overflow: hidden;
          animation: esp-slide-in 0.4s ease-out;
        }

        @keyframes esp-slide-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .esp-panel {
            animation: none;
          }
          .esp-btn,
          .esp-modal-content,
          .esp-toast {
            transition: none !important;
            animation: none !important;
          }
        }

        .esp-panel::before {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(239, 68, 68, 0.1) 0%, transparent 70%);
          pointer-events: none;
        }

        .esp-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          position: relative;
          z-index: 1;
        }

        .esp-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--esp-danger) 0%, var(--esp-danger-deep) 100%);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        .esp-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--esp-danger-dark);
          margin: 0;
          letter-spacing: -0.02em;
        }

        .esp-description {
          font-size: 14px;
          line-height: 1.6;
          color: #7f1d1d;
          margin-bottom: 20px;
          position: relative;
          z-index: 1;
        }

        .esp-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          position: relative;
          z-index: 1;
        }

        .esp-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 44px;
          min-width: 44px;
          padding: 12px 20px;
          border-radius: 10px;
          border: none;
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          position: relative;
          overflow: hidden;
        }

        .esp-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .esp-btn:active {
          transform: translateY(0);
        }

        .esp-btn:focus-visible {
          outline: 3px solid var(--esp-success);
          outline-offset: 2px;
        }

        .esp-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none !important;
        }

        .esp-btn-primary {
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
        }

        .esp-btn-secondary {
          background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%);
        }

        .esp-btn-alert {
          background: linear-gradient(135deg, var(--esp-danger) 0%, var(--esp-danger-deep) 100%);
          animation: esp-pulse 2s ease-in-out infinite;
        }

        @keyframes esp-pulse {
          0%, 100% {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          50% {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 8px rgba(239, 68, 68, 0);
          }
        }

        .esp-btn-alert:hover {
          animation: none;
        }

        .esp-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: esp-spin 0.6s linear infinite;
        }

        @keyframes esp-spin {
          to { transform: rotate(360deg); }
        }

        /* Modal Styles */
        .esp-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(11, 18, 32, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
          animation: esp-fade-in 0.2s ease-out;
        }

        @keyframes esp-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .esp-modal-content {
          background: #ffffff;
          border-radius: 16px;
          padding: 28px;
          max-width: 420px;
          width: 100%;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          animation: esp-scale-in 0.2s ease-out;
        }

        @keyframes esp-scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .esp-modal-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--esp-danger-dark);
          margin: 0 0 12px 0;
        }

        .esp-modal-text {
          font-size: 14px;
          line-height: 1.6;
          color: #374151;
          margin-bottom: 24px;
        }

        .esp-modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .esp-modal-btn {
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 44px;
        }

        .esp-modal-btn-cancel {
          background: #f3f4f6;
          color: #374151;
        }

        .esp-modal-btn-cancel:hover {
          background: #e5e7eb;
        }

        .esp-modal-btn-confirm {
          background: linear-gradient(135deg, var(--esp-danger) 0%, var(--esp-danger-deep) 100%);
          color: #ffffff;
        }

        .esp-modal-btn-confirm:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        /* Toast Styles */
        .esp-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          min-width: 300px;
          max-width: 420px;
          padding: 16px 20px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          z-index: 10000;
          animation: esp-toast-in 0.3s ease-out;
        }

        @keyframes esp-toast-in {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .esp-toast-success {
          background: linear-gradient(135deg, var(--esp-success) 0%, var(--esp-success-dark) 100%);
          color: #ffffff;
        }

        .esp-toast-error {
          background: linear-gradient(135deg, var(--esp-danger) 0%, var(--esp-danger-deep) 100%);
          color: #ffffff;
        }

        .esp-toast-icon {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .esp-toast-message {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
        }

        .esp-toast-close {
          background: none;
          border: none;
          color: #ffffff;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.8;
          transition: opacity 0.2s ease;
        }

        .esp-toast-close:hover {
          opacity: 1;
        }

        .esp-check-animation {
          animation: esp-check 0.5s ease-out;
        }

        @keyframes esp-check {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        /* Responsive Design */
        @media (max-width: 640px) {
          .esp-panel {
            padding: 20px;
            margin-top: 20px;
          }

          .esp-actions {
            flex-direction: column;
          }

          .esp-btn {
            width: 100%;
          }

          .esp-toast {
            right: 12px;
            left: 12px;
            bottom: 12px;
            min-width: unset;
          }

          .esp-modal-actions {
            flex-direction: column-reverse;
          }

          .esp-modal-btn {
            width: 100%;
          }
        }

        @media (min-width: 641px) {
          .esp-actions {
            flex-direction: row;
          }

          .esp-btn {
            flex: 1;
            min-width: 160px;
          }
        }
      `}</style>

      <div className="esp-panel">
        {/* Header with Icon and Title */}
        <div className="esp-header">
          <div className="esp-icon-wrapper">
            {/* Inline SVG Siren Icon - SWAP ICON HERE */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "#ffffff" }}
              aria-hidden="true"
            >
              <path d="M7.86 2h8.28L22 12l-5.86 10H7.86L2 12L7.86 2z" />
              <path d="M12 8v4" />
              <circle cx="12" cy="16" r="1" />
            </svg>
          </div>
          <h3 className="esp-title">Emergency Support</h3>
        </div>

        {/* Description */}
        <p className="esp-description">
          If you face any issue while charging at this station, use one of the options below for immediate assistance:
        </p>

        {/* Action Buttons */}
        <div className="esp-actions">
          {/* Call Station Owner - CHANGE PHONE NUMBER IN VARIABLES ABOVE */}
          <a
            href={`tel:${ownerNumber}`}
            className="esp-btn esp-btn-primary"
            aria-label={`Call station owner at ${ownerNumber}`}
          >
            {/* Phone Icon - SWAP ICON HERE */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span>Call Station</span>
          </a>

          {/* Call Central EV Support - CHANGE PHONE NUMBER IN VARIABLES ABOVE */}
          <a
            href={`tel:${centralSupportNumber}`}
            className="esp-btn esp-btn-secondary"
            aria-label={`Call central EV support at ${centralSupportNumber}`}
          >
            {/* Support Icon - SWAP ICON HERE */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Call EV Support</span>
          </a>

          {/* Send Alert with GPS Location - ALTERNATIVE CHANNELS: Add SMS/WhatsApp/webhook here */}
          <button
            onClick={handleEmergencyClick}
            disabled={sending}
            className="esp-btn esp-btn-alert"
            aria-label="Send emergency alert with your GPS location"
          >
            {sending ? (
              <div className="esp-spinner" aria-hidden="true" />
            ) : (
              /* Location/Siren Icon - SWAP ICON HERE */
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            )}
            <span>{sending ? "Sending..." : "Send Alert + Location"}</span>
          </button>
        </div>

        {/* Copy Coordinates Fallback */}
        {coords && !sending && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={copyCoordinates}
              style={{
                padding: "8px 12px",
                fontSize: 12,
                background: "#f3f4f6",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
                color: "#374151",
              }}
              aria-label="Copy coordinates to clipboard"
            >
              📋 Copy Coordinates
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="esp-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="esp-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfirmModal(false);
          }}
        >
          <div className="esp-modal-content">
            <h4 id="esp-modal-title" className="esp-modal-title">
              Share Your Location?
            </h4>
            <p className="esp-modal-text">
              We'll send your current GPS coordinates along with the emergency alert to help support
              reach you faster. Your location will only be used for this emergency response.
            </p>
            <div className="esp-modal-actions">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="esp-modal-btn esp-modal-btn-cancel"
                aria-label="Cancel emergency alert"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndSendAlert}
                className="esp-modal-btn esp-modal-btn-confirm"
                aria-label="Confirm and send emergency alert"
              >
                Confirm & Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`esp-toast ${toast.type === "success" ? "esp-toast-success" : "esp-toast-error"}`}
          role="alert"
          aria-live="polite"
        >
          <div className="esp-toast-icon">
            {toast.type === "success" ? (
              /* Success Checkmark Icon - SWAP ICON HERE */
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="esp-check-animation"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              /* Error X Icon - SWAP ICON HERE */
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
          </div>
          <div className="esp-toast-message">{toast.message}</div>
          <button
            onClick={() => setToast(null)}
            className="esp-toast-close"
            aria-label="Close notification"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}

/**
 * CUSTOMIZATION GUIDE:
 *
 * 1. CHANGE SUPPORT PHONE NUMBERS:
 *    - Modify `supportNumber`, `ownerNumber`, and `centralSupportNumber` variables at the top of the component
 *
 * 2. SWAP ICONS:
 *    - Search for "SWAP ICON HERE" comments to replace inline SVG icons
 *    - Use your preferred icon library or custom SVGs
 *
 * 3. TWEAK MESSAGE TEMPLATES:
 *    - Search for "CUSTOMIZE MESSAGE TEMPLATE HERE" to modify the emergency alert message
 *
 * 4. CHANGE COLORS/THEME:
 *    - Edit CSS variables in :root (--esp-base, --esp-danger, etc.)
 *    - All colors cascade from these variables
 *
 * 5. ADD ALTERNATIVE ALERT CHANNELS:
 *    - Search for "ALTERNATIVE CHANNELS" comment
 *    - Add buttons for SMS: <a href={`sms:${supportNumber}?body=Emergency%20at%20station`}>SMS</a>
 *    - Add WhatsApp: <a href={`https://wa.me/${supportNumber}`}>WhatsApp</a>
 *    - Wire webhook: Call custom API endpoint in sendEmergencyAlert
 *
 * 6. ADJUST ANIMATIONS:
 *    - Modify keyframe animations (@keyframes) in the <style> block
 *    - Adjust animation durations and easings
 *
 * 7. RESPONSIVE BREAKPOINTS:
 *    - Edit media queries (@media) for different screen sizes
 *    - Currently set at 640px (mobile/desktop threshold)
 */
