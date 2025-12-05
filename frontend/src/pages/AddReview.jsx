import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createStationReview } from "../api/api";

export default function AddReview() {
  const { stationId } = useParams();
  const navigate = useNavigate();

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [imageError, setImageError] = useState(null);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const MAX_CHARS = 500;
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

  useEffect(() => {
    setMounted(true);
    const draft = localStorage.getItem(`review-draft-${stationId}`);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setRating(parsed.rating || 0);
        setReviewText(parsed.reviewText || "");
      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }

    const handleKeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        submitReview();
      }
      if (e.key === "Escape") {
        navigate(-1);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, navigate]);

  useEffect(() => {
    if (rating || reviewText) {
      localStorage.setItem(
        `review-draft-${stationId}`,
        JSON.stringify({ rating, reviewText })
      );
    }
  }, [rating, reviewText, stationId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [reviewText]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageError(null);

    if (!file.type.startsWith("image/")) {
      setImageError("Please select a valid image file");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setImageError("Image must be smaller than 5MB");
      return;
    }

    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setPhoto(null);
    setPhotoPreview(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submitReview = async () => {
    if (!rating) {
      showToast("Please select a star rating", "error");
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const form = new FormData();
      form.append("rating", rating);
      form.append("review_text", reviewText);
      if (photo) form.append("photo", photo);

      const res = await createStationReview(stationId, form);

      if (!res.error) {
        localStorage.removeItem(`review-draft-${stationId}`);
        showToast("Review submitted successfully!", "success");
        setTimeout(() => navigate(-1), 1200);
      } else {
        showToast(res.error || "Failed to submit review", "error");
        setIsSubmitting(false);
      }
    } catch (error) {
      showToast("Network error. Your draft has been saved.", "error");
      setIsSubmitting(false);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <>
      <style>{`
        :root {
          --bg-top: #041622;
          --bg-bottom: #0f2433;
          --glass-card: rgba(255,255,255,0.03);
          --card-border: rgba(255,255,255,0.06);
          --accent-teal: #06b6d4;
          --accent-indigo: #6366f1;
          --accent-gradient: linear-gradient(135deg, #06b6d4 0%, #6366f1 100%);
          --accent-green: #22c55e;
          --text-light: rgba(255,255,255,0.95);
          --text-muted: rgba(255,255,255,0.72);
          --danger: #ef4444;
          --glass-strong: rgba(255,255,255,0.04);
          --shadow-deep: 0 20px 60px rgba(0,0,0,0.6);
        }

        * { box-sizing: border-box; }

        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastSlide { from { transform: translateY(-100%); opacity:0 } to { transform: translateY(0); opacity:1 } }

        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }

        .star-button:focus-visible, .focus-ring:focus-visible {
          outline: 3px solid rgba(6,182,212,0.14);
          outline-offset: 3px;
          border-radius: 6px;
        }

        textarea:focus {
          box-shadow: 0 0 0 4px rgba(6,182,212,0.06);
        }

        @media (max-width: 640px) {
          .review-card { margin: 0 !important; border-radius: 10px !important; min-height: 100vh; }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: `radial-gradient(800px 400px at 10% 6%, rgba(6,182,212,0.03), transparent 10%), linear-gradient(135deg, var(--bg-top), var(--bg-bottom))`,
          padding: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          color: "var(--text-light)",
        }}
      >
        <div
          className="review-card"
          style={{
            width: "100%",
            maxWidth: 640,
            background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
            border: "1px solid var(--card-border)",
            borderRadius: 20,
            padding: "28px",
            boxShadow: "var(--shadow-deep)",
            position: "relative",
            overflow: "hidden",
            animation: mounted ? "fadeSlideIn 0.45s ease-out both" : "none",
            color: "var(--text-light)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -80,
              right: -60,
              width: 420,
              height: 420,
              background:
                "radial-gradient(circle at center, rgba(6,182,212,0.06), transparent 40%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <defs>
                  <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <path
                  d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                  fill="url(#g1)"
                />
              </svg>

              <h2
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 800,
                  color: "var(--text-light)",
                }}
              >
                Share your experience
              </h2>
            </div>

            {/* Rating */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text-light)",
                  marginBottom: 10,
                }}
              >
                Your rating <span style={{ color: "var(--danger)" }}>*</span>
              </label>

              <div
                role="radiogroup"
                aria-label="Rating"
                aria-required="true"
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="star-button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onFocus={() => setHoverRating(star)}
                    onBlur={() => setHoverRating(0)}
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                    aria-checked={rating === star}
                    role="radio"
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 6,
                      transform: star <= displayRating ? "scale(1.08)" : "scale(1)",
                      transition: "transform 0.18s ease",
                      minWidth: 44,
                      minHeight: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                    }}
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                        fill={star <= displayRating ? "#facc15" : "rgba(255,255,255,0.12)"}
                        stroke={star <= displayRating ? "#eab308" : "rgba(255,255,255,0.18)"}
                        strokeWidth="1"
                        style={{ transition: "all 0.18s ease" }}
                      />
                    </svg>
                  </button>
                ))}

                <span
                  aria-live="polite"
                  style={{
                    marginLeft: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text-light)",
                  }}
                >
                  {rating > 0 ? `${rating}/5` : "—"}
                </span>
              </div>
            </div>

            {/* Review Text */}
            <div style={{ marginBottom: 22 }}>
              <label
                htmlFor="review-text"
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text-light)",
                  marginBottom: 8,
                }}
              >
                Your review
              </label>

              <textarea
                id="review-text"
                ref={textareaRef}
                className="focus-ring"
                value={reviewText}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_CHARS) {
                    setReviewText(e.target.value);
                  }
                }}
                placeholder="Share details about charging speed, station condition, location convenience, amenities..."
                maxLength={MAX_CHARS}
                style={{
                  width: "100%",
                  minHeight: 120,
                  padding: "14px 16px",
                  fontSize: 15,
                  lineHeight: 1.6,
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  resize: "none",
                  background: "rgba(255,255,255,0.02)",
                  color: "var(--text-light)",
                  boxSizing: "border-box",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 8,
                  fontSize: 13,
                  color: reviewText.length >= MAX_CHARS * 0.9 ? "var(--danger)" : "var(--text-muted)",
                }}
              >
                {reviewText.length}/{MAX_CHARS}
              </div>
            </div>

            {/* Photo upload */}
            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text-light)",
                  marginBottom: 12,
                }}
              >
                Add photo (optional)
              </label>

              {!photoPreview ? (
                <label
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: "block",
                    padding: "28px 18px",
                    border: "1px dashed rgba(255,255,255,0.06)",
                    borderRadius: 12,
                    textAlign: "center",
                    cursor: "pointer",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.005))",
                    transition: "all 0.16s ease",
                    color: "var(--text-muted)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(6,182,212,0.4)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="13" r="4" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                  </svg>
                  <p style={{ margin: "12px 0 6px", fontSize: 15, fontWeight: 700, color: "var(--text-light)" }}>
                    Click to upload image
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                    PNG, JPG up to 5MB
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: "none" }}
                    aria-label="Upload photo"
                  />
                </label>
              ) : (
                <div
                  style={{
                    position: "relative",
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <img
                    src={photoPreview}
                    alt="Preview"
                    style={{
                      width: "100%",
                      height: 220,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <div style={{ position: "absolute", top: 12, right: 12 }}>
                    <button
                      type="button"
                      onClick={removeImage}
                      aria-label="Remove image"
                      style={{
                        minWidth: 44,
                        minHeight: 44,
                        padding: 10,
                        background: "rgba(0,0,0,0.5)",
                        border: "none",
                        borderRadius: "50%",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "transform 0.14s ease",
                        color: "white",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(239,68,68,0.95)";
                        e.currentTarget.style.transform = "scale(1.06)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(0,0,0,0.5)";
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {imageError && (
                <p
                  role="alert"
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: "var(--danger)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  {imageError}
                </p>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => navigate(-1)}
                disabled={isSubmitting}
                style={{
                  flex: "0 0 auto",
                  minHeight: 52,
                  padding: "0 20px",
                  fontSize: 15,
                  fontWeight: 700,
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  background: "transparent",
                  color: "var(--text-light)",
                  transition: "transform 0.14s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitReview}
                disabled={isSubmitting || !rating}
                aria-label={isSubmitting ? "Submitting review" : "Submit review"}
                style={{
                  flex: 1,
                  minHeight: 52,
                  padding: "0 24px",
                  fontSize: 15,
                  fontWeight: 800,
                  border: "none",
                  borderRadius: 12,
                  cursor: isSubmitting || !rating ? "not-allowed" : "pointer",
                  background: isSubmitting || !rating ? "rgba(255,255,255,0.06)" : "var(--accent-gradient)",
                  color: isSubmitting || !rating ? "rgba(255,255,255,0.5)" : "#001219",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  transition: "transform 0.14s ease, box-shadow 0.14s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting && rating) {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow = "0 10px 28px rgba(6,182,212,0.14)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {isSubmitting ? (
                  <>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ animation: "spin 0.8s linear infinite" }}
                      aria-hidden
                    >
                      <circle cx="12" cy="12" r="10" opacity="0.2" />
                      <path d="M22 12a10 10 0 0 0-10-10" opacity="0.8" />
                    </svg>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit review</span>
                )}
              </button>
            </div>

            <p
              style={{
                marginTop: 14,
                fontSize: 12,
                color: "var(--text-muted)",
                textAlign: "center",
              }}
            >
              <kbd
                style={{
                  padding: "2px 6px",
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 6,
                  fontFamily: "monospace",
                  fontSize: 11,
                }}
              >
                Ctrl+Enter
              </kbd>{" "}
              to submit •{" "}
              <kbd
                style={{
                  padding: "2px 6px",
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 6,
                  fontFamily: "monospace",
                  fontSize: 11,
                }}
              >
                Esc
              </kbd>{" "}
              to cancel
            </p>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            role="alert"
            aria-live="polite"
            style={{
              position: "fixed",
              top: 20,
              right: 20,
              maxWidth: 420,
              padding: "12px 16px",
              background: toast.type === "success" ? "linear-gradient(90deg,#a3e635,#84cc16)" : "linear-gradient(90deg,#ef4444,#dc2626)",
              color: toast.type === "success" ? "#0f172a" : "#fff",
              borderRadius: 12,
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              display: "flex",
              gap: 12,
              alignItems: "center",
              animation: "toastSlide 0.26s ease-out both",
              zIndex: 1200,
              fontWeight: 700,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              {toast.type === "success" ? (
                <>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </>
              ) : (
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor" />
              )}
            </svg>
            <div style={{ fontSize: 14 }}>{toast.message}</div>
          </div>
        )}
      </div>
    </>
  );
}
