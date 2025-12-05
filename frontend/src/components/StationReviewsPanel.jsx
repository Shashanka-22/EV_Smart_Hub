import React, { useEffect, useState, useRef } from "react";
import {
  getStationReviews,
  createStationReview,
} from "../api/api";

/**
 * StationReviewsPanel - Production-ready EV charging station review component
 *
 * Features:
 * - Interactive star rating with keyboard/hover support
 * - Image preview with client-side validation
 * - Optimistic UI updates
 * - Toast notifications (no alerts)
 * - Responsive design with touch-first sizing
 * - Accessibility (ARIA, keyboard shortcuts)
 * - Smooth animations with reduced-motion support
 * - Lazy-loaded images with skeleton shimmer
 *
 * Keyboard shortcuts:
 * - Ctrl+Enter: Submit review
 * - Esc: Clear form
 *
 * Customization points marked with 🎨 for theming
 * Integration points marked with 🔌 for analytics/webhooks
 */

export default function StationReviewsPanel({ stationId }) {
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [charCount, setCharCount] = useState(0);
  const [optimisticReviews, setOptimisticReviews] = useState([]);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const MAX_CHARS = 500;

  useEffect(() => {
    if (stationId) loadReviews();
  }, [stationId]);

  // 🔌 Keyboard shortcuts - wire analytics here
  useEffect(() => {
    const handleKeyboard = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && rating > 0) {
        handleSubmit(e);
      }
      if (e.key === "Escape") {
        clearForm();
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [rating, text, photo]);

  const loadReviews = async () => {
    const res = await getStationReviews(stationId);
    if (!res.error && Array.isArray(res)) {
      setReviews(res);
    } else {
      showToast("Failed to load reviews", "error");
    }
  };

  const showToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Client-side validation
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      showToast("Image must be under 5MB", "error");
      return;
    }

    if (!file.type.startsWith("image/")) {
      showToast("Please select a valid image file", "error");
      return;
    }

    setPhoto(file);

    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // 🔌 Wire image compression analytics here
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearForm = () => {
    setRating(0);
    setText("");
    setCharCount(0);
    removePhoto();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!rating) {
      showToast("Please select a rating", "warning");
      textareaRef.current?.focus();
      return;
    }

    const form = new FormData();
    form.append("rating", rating);
    form.append("review_text", text);
    if (photo) form.append("photo", photo);

    // Optimistic UI update
    const optimisticReview = {
      id: `temp-${Date.now()}`,
      rating,
      review_text: text,
      photo_url: photoPreview,
      username: "You",
      created_at: new Date().toISOString(),
      isOptimistic: true,
    };
    setOptimisticReviews((prev) => [optimisticReview, ...prev]);

    setSubmitting(true);
    const res = await createStationReview(stationId, form);
    setSubmitting(false);

    // Remove optimistic review
    setOptimisticReviews((prev) =>
      prev.filter((r) => r.id !== optimisticReview.id)
    );

    if (!res.error) {
      showToast("Review submitted successfully!", "success");
      clearForm();
      await loadReviews();
      // 🔌 Fire analytics event: review_submitted
    } else {
      showToast(res.error || "Failed to submit review", "error");
      // 🔌 Fire analytics event: review_error
    }
  };

  const getRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval > 1 ? "s" : ""} ago`;
      }
    }
    return "Just now";
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const allReviews = [...optimisticReviews, ...reviews];

  return (
    <>
      {/* 🎨 Global styles with CSS variables for theming */}
      <style>{`
        :root {
          --primary-gradient-start: #06b6d4;
          --primary-gradient-end: #6366f1;
          --navy-accent: #0b1220;
          --surface-light: #f8fafc;
          --surface-white: #ffffff;
          --success-lime: #a3e635;
          --warning-amber: #fbbf24;
          --error-red: #ef4444;
          --text-primary: #1e293b;
          --text-secondary: #64748b;
          --border-light: #e2e8f0;
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.05);
          --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
          --shadow-lg: 0 10px 30px rgba(0,0,0,0.12);
          --radius-sm: 8px;
          --radius-md: 12px;
          --radius-lg: 16px;
          --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
          --transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        @keyframes ripple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }

        @keyframes toastSlideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        @media (max-width: 640px) {
          .srp-container {
            padding: 16px !important;
          }
          .srp-form {
            padding: 16px !important;
          }
          .srp-review-card {
            padding: 12px !important;
          }
        }

        .srp-star-interactive:focus {
          outline: 2px solid var(--primary-gradient-end);
          outline-offset: 2px;
          border-radius: 4px;
        }

        .srp-button-ripple {
          position: relative;
          overflow: hidden;
        }

        .srp-button-ripple::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.5);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }

        .srp-button-ripple:active::after {
          width: 300px;
          height: 300px;
          transition: 0s;
        }

        .srp-skeleton {
          background: linear-gradient(
            90deg,
            #e2e8f0 25%,
            #f1f5f9 50%,
            #e2e8f0 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        .srp-toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          pointer-events: none;
        }

        .srp-toast {
          pointer-events: auto;
          animation: toastSlideIn 0.3s ease-out;
          min-width: 280px;
          max-width: 400px;
        }
      `}</style>

      {/* Toast notifications container */}
      <div className="srp-toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="srp-toast"
            style={{
              marginBottom: "12px",
              padding: "16px 20px",
              borderRadius: "var(--radius-md)",
              background: "var(--surface-white)",
              boxShadow: "var(--shadow-lg)",
              border: `2px solid ${
                toast.type === "success"
                  ? "var(--success-lime)"
                  : toast.type === "error"
                  ? "var(--error-red)"
                  : "var(--warning-amber)"
              }`,
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "20px" }}>
              {toast.type === "success"
                ? "✓"
                : toast.type === "error"
                ? "✕"
                : "⚠"}
            </span>
            <span style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: 500 }}>
              {toast.message}
            </span>
          </div>
        ))}
      </div>

      {/* Main panel container */}
      <div
        className="srp-container"
        style={{
          marginTop: "32px",
          padding: "28px",
          borderRadius: "var(--radius-lg)",
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          boxShadow: "var(--shadow-lg)",
          position: "relative",
          overflow: "hidden",
          animation: "fadeSlideIn 0.4s ease-out",
        }}
      >
        {/* Radial highlight gradient overlay - 🎨 adjust opacity/colors */}
        <div
          style={{
            position: "absolute",
            top: "-50%",
            right: "-20%",
            width: "60%",
            height: "120%",
            background: `radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)`,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Header with inline SVG star icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* 🎨 Swap this SVG for custom icon */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              filter: "drop-shadow(0 2px 4px rgba(99, 102, 241, 0.3))",
            }}
          >
            <path
              d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
              fill="url(#starGradient)"
              stroke="var(--primary-gradient-end)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="starGradient" x1="2" y1="2" x2="22" y2="21">
                <stop offset="0%" stopColor="var(--primary-gradient-start)" />
                <stop offset="100%" stopColor="var(--primary-gradient-end)" />
              </linearGradient>
            </defs>
          </svg>
          <h2
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 700,
              background: `linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end))`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "-0.02em",
            }}
          >
            Station Reviews
          </h2>
        </div>

        {/* NEW REVIEW FORM */}
        <form
          onSubmit={handleSubmit}
          className="srp-form"
          style={{
            padding: "20px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-light)",
            background: "var(--surface-light)",
            position: "relative",
            zIndex: 1,
          }}
          aria-label="Submit a new review"
        >
          {/* Interactive star rating */}
          <div style={{ marginBottom: "20px" }}>
            <label
              htmlFor="rating-group"
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Rating <span style={{ color: "var(--error-red)" }}>*</span>
            </label>
            <div
              id="rating-group"
              role="radiogroup"
              aria-label="Rating"
              aria-required="true"
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={rating === star}
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  tabIndex={rating === star ? 0 : -1}
                  className="srp-star-interactive"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" && star < 5) {
                      setRating(star + 1);
                    }
                    if (e.key === "ArrowLeft" && star > 1) {
                      setRating(star - 1);
                    }
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "32px",
                    padding: "4px",
                    transition: "transform var(--transition-fast)",
                    minWidth: "44px",
                    minHeight: "44px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform:
                      star <= (hoverRating || rating) ? "scale(1.15)" : "scale(1)",
                  }}
                >
                  <span
                    style={{
                      color:
                        star <= (hoverRating || rating)
                          ? "#fbbf24"
                          : "#d1d5db",
                      textShadow:
                        star <= (hoverRating || rating)
                          ? "0 2px 8px rgba(251, 191, 36, 0.4)"
                          : "none",
                      transition: "color var(--transition-fast)",
                    }}
                  >
                    ★
                  </span>
                </button>
              ))}
              <span
                style={{
                  marginLeft: "8px",
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  alignSelf: "center",
                }}
              >
                {hoverRating || rating || 0}/5
              </span>
            </div>
          </div>

          {/* Rich textarea with character counter */}
          <div style={{ marginBottom: "20px" }}>
            <label
              htmlFor="review-text"
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Your Experience
            </label>
            <textarea
              id="review-text"
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= MAX_CHARS) {
                  setText(val);
                  setCharCount(val.length);
                }
              }}
              placeholder="Share your experience with this charging station..."
              aria-describedby="char-counter"
              style={{
                width: "100%",
                minHeight: "100px",
                padding: "12px",
                borderRadius: "var(--radius-sm)",
                border: "2px solid var(--border-light)",
                fontSize: "14px",
                lineHeight: "1.6",
                fontFamily: "inherit",
                resize: "vertical",
                transition: "border-color var(--transition-fast), box-shadow var(--transition-fast)",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--primary-gradient-end)";
                e.target.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border-light)";
                e.target.style.boxShadow = "none";
              }}
            />
            <div
              id="char-counter"
              style={{
                marginTop: "6px",
                fontSize: "12px",
                color:
                  charCount > MAX_CHARS * 0.9
                    ? "var(--warning-amber)"
                    : "var(--text-secondary)",
                textAlign: "right",
              }}
            >
              {charCount}/{MAX_CHARS}
            </div>
          </div>

          {/* Image upload with preview */}
          <div style={{ marginBottom: "20px" }}>
            <label
              htmlFor="photo-upload"
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Photo (optional)
            </label>

            {!photoPreview ? (
              <div>
                <input
                  id="photo-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ display: "none" }}
                  aria-describedby="photo-hint"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: "12px 20px",
                    borderRadius: "var(--radius-sm)",
                    border: "2px dashed var(--border-light)",
                    background: "var(--surface-white)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 500,
                    transition: "all var(--transition-fast)",
                    width: "100%",
                    minHeight: "44px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary-gradient-end)";
                    e.currentTarget.style.background = "rgba(99, 102, 241, 0.02)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-light)";
                    e.currentTarget.style.background = "var(--surface-white)";
                  }}
                >
                  📸 Choose Image
                </button>
                <p
                  id="photo-hint"
                  style={{
                    marginTop: "6px",
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                  }}
                >
                  Max 5MB • JPG, PNG, WebP • Auto-compressed on upload
                </p>
              </div>
            ) : (
              <div
                style={{
                  position: "relative",
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                  border: "2px solid var(--border-light)",
                  maxWidth: "300px",
                }}
              >
                <img
                  src={photoPreview}
                  alt="Preview"
                  style={{
                    width: "100%",
                    height: "auto",
                    maxHeight: "200px",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    display: "flex",
                    gap: "6px",
                  }}
                >
                  <button
                    type="button"
                    onClick={removePhoto}
                    aria-label="Remove image"
                    style={{
                      padding: "8px",
                      borderRadius: "50%",
                      border: "none",
                      background: "rgba(239, 68, 68, 0.9)",
                      color: "white",
                      cursor: "pointer",
                      fontSize: "16px",
                      minWidth: "36px",
                      minHeight: "36px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "transform var(--transition-fast)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Submit button with gradient and loading state */}
          <button
            type="submit"
            disabled={submitting || rating === 0}
            className="srp-button-ripple"
            style={{
              padding: "14px 28px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background:
                submitting || rating === 0
                  ? "var(--text-secondary)"
                  : `linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end))`,
              color: "white",
              fontSize: "15px",
              fontWeight: 600,
              cursor: submitting || rating === 0 ? "not-allowed" : "pointer",
              minWidth: "160px",
              minHeight: "48px",
              transition: "all var(--transition-base)",
              boxShadow:
                submitting || rating === 0
                  ? "none"
                  : "0 4px 12px rgba(99, 102, 241, 0.3)",
              opacity: submitting || rating === 0 ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!submitting && rating > 0) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 8px 20px rgba(99, 102, 241, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(99, 102, 241, 0.3)";
            }}
          >
            {submitting ? (
              <span style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "16px",
                    height: "16px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    animation: "pulse 1s infinite",
                  }}
                />
                Submitting...
              </span>
            ) : (
              "Submit Review"
            )}
          </button>

          <p
            style={{
              marginTop: "12px",
              fontSize: "12px",
              color: "var(--text-secondary)",
            }}
          >
            💡 <kbd style={{ padding: "2px 6px", background: "var(--surface-white)", borderRadius: "4px", fontSize: "11px" }}>Ctrl+Enter</kbd> to submit • <kbd style={{ padding: "2px 6px", background: "var(--surface-white)", borderRadius: "4px", fontSize: "11px" }}>Esc</kbd> to clear
          </p>
        </form>

        {/* REVIEWS LIST */}
        <div
          style={{
            marginTop: "32px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: "16px",
            }}
          >
            Recent Reviews ({allReviews.length})
          </h3>

          {allReviews.length === 0 && (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "var(--text-secondary)",
                fontSize: "14px",
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "12px", opacity: 0.3 }}>
                💬
              </div>
              <p>No reviews yet. Be the first to share your experience!</p>
            </div>
          )}

          {allReviews.map((review, index) => (
            <div
              key={review.id}
              className="srp-review-card"
              style={{
                background: review.isOptimistic
                  ? "rgba(163, 230, 53, 0.08)"
                  : "var(--surface-white)",
                border: review.isOptimistic
                  ? "2px solid var(--success-lime)"
                  : "1px solid var(--border-light)",
                borderRadius: "var(--radius-md)",
                padding: "18px",
                marginBottom: "14px",
                boxShadow: "var(--shadow-sm)",
                transition: "all var(--transition-base)",
                animation: `fadeSlideIn 0.3s ease-out ${index * 0.05}s backwards`,
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "var(--shadow-md)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "var(--shadow-sm)";
              }}
            >
              {review.isOptimistic && (
                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--success-lime)",
                    background: "rgba(163, 230, 53, 0.15)",
                    padding: "4px 10px",
                    borderRadius: "12px",
                  }}
                >
                  Posting...
                </div>
              )}

              {/* User header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                {/* Avatar with initials */}
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end))`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "16px",
                    flexShrink: 0,
                  }}
                  aria-label={`${review.username}'s avatar`}
                >
                  {getInitials(review.username)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <strong
                      style={{
                        fontSize: "15px",
                        color: "var(--text-primary)",
                        fontWeight: 600,
                      }}
                    >
                      {review.username}
                    </strong>

                    {/* Animated star badges */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                      }}
                      aria-label={`Rating: ${review.rating} out of 5 stars`}
                    >
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: "16px",
                            color: i < review.rating ? "#fbbf24" : "#e5e7eb",
                            textShadow:
                              i < review.rating
                                ? "0 1px 3px rgba(251, 191, 36, 0.4)"
                                : "none",
                          }}
                        >
                          ★
                        </span>
                      ))}
                      <span
                        style={{
                          marginLeft: "6px",
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {review.rating}
                      </span>
                    </div>
                  </div>

                  {/* Relative timestamp */}
                  <small
                    style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      display: "block",
                      marginTop: "2px",
                    }}
                  >
                    {review.created_at && getRelativeTime(review.created_at)}
                  </small>
                </div>
              </div>

              {/* Review text */}
              {review.review_text && (
                <p
                  style={{
                    margin: "12px 0",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    color: "var(--text-primary)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {review.review_text}
                </p>
              )}

              {/* Lazy-loaded image with skeleton */}
              {review.photo_url && (
                <LazyImage
                  src={review.photo_url}
                  alt="Review photo"
                  style={{
                    marginTop: "12px",
                    width: "100%",
                    maxHeight: "280px",
                    borderRadius: "var(--radius-sm)",
                    objectFit: "cover",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * LazyImage component with skeleton shimmer loading state
 * 🔌 Wire intersection observer for performance monitoring
 */
function LazyImage({ src, alt, style }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const img = new Image();
          img.src = src;
          img.onload = () => setLoaded(true);
          img.onerror = () => setError(true);
          observer.disconnect();
        }
      },
      { rootMargin: "50px" }
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [src]);

  if (error) {
    return (
      <div
        style={{
          ...style,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-light)",
          color: "var(--text-secondary)",
          fontSize: "14px",
        }}
      >
        Failed to load image
      </div>
    );
  }

  return (
    <div ref={imgRef} style={{ position: "relative", ...style }}>
      {!loaded && (
        <div
          className="srp-skeleton"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
          }}
        />
      )}
      {loaded && (
        <img
          src={src}
          alt={alt}
          style={{
            ...style,
            display: "block",
            animation: "fadeSlideIn 0.3s ease-out",
          }}
          loading="lazy"
        />
      )}
    </div>
  );
}
