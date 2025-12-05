// 📄 frontend/src/utils/jwt.js
import { jwtDecode } from "jwt-decode";

const TOKEN_KEY = "ev_token";

// =====================================================
// 🔐 SAVE TOKEN
// =====================================================
export const setAuthToken = (token) => {
  if (!token || typeof token !== "string") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (err) {
    console.error("Failed to save auth token:", err);
  }
};

// =====================================================
// 🔐 GET TOKEN
// =====================================================
export const getAuthToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (err) {
    console.error("Failed to read auth token:", err);
    return null;
  }
};

// =====================================================
// 🔐 CLEAR TOKEN
// =====================================================
export const clearAuthToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    console.error("Failed to clear auth token:", err);
  }
};

// =====================================================
// 🧠 DECODE TOKEN SAFELY
// =====================================================
export const decodeToken = () => {
  const token = getAuthToken();
  if (!token) return null;

  try {
    return jwtDecode(token);
  } catch (err) {
    console.warn("Invalid JWT token — clearing.", err);
    clearAuthToken();
    return null;
  }
};

// =====================================================
// ⏳ CHECK IF TOKEN IS EXPIRED
// =====================================================
export const isTokenExpired = () => {
  const decoded = decodeToken();
  if (!decoded || !decoded.exp) return true;

  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
};

// =====================================================
// 👤 GET USER FROM TOKEN (auto-check expiry)
// =====================================================
export const getUserFromToken = () => {
  if (isTokenExpired()) {
    clearAuthToken();
    return null;
  }
  return decodeToken();
};
