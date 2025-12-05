import React, { useEffect, useState, useRef } from "react";
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  deleteAccount,
} from "../api/api";
import { useAuth } from "../context/AuthContext";

/**
 * ProfileEnhanced Component - Dark glass theme (teal→indigo + emerald accents)
 *
 * Only visual changes applied — logic & API calls unchanged.
 */

const BASE_URL = "http://localhost:5000";

export default function ProfileEnhanced() {
  const { logout } = useAuth();

  // User & Edit State
  const [user, setUser] = useState(null);
  const [edit, setEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Image State
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Password State
  const [passwordExpanded, setPasswordExpanded] = useState(false);
  const [passData, setPassData] = useState({
    old_password: "",
    new_password: "",
  });
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePass, setDeletePass] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(null);
  const deleteTimeoutRef = useRef(null);

  // Toast State
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  // Validation State
  const [usernameError, setUsernameError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // Focus Management
  const deleteModalRef = useRef(null);
  const editButtonRef = useRef(null);

  // Cleanup preview memory
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(URL.createObjectURL(preview));
    };
  }, [preview]);

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        if (deleteModalOpen) {
          setDeleteModalOpen(false);
        } else if (edit) {
          handleCancelEdit();
        } else if (passwordExpanded) {
          setPasswordExpanded(false);
        }
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [deleteModalOpen, edit, passwordExpanded]);

  // Focus trap for delete modal
  useEffect(() => {
    if (deleteModalOpen && deleteModalRef.current) {
      const focusableElements = deleteModalRef.current.querySelectorAll(
        'button, input, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      const handleTab = (e) => {
        if (e.key !== "Tab") return;
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      };

      firstElement?.focus();
      document.addEventListener("keydown", handleTab);
      return () => document.removeEventListener("keydown", handleTab);
    }
  }, [deleteModalOpen]);

  const loadProfile = async () => {
    setLoading(true);
    const res = await getUserProfile();
    if (!res.error) {
      const fixedUrl =
        res.profile_pic_url?.startsWith("http")
          ? res.profile_pic_url
          : res.profile_pic_url
          ? BASE_URL + res.profile_pic_url
          : null;

      setUser({
        ...res,
        profile_pic_url: fixedUrl,
      });
    } else {
      showToast("Failed to load profile: " + res.error, "error");
    }
    setLoading(false);
  };

  /* -------------------- TOAST SYSTEM -------------------- */
  const showToast = (message, type = "info") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  /* -------------------- VALIDATION -------------------- */
  const validateUsername = (value) => {
    if (!value.trim()) {
      setUsernameError("Username is required");
      return false;
    }
    if (value.length < 2) {
      setUsernameError("Username must be at least 2 characters");
      return false;
    }
    setUsernameError("");
    return true;
  };

  const validatePhone = (value) => {
    if (value && !/^\+?[\d\s\-()]+$/.test(value)) {
      setPhoneError("Invalid phone number format");
      return false;
    }
    setPhoneError("");
    return true;
  };

  /* -------------------- UPDATE PROFILE -------------------- */
  const handleCancelEdit = () => {
    setEdit(false);
    setPreview(null);
    setUsernameError("");
    setPhoneError("");
    loadProfile();
    editButtonRef.current?.focus();
  };

  const updateProfile = async () => {
    if (!user) return;

    if (!validateUsername(user.username) || !validatePhone(user.phone_number || "")) {
      return;
    }

    // 🔌 Analytics hook: track profile update start
    setSaving(true);

    const form = new FormData();
    form.append("username", user.username);
    form.append("phone", user.phone_number || "");

    if (preview) {
      // 💡 Client-side compression note: Consider using browser-image-compression library
      form.append("profile_pic", preview);
    }

    const res = await updateUserProfile(form);

    if (!res.error) {
      showToast("Profile updated successfully!", "success");
      setEdit(false);
      setPreview(null);
      loadProfile();
      // 🪝 Webhook trigger: profile updated
      // 🔌 Analytics hook: track profile update success
      editButtonRef.current?.focus();
    } else {
      showToast("Failed to update profile: " + res.error, "error");
      // 🔌 Analytics hook: track profile update error
    }

    setSaving(false);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        showToast("Image must be smaller than 5MB", "warning");
        return;
      }
      // Validate file type
      if (!file.type.startsWith("image/")) {
        showToast("Please select a valid image file", "error");
        return;
      }
      setPreview(file);
    }
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  /* -------------------- PASSWORD STRENGTH -------------------- */
  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 20;
    if (/\d/.test(password)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 15;
    return Math.min(strength, 100);
  };

  const getPasswordStrengthLabel = (strength) => {
    if (strength < 40) return "Weak";
    if (strength < 70) return "Fair";
    if (strength < 90) return "Good";
    return "Strong";
  };

  const getPasswordStrengthColor = (strength) => {
    if (strength < 40) return "var(--color-error)";
    if (strength < 70) return "var(--color-warning)";
    if (strength < 90) return "var(--color-success)";
    return "var(--color-success)";
  };

  /* -------------------- CHANGE PASSWORD -------------------- */
  const handlePasswordChange = async () => {
    if (!passData.old_password || !passData.new_password) {
      showToast("Both password fields are required", "warning");
      return;
    }

    if (passData.new_password.length < 8) {
      showToast("New password must be at least 8 characters", "error");
      return;
    }

    // 🔌 Analytics hook: track password change attempt
    setPassLoading(true);

    const res = await changePassword(passData);
    if (!res.error) {
      showToast("Password updated successfully!", "success");
      setPassData({ old_password: "", new_password: "" });
      setPasswordExpanded(false);
      // 🪝 Webhook trigger: password changed
      // 🔌 Analytics hook: track password change success
    } else {
      showToast("Failed to change password: " + res.error, "error");
      // 🔌 Analytics hook: track password change error
    }

    setPassLoading(false);
  };

  /* -------------------- DELETE ACCOUNT -------------------- */
  const handleDeleteAccount = async () => {
    if (!deletePass) {
      showToast("Enter your password to confirm deletion", "warning");
      return;
    }

    // 🔌 Analytics hook: track account deletion attempt
    setDeleteLoading(true);

    const res = await deleteAccount({ password: deletePass });

    if (!res.error) {
      showToast("Account deletion initiated...", "info");
      // 🪝 Webhook trigger: account deleted
      // 🔌 Analytics hook: track account deletion success

      // Start 5-second countdown before logout
      setDeleteCountdown(5);
      deleteTimeoutRef.current = setInterval(() => {
        setDeleteCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (deleteTimeoutRef.current) clearInterval(deleteTimeoutRef.current);
            logout();
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      setDeleteModalOpen(false);
    } else {
      showToast("Failed to delete account: " + res.error, "error");
      setDeleteLoading(false);
      // 🔌 Analytics hook: track account deletion error
    }
  };

  const cancelDeleteCountdown = () => {
    if (deleteTimeoutRef.current) {
      clearInterval(deleteTimeoutRef.current);
      deleteTimeoutRef.current = null;
    }
    setDeleteCountdown(null);
    showToast("Account deletion cancelled", "info");
    loadProfile();
  };

  /* -------------------- COPY TO CLIPBOARD -------------------- */
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${label} copied to clipboard!`, "success");
      // 🔌 Analytics hook: track clipboard copy
    });
  };

  /* -------------------- RENDER -------------------- */
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} role="status" aria-label="Loading profile"></div>
        <p style={styles.loadingText}>Loading your profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={styles.errorContainer}>
        <p>Failed to load profile. Please try again.</p>
      </div>
    );
  }

  const newPasswordStrength = calculatePasswordStrength(passData.new_password);

  return (
    <>
      {/* Inline CSS with dark glass theme variables */}
      <style>{`
        :root {
          --bg-start: #071024;
          --bg-end: #0f2937;

          --color-primary-start: #06b6d4; /* cyan */
          --color-primary-end: #6366f1;   /* indigo */
          --color-charging: #10b981;      /* emerald */
          --color-warning: #f59e0b;
          --color-danger: #ef4444;

          --text-on-dark: #e6eef6;
          --muted-on-dark: #9fb3c7;

          --card-bg-glass: rgba(255,255,255,0.03);
          --card-border-glass: rgba(255,255,255,0.05);
          --card-surface: rgba(255,255,255,0.02);

          --radius-sm: 8px;
          --radius-md: 12px;
          --radius-lg: 16px;

          --shadow-sm: 0 4px 18px rgba(2,6,23,0.6);
          --shadow-md: 0 12px 40px rgba(2,6,23,0.65);
          --shadow-xl: 0 30px 80px rgba(2,6,23,0.72);
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* Focus visible */
        :focus-visible {
          outline: 3px solid rgba(6,182,212,0.32);
          outline-offset: 2px;
        }
      `}</style>

      {/* Main Container */}
      <div style={styles.pageContainer}>
        {/* Decorative gradients */}
        <div style={styles.bgGradient1}></div>
        <div style={styles.bgGradient2}></div>

        {/* Card (now dark glass) */}
        <div className="profile-card" style={styles.card}>
          {/* Header */}
          <div style={styles.header}>
            <h1 style={styles.title}>
              <span aria-hidden="true">⚡</span> My Profile
            </h1>
            <p style={styles.subtitle}>Manage your EV charging account</p>
          </div>

          {/* Avatar Section */}
          <div style={styles.avatarSection}>
            <div style={styles.avatarWrapper}>
              <img
                src={
                  preview
                    ? URL.createObjectURL(preview)
                    : user.profile_pic_url ||
                      "https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop"
                }
                alt={`${user.username}'s profile`}
                className="profile-avatar"
                style={styles.avatar}
                onError={(e) => {
                  e.target.src =
                    "https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop";
                }}
              />
              {edit && (
                <button
                  onClick={triggerImageUpload}
                  style={styles.avatarEditButton}
                  aria-label="Change profile picture"
                  disabled={saving}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={styles.hiddenInput}
                aria-label="Upload profile picture"
              />
            </div>
            {edit && preview && (
              <p style={styles.imageHint}>
                ℹ️ Preview shown. Click Save to upload. Max 5MB.
              </p>
            )}
          </div>

          {/* Profile Grid */}
          <div className="profile-grid" style={styles.grid}>
            {/* Left Column: Basic Info */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Basic Information</h2>

              {/* Username */}
              <div style={styles.fieldGroup}>
                <label htmlFor="username" style={styles.label}>
                  Username <span style={styles.required}>*</span>
                </label>
                {edit ? (
                  <>
                    <input
                      id="username"
                      type="text"
                      value={user.username}
                      onChange={(e) => {
                        setUser({ ...user, username: e.target.value });
                        validateUsername(e.target.value);
                      }}
                      style={{
                        ...styles.input,
                        ...(usernameError ? styles.inputError : {}),
                      }}
                      disabled={saving}
                      aria-invalid={!!usernameError}
                      aria-describedby={usernameError ? "username-error" : undefined}
                    />
                    {usernameError && (
                      <p id="username-error" style={styles.errorText} role="alert">
                        {usernameError}
                      </p>
                    )}
                  </>
                ) : (
                  <div style={styles.valueRow}>
                    <p style={styles.value}>{user.username}</p>
                    <button
                      onClick={() => copyToClipboard(user.username, "Username")}
                      style={styles.copyButton}
                      aria-label="Copy username"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Email */}
              <div style={styles.fieldGroup}>
                <label htmlFor="email" style={styles.label}>
                  Email
                </label>
                <div style={styles.valueRow}>
                  <p style={styles.value}>{user.email}</p>
                  <button
                    onClick={() => copyToClipboard(user.email, "Email")}
                    style={styles.copyButton}
                    aria-label="Copy email"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
                <p style={styles.helperText}>Email cannot be changed</p>
              </div>

              {/* Phone */}
              <div style={styles.fieldGroup}>
                <label htmlFor="phone" style={styles.label}>
                  Phone Number
                </label>
                {edit ? (
                  <>
                    <input
                      id="phone"
                      type="tel"
                      value={user.phone_number || ""}
                      onChange={(e) => {
                        setUser({ ...user, phone_number: e.target.value });
                        validatePhone(e.target.value);
                      }}
                      placeholder="+1 (555) 123-4567"
                      style={{
                        ...styles.input,
                        ...(phoneError ? styles.inputError : {}),
                      }}
                      disabled={saving}
                      aria-invalid={!!phoneError}
                      aria-describedby={phoneError ? "phone-error" : undefined}
                    />
                    {phoneError && (
                      <p id="phone-error" style={styles.errorText} role="alert">
                        {phoneError}
                      </p>
                    )}
                  </>
                ) : (
                  <p style={styles.value}>{user.phone_number || "Not provided"}</p>
                )}
              </div>

              {/* Role */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Account Role</label>
                <div style={styles.roleBadge}>{user.role}</div>
              </div>

              {/* Action Buttons */}
              <div className="button-group" style={styles.buttonGroup}>
                {!edit ? (
                  <button
                    ref={editButtonRef}
                    onClick={() => setEdit(true)}
                    style={styles.primaryButton}
                    aria-label="Edit profile"
                  >
                    <span aria-hidden="true">✏️</span> Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      onClick={updateProfile}
                      style={{
                        ...styles.primaryButton,
                        ...(saving ? styles.buttonDisabled : {}),
                      }}
                      disabled={saving || !!usernameError || !!phoneError}
                      aria-label="Save profile changes"
                    >
                      {saving ? (
                        <>
                          <span style={styles.spinnerSmall}></span> Saving...
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true">✓</span> Save Changes
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      style={styles.secondaryButton}
                      disabled={saving}
                      aria-label="Cancel editing"
                    >
                      <span aria-hidden="true">✕</span> Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Right Column: Security & Danger Zone */}
            <div style={styles.section}>
              {/* Password Section */}
              <div style={styles.securitySection}>
                <button
                  onClick={() => setPasswordExpanded(!passwordExpanded)}
                  style={styles.accordionHeader}
                  aria-expanded={passwordExpanded}
                  aria-controls="password-section"
                >
                  <div style={styles.accordionTitle}>
                    <span aria-hidden="true">🔒</span>
                    <span>Change Password</span>
                  </div>
                  <span
                    style={{
                      ...styles.accordionIcon,
                      transform: passwordExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                    aria-hidden="true"
                  >
                    ▼
                  </span>
                </button>

                {passwordExpanded && (
                  <div id="password-section" style={styles.accordionContent}>
                    {/* Old Password */}
                    <div style={styles.fieldGroup}>
                      <label htmlFor="old-password" style={styles.label}>
                        Current Password <span style={styles.required}>*</span>
                      </label>
                      <div style={styles.passwordInputWrapper}>
                        <input
                          id="old-password"
                          type={showOldPass ? "text" : "password"}
                          value={passData.old_password}
                          onChange={(e) =>
                            setPassData({ ...passData, old_password: e.target.value })
                          }
                          style={styles.input}
                          disabled={passLoading}
                          aria-label="Current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOldPass(!showOldPass)}
                          style={styles.passwordToggle}
                          aria-label={showOldPass ? "Hide password" : "Show password"}
                        >
                          {showOldPass ? "👁️" : "👁️‍🗨️"}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div style={styles.fieldGroup}>
                      <label htmlFor="new-password" style={styles.label}>
                        New Password <span style={styles.required}>*</span>
                      </label>
                      <div style={styles.passwordInputWrapper}>
                        <input
                          id="new-password"
                          type={showNewPass ? "text" : "password"}
                          value={passData.new_password}
                          onChange={(e) =>
                            setPassData({ ...passData, new_password: e.target.value })
                          }
                          style={styles.input}
                          disabled={passLoading}
                          aria-label="New password"
                          aria-describedby="password-strength"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass(!showNewPass)}
                          style={styles.passwordToggle}
                          aria-label={showNewPass ? "Hide password" : "Show password"}
                        >
                          {showNewPass ? "👁️" : "👁️‍🗨️"}
                        </button>
                      </div>

                      {/* Password Strength Meter */}
                      {passData.new_password && (
                        <div id="password-strength" style={styles.strengthMeter}>
                          <div style={styles.strengthBar}>
                            <div
                              style={{
                                ...styles.strengthFill,
                                width: `${newPasswordStrength}%`,
                                backgroundColor: getPasswordStrengthColor(newPasswordStrength),
                              }}
                              role="progressbar"
                              aria-valuenow={newPasswordStrength}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`Password strength: ${getPasswordStrengthLabel(newPasswordStrength)}`}
                            ></div>
                          </div>
                          <p
                            style={{
                              ...styles.strengthLabel,
                              color: getPasswordStrengthColor(newPasswordStrength),
                            }}
                          >
                            {getPasswordStrengthLabel(newPasswordStrength)}
                          </p>
                        </div>
                      )}
                      <p style={styles.helperText}>
                        At least 8 characters with uppercase, lowercase, number & symbol
                      </p>
                    </div>

                    <button
                      onClick={handlePasswordChange}
                      style={{
                        ...styles.successButton,
                        ...(passLoading ? styles.buttonDisabled : {}),
                      }}
                      disabled={passLoading}
                      aria-label="Update password"
                    >
                      {passLoading ? (
                        <>
                          <span style={styles.spinnerSmall}></span> Updating...
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true">🛡️</span> Update Password
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Last Updated */}
              {user.updated_at && (
                <div style={styles.auditSection}>
                  <p style={styles.auditLabel}>Last Updated</p>
                  <p style={styles.auditValue}>{new Date(user.updated_at).toLocaleString()}</p>
                </div>
              )}

              {/* Danger Zone */}
              <div style={styles.dangerZone}>
                <h3 style={styles.dangerTitle}>
                  <span aria-hidden="true">⚠️</span> Danger Zone
                </h3>
                <p style={styles.dangerText}>
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <button
                  onClick={() => setDeleteModalOpen(true)}
                  style={styles.dangerButton}
                  aria-label="Delete account"
                >
                  <span aria-hidden="true">🗑️</span> Delete My Account
                </button>
              </div>
            </div>
          </div>

          {/* Delete Countdown Banner */}
          {deleteCountdown !== null && (
            <div style={styles.countdownBanner} role="alert" aria-live="assertive">
              <p style={styles.countdownText}>
                ⏱️ Account will be deleted in <strong>{deleteCountdown}</strong> seconds...
              </p>
              <button onClick={cancelDeleteCountdown} style={styles.undoButton} aria-label="Cancel account deletion">
                <span aria-hidden="true">↺</span> Undo
              </button>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && (
          <div
            style={styles.modalOverlay}
            onClick={() => setDeleteModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <div ref={deleteModalRef} style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h2 id="delete-modal-title" style={styles.modalTitle}>
                  Confirm Account Deletion
                </h2>
                <button onClick={() => setDeleteModalOpen(false)} style={styles.modalClose} aria-label="Close dialog">
                  ✕
                </button>
              </div>

              <div style={styles.modalBody}>
                <div style={styles.warningIcon}>⚠️</div>
                <p style={styles.modalText}>
                  This action <strong>cannot be undone</strong>. This will permanently delete your account, all your data, charging history, and reservations.
                </p>

                <div style={styles.fieldGroup}>
                  <label htmlFor="delete-password" style={styles.label}>
                    Enter your password to confirm <span style={styles.required}>*</span>
                  </label>
                  <input
                    id="delete-password"
                    type="password"
                    value={deletePass}
                    onChange={(e) => setDeletePass(e.target.value)}
                    placeholder="Your password"
                    style={styles.input}
                    disabled={deleteLoading}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && deletePass) {
                        handleDeleteAccount();
                      }
                    }}
                    autoFocus
                  />
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button onClick={() => setDeleteModalOpen(false)} style={styles.secondaryButton} disabled={deleteLoading}>
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  style={{
                    ...styles.dangerButton,
                    ...(deleteLoading ? styles.buttonDisabled : {}),
                  }}
                  disabled={deleteLoading || !deletePass}
                >
                  {deleteLoading ? (
                    <>
                      <span style={styles.spinnerSmall}></span> Deleting...
                    </>
                  ) : (
                    <>Delete Forever</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Container */}
        <div style={styles.toastContainer} role="region" aria-live="polite" aria-label="Notifications">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              style={{
                ...styles.toast,
                ...(toast.type === "success" ? styles.toastSuccess : {}),
                ...(toast.type === "error" ? styles.toastError : {}),
                ...(toast.type === "warning" ? styles.toastWarning : {}),
                ...(toast.type === "info" ? styles.toastInfo : {}),
              }}
              role="alert"
            >
              <span style={styles.toastMessage}>{toast.message}</span>
              <button onClick={() => dismissToast(toast.id)} style={styles.toastClose} aria-label="Dismiss notification">
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ==================== INLINE STYLES (DARK GLASS THEME) ==================== */

const styles = {
  // Layout
  pageContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #071024 0%, #0f2937 100%)",
    padding: "40px",
    position: "relative",
    overflow: "hidden",
    color: "var(--text-on-dark, #e6eef6)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },

  bgGradient1: {
    position: "absolute",
    top: "-20%",
    right: "-10%",
    width: "600px",
    height: "600px",
    background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)",
    borderRadius: "50%",
    pointerEvents: "none",
    animation: "pulse 8s ease-in-out infinite",
  },

  bgGradient2: {
    position: "absolute",
    bottom: "-20%",
    left: "-10%",
    width: "500px",
    height: "500px",
    background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
    borderRadius: "50%",
    pointerEvents: "none",
    animation: "pulse 10s ease-in-out infinite",
  },

  // Card: dark glass
  card: {
    position: "relative",
    maxWidth: "1100px",
    margin: "0 auto",
    background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02))",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    borderRadius: "16px",
    padding: "40px",
    boxShadow: "0 30px 80px rgba(2,6,23,0.72)",
    border: "1px solid rgba(255,255,255,0.05)",
    animation: "slideUp 0.45s ease-out",
  },

  header: {
    textAlign: "center",
    marginBottom: "32px",
  },

  title: {
    fontSize: "2.25rem",
    fontWeight: 700,
    background: "linear-gradient(135deg,#10b981 0%, #06b6d4 40%, #6366f1 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
  },

  subtitle: {
    fontSize: "1rem",
    color: "var(--muted-on-dark, #9fb3c7)",
    marginTop: "8px",
  },

  // Avatar
  avatarSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: "28px",
  },

  avatarWrapper: {
    position: "relative",
    marginBottom: "12px",
  },

  avatar: {
    width: "160px",
    height: "160px",
    borderRadius: "9999px",
    objectFit: "cover",
    border: "3px solid rgba(255,255,255,0.06)",
    boxShadow: "0 10px 30px rgba(2,6,23,0.6)",
    transition: "transform 150ms ease",
  },

  avatarEditButton: {
    position: "absolute",
    bottom: "6px",
    right: "6px",
    width: "44px",
    height: "44px",
    borderRadius: "9999px",
    background: "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
    color: "#021018",
    border: "3px solid rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 8px 26px rgba(6,182,212,0.06)",
  },

  imageHint: {
    fontSize: "0.875rem",
    color: "var(--muted-on-dark, #9fb3c7)",
    textAlign: "center",
  },

  hiddenInput: {
    display: "none",
  },

  // Grid
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "28px",
    marginBottom: "20px",
  },

  section: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },

  sectionTitle: {
    fontSize: "1.125rem",
    fontWeight: 700,
    color: "var(--text-on-dark)",
    marginBottom: "8px",
  },

  // Form fields
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  label: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "var(--muted-on-dark)",
    marginBottom: "4px",
  },

  required: {
    color: "var(--color-danger, #ef4444)",
  },

  input: {
    width: "100%",
    minHeight: "44px",
    padding: "12px 14px",
    fontSize: "1rem",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "10px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
    color: "var(--text-on-dark)",
    transition: "all 150ms ease",
    boxSizing: "border-box",
  },

  inputError: {
    borderColor: "var(--color-danger, #ef4444)",
    boxShadow: "0 0 0 3px rgba(239,68,68,0.06)",
  },

  errorText: {
    fontSize: "0.875rem",
    color: "var(--color-danger, #ef4444)",
    margin: 0,
  },

  helperText: {
    fontSize: "0.75rem",
    color: "var(--muted-on-dark)",
    margin: 0,
  },

  value: {
    fontSize: "1rem",
    color: "var(--text-on-dark)",
    margin: 0,
    wordBreak: "break-word",
  },

  valueRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  copyButton: {
    minWidth: "40px",
    minHeight: "40px",
    padding: "8px",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.04)",
    borderRadius: "8px",
    cursor: "pointer",
    color: "var(--muted-on-dark)",
    transition: "all 120ms ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  roleBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 14px",
    background: "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
    color: "#021018",
    borderRadius: "9999px",
    fontSize: "0.875rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  // Buttons
  buttonGroup: {
    display: "flex",
    gap: "12px",
    marginTop: "12px",
  },

  primaryButton: {
    minHeight: "44px",
    padding: "12px 24px",
    fontSize: "1rem",
    fontWeight: 700,
    color: "#021018",
    background: "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 150ms ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxShadow: "0 10px 30px rgba(6,182,212,0.06)",
  },

  secondaryButton: {
    minHeight: "44px",
    padding: "12px 24px",
    fontSize: "1rem",
    fontWeight: 700,
    color: "var(--text-on-dark)",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.04)",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 150ms ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },

  successButton: {
    minHeight: "44px",
    padding: "12px 24px",
    fontSize: "1rem",
    fontWeight: 700,
    color: "#021018",
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 150ms ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    boxShadow: "0 10px 30px rgba(16,185,129,0.06)",
  },

  dangerButton: {
    minHeight: "44px",
    padding: "12px 24px",
    fontSize: "1rem",
    fontWeight: 700,
    color: "white",
    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 150ms ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },

  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  // Password section
  securitySection: {
    border: "1px solid rgba(255,255,255,0.04)",
    borderRadius: "10px",
    overflow: "hidden",
    background: "linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.01))",
  },

  accordionHeader: {
    width: "100%",
    minHeight: "56px",
    padding: "12px 16px",
    background: "transparent",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    fontSize: "1rem",
    color: "var(--text-on-dark)",
  },

  accordionTitle: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontWeight: 700,
    color: "var(--text-on-dark)",
  },

  accordionIcon: {
    transition: "transform 220ms ease",
    fontSize: "0.875rem",
    color: "var(--muted-on-dark)",
  },

  accordionContent: {
    padding: "18px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    animation: "fadeIn 0.25s ease-out",
  },

  passwordInputWrapper: {
    position: "relative",
  },

  passwordToggle: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    minWidth: "40px",
    minHeight: "40px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    color: "var(--muted-on-dark)",
  },

  strengthMeter: {
    marginTop: "8px",
  },

  strengthBar: {
    width: "100%",
    height: "8px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: "9999px",
    overflow: "hidden",
  },

  strengthFill: {
    height: "100%",
    transition: "all 250ms ease",
    borderRadius: "9999px",
  },

  strengthLabel: {
    fontSize: "0.75rem",
    fontWeight: 700,
    marginTop: "6px",
    textAlign: "right",
  },

  // Audit
  auditSection: {
    padding: "12px",
    background: "linear-gradient(180deg, rgba(6,182,212,0.03), rgba(99,102,241,0.02))",
    borderRadius: "8px",
    border: "1px solid rgba(6,182,212,0.06)",
  },

  auditLabel: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "var(--muted-on-dark)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    margin: 0,
  },

  auditValue: {
    fontSize: "0.875rem",
    color: "var(--text-on-dark)",
    margin: 0,
  },

  // Danger zone
  dangerZone: {
    padding: "18px",
    background: "linear-gradient(180deg, rgba(239,68,68,0.04), rgba(239,68,68,0.02))",
    border: "1px solid rgba(239,68,68,0.08)",
    borderRadius: "10px",
  },

  dangerTitle: {
    fontSize: "1rem",
    fontWeight: 700,
    color: "var(--color-danger, #ef4444)",
    marginBottom: "8px",
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },

  dangerText: {
    fontSize: "0.875rem",
    color: "var(--muted-on-dark)",
    marginBottom: "12px",
  },

  // Countdown banner
  countdownBanner: {
    position: "fixed",
    bottom: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "linear-gradient(135deg, #ef4444, #dc2626)",
    color: "white",
    padding: "12px 18px",
    borderRadius: "10px",
    boxShadow: "0 20px 60px rgba(2,6,23,0.6)",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    zIndex: 1200,
  },

  countdownText: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 700,
  },

  undoButton: {
    minHeight: "36px",
    padding: "8px 14px",
    background: "white",
    color: "#ef4444",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.875rem",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },

  // Modal
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(2,6,23,0.75)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    padding: "20px",
  },

  modal: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02))",
    borderRadius: "12px",
    maxWidth: "520px",
    width: "100%",
    boxShadow: "0 30px 80px rgba(2,6,23,0.72)",
  },

  modalHeader: {
    padding: "18px",
    borderBottom: "1px solid rgba(255,255,255,0.03)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  modalTitle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "var(--text-on-dark)",
    margin: 0,
  },

  modalClose: {
    minWidth: "36px",
    minHeight: "36px",
    background: "transparent",
    border: "none",
    fontSize: "1.25rem",
    cursor: "pointer",
    color: "var(--muted-on-dark)",
  },

  modalBody: {
    padding: "18px",
  },

  warningIcon: {
    fontSize: "3rem",
    textAlign: "center",
    marginBottom: "12px",
  },

  modalText: {
    fontSize: "1rem",
    color: "var(--text-on-dark)",
    lineHeight: 1.6,
    marginBottom: "12px",
  },

  modalFooter: {
    padding: "12px 18px 18px 18px",
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end",
  },

  // Toasts
  toastContainer: {
    position: "fixed",
    top: "20px",
    right: "20px",
    zIndex: 3000,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxWidth: "420px",
  },

  toast: {
    padding: "12px 16px",
    borderRadius: "10px",
    boxShadow: "0 18px 48px rgba(2,6,23,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    minWidth: "300px",
    color: "white",
    background: "linear-gradient(135deg, rgba(6,182,212,0.12), rgba(99,102,241,0.06))",
  },

  toastMessage: {
    fontSize: "0.9rem",
    flex: 1,
    fontWeight: 600,
  },

  toastClose: {
    minWidth: "28px",
    minHeight: "28px",
    background: "transparent",
    border: "none",
    fontSize: "1rem",
    cursor: "pointer",
    borderRadius: "8px",
    color: "white",
  },

  toastSuccess: {
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "white",
  },

  toastError: {
    background: "linear-gradient(135deg, #ef4444, #dc2626)",
    color: "white",
  },

  toastWarning: {
    background: "linear-gradient(135deg, #f59e0b, #d97706)",
    color: "white",
  },

  toastInfo: {
    background: "linear-gradient(135deg, #06b6d4, #6366f1)",
    color: "white",
  },

  // Loading
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #071024 0%, #0f2937 100%)",
    gap: "24px",
    color: "var(--text-on-dark)",
  },

  spinner: {
    width: "48px",
    height: "48px",
    border: "4px solid rgba(6,182,212,0.16)",
    borderTopColor: "#06b6d4",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },

  spinnerSmall: {
    display: "inline-block",
    width: "16px",
    height: "16px",
    border: "2px solid rgba(255,255,255,0.18)",
    borderTopColor: "white",
    borderRadius: "50%",
    animation: "spin 0.6s linear infinite",
  },

  loadingText: {
    color: "var(--text-on-dark)",
    fontSize: "1.125rem",
  },

  errorContainer: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #071024 0%, #0f2937 100%)",
    color: "var(--text-on-dark)",
    fontSize: "1.125rem",
    padding: "24px",
    textAlign: "center",
  },
};
