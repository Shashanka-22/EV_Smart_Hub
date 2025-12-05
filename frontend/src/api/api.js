// 📄 frontend/src/api/api.js
import axios from "axios";
import { getAuthToken } from "../utils/jwt";

// =====================================================
// 🔗 BASE URL
// =====================================================
const BASE_URL = "http://localhost:5000/api";
const API_TIMEOUT = 15000;

// =====================================================
// 🔐 AUTH HEADERS
// =====================================================
const authHeaders = () => {
  const token = getAuthToken();
  return {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    timeout: API_TIMEOUT,
  };
};

// =====================================================
// 🛡 SAFE API WRAPPER
// =====================================================
const safeApiCall = async (fn) => {
  try {
    const res = await fn();
    return res.data;
  } catch (err) {
    const res = err.response;
    console.error("API Error:", res?.data || err.message);

    if (res?.status === 401)
      return { error: "Authentication failed. Please login again.", status: 401 };

    if (res?.status === 429)
      return {
        error: res.data?.error || "Too many requests. Please wait.",
        retry_after: res.data?.retry_after || 60,
        status: 429,
      };

    return {
      error: res?.data?.error || "Server error. Try again later.",
      status: res?.status || 500,
    };
  }
};

// =====================================================
// 🔐 AUTH
// =====================================================
export const requestOtp = (data) =>
  safeApiCall(() =>
    axios.post(`${BASE_URL}/auth/register/request-otp`, data, {
      headers: { "Content-Type": "application/json" },
      timeout: API_TIMEOUT,
    })
  );

export const verifyAndRegister = (data) =>
  safeApiCall(() =>
    axios.post(`${BASE_URL}/auth/register/verify`, data, {
      headers: { "Content-Type": "application/json" },
      timeout: API_TIMEOUT,
    })
  );

export const loginUser = (data) =>
  safeApiCall(() =>
    axios.post(`${BASE_URL}/auth/login`, data, {
      headers: { "Content-Type": "application/json" },
      timeout: API_TIMEOUT,
    })
  );

// =====================================================
// ⚡ STATIONS (USER + OWNER)
// =====================================================
export const getStations = () =>
  safeApiCall(() => axios.get(`${BASE_URL}/stations`, authHeaders()));

export const getStationById = (id) =>
  safeApiCall(() => axios.get(`${BASE_URL}/stations/${id}`, authHeaders()));

export const getNearestStations = ({ lat, lng }) =>
  safeApiCall(() =>
    axios.get(
      `${BASE_URL}/stations/nearest?lat=${lat}&lng=${lng}`,
      authHeaders()
    )
  );

export const getMyStations = () =>
  safeApiCall(() => axios.get(`${BASE_URL}/stations/mine`, authHeaders()));

export const createStation = (data) =>
  safeApiCall(() =>
    axios.post(`${BASE_URL}/stations/create`, data, authHeaders())
  );

export const updateStation = (id, data) =>
  safeApiCall(() =>
    axios.put(`${BASE_URL}/stations/${id}`, data, authHeaders())
  );

export const deleteStation = (id) =>
  safeApiCall(() =>
    axios.delete(`${BASE_URL}/stations/${id}`, authHeaders())
  );

export const getRecommendedStations = ({ preferences, location }) =>
  safeApiCall(() =>
    axios.post(
      `${BASE_URL}/stations/score-stations`,
      { preferences, lat: location.lat, lng: location.lng },
      authHeaders()
    )
  );

// =====================================================
// 💳 PAYMENTS
// =====================================================
export const createPaymentOrder = (data) =>
  safeApiCall(() => {
    if (data.amount) data.amount = Number(data.amount);
    return axios.post(
      `${BASE_URL}/reservations/payment/order`,
      data,
      authHeaders()
    );
  });

export const verifyPayment = (data) =>
  safeApiCall(() =>
    axios.post(`${BASE_URL}/reservations/payment/verify`, data, authHeaders())
  );

// =====================================================
// 🔌 RESERVATIONS — USER
// =====================================================
export const createReservation = (data) =>
  safeApiCall(() =>
    axios.post(`${BASE_URL}/reservations/create`, data, authHeaders())
  );

export const getMyReservations = () =>
  safeApiCall(() =>
    axios.get(`${BASE_URL}/reservations/my`, authHeaders())
  );

export const cancelReservation = (id) =>
  safeApiCall(() =>
    axios.delete(`${BASE_URL}/reservations/cancel/${id}`, authHeaders())
  );

export const getAllReservations = () =>
  safeApiCall(() =>
    axios.get(`${BASE_URL}/reservations/all`, authHeaders())
  );

// =====================================================
// 🧑‍🔧 RESERVATIONS — OWNER
// =====================================================
export const getOwnerReservations = () =>
  safeApiCall(() =>
    axios.get(`${BASE_URL}/reservations/owner/reservations`, authHeaders())
  );

export const ownerCancelReservation = (id) =>
  safeApiCall(() =>
    axios.delete(`${BASE_URL}/owner/cancel/${id}`, authHeaders())
  );

export const verifyOwnerOtp = (data) =>
  safeApiCall(() =>
    axios.post(`${BASE_URL}/owner/verify-otp`, data, authHeaders())
  );

export const startCharging = (data) =>
  safeApiCall(() =>
    axios.post(`${BASE_URL}/owner/start-charging`, data, authHeaders())
  );

export const stopCharging = (data) =>
  safeApiCall(() =>
    axios.post(`${BASE_URL}/owner/stop-charging`, data, authHeaders())
  );

// =====================================================
// 🔋 BATTERY TELEMETRY
// =====================================================
export const sendBatteryTelemetry = (data) =>
  safeApiCall(() =>
    axios.post(`${BASE_URL}/battery/upload`, data, authHeaders())
  );

// =====================================================
// 🧠 AI PREDICTOR
// =====================================================
export const predictAvailability = (data) =>
  safeApiCall(() => axios.post(`${BASE_URL}/predict`, data, authHeaders()));

// =====================================================
// 🛡 SUPER ADMIN APIs (FULL & MATCHED TO BACKEND)
// =====================================================

const adminApi = axios.create({
  baseURL: `${BASE_URL}/admin`,
  timeout: API_TIMEOUT,
});

adminApi.interceptors.request.use((config) => {
  const token = getAuthToken();
  config.headers.Authorization = token ? `Bearer ${token}` : "";
  return config;
});

// ---- Stations Pending Approval ----
export const getPendingStations = () =>
  safeApiCall(() => adminApi.get("/stations/pending"));

export const approveStation = (station_id) =>
  safeApiCall(() => adminApi.post(`/stations/approve/${station_id}`));

export const rejectStation = (station_id, reason) =>
  safeApiCall(() =>
    adminApi.post(`/stations/reject/${station_id}`, { reason })
  );

// ---- Dashboard Overview ----
export const getAdminAnalytics = () =>
  safeApiCall(() => adminApi.get("/analytics/overview"));

// ---- Station Performance ----
export const getStationPerformance = () =>
  safeApiCall(() => adminApi.get("/analytics/station-performance"));

// ---- Users ----
export const getAllUsers = () =>
  safeApiCall(() => adminApi.get("/users/all"));

export const deleteUserAdmin = (user_id) =>
  safeApiCall(() => adminApi.delete(`/users/delete/${user_id}`));

// ---- Owners ----
export const getAllOwners = () =>
  safeApiCall(() => adminApi.get("/owners/all"));

export const deleteOwnerAdmin = (owner_id) =>
  safeApiCall(() => adminApi.delete(`/owners/delete/${owner_id}`));

// ---- Stations ----
export const getAllStationsAdmin = () =>
  safeApiCall(() => adminApi.get("/stations/all"));

export const deleteStationAdmin = (station_id) =>
  safeApiCall(() => adminApi.delete(`/stations/delete/${station_id}`));

// ---- Revenue Per Station ----
export const getRevenuePerStation = () =>
  safeApiCall(() => adminApi.get("/analytics/revenue-stations"));

// ---- Reservations ----
export const getAllReservationsGrouped = () =>
  safeApiCall(() => adminApi.get("/reservations/all-grouped"));

// ---- Flagged Users ----
export const getFlaggedUsers = () =>
  safeApiCall(() => adminApi.get("/users/flags"));

// ---- Refund Logs ----
export const getRefundLogs = () =>
  safeApiCall(() => adminApi.get("/refunds/logs"));

// =====================================================
// 📊 OWNER ANALYTICS (FINAL)
// =====================================================

// Overview
export const getOwnerOverview = () =>
  safeApiCall(() =>
    axios.get(`${BASE_URL}/owner/analytics/overview`, authHeaders())
  );

// Revenue
export const getOwnerRevenue = (range = "today") =>
  safeApiCall(() =>
    axios.get(
      `${BASE_URL}/owner/analytics/revenue?range=${range}`,
      authHeaders()
    )
  );

// Reviews
export const getOwnerReviews = () =>
  safeApiCall(() =>
    axios.get(`${BASE_URL}/owner/analytics/reviews`, authHeaders())
  );

// Station Comparison
export const getOwnerStationComparison = () =>
  safeApiCall(() =>
    axios.get(`${BASE_URL}/owner/analytics/compare-stations`, authHeaders())
  );


// Get user profile
export const getUserProfile = () =>
  safeApiCall(() =>
    axios.get(`${BASE_URL}/user/profile`, authHeaders())
  );

// Update user profile (multipart form)
export const updateUserProfile = (formData) =>
  safeApiCall(() => {
    return axios.put(`${BASE_URL}/user/profile/update`, formData, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
        // ❌ DO NOT set Content-Type manually.
        // Browser will set multipart/form-data with boundary automatically.
      },
      timeout: API_TIMEOUT,
    });
  });


export const changePassword = (data) =>
  safeApiCall(() =>
    axios.put(`${BASE_URL}/user/change-password`, data, authHeaders())
  );

export const deleteAccount = (data) =>
  safeApiCall(() =>
    axios.delete(`${BASE_URL}/user/delete-account`, {
      ...authHeaders(),
      data,
    })
  );


  // =============================
// ⭐ STATION REVIEWS
// =============================
export const getStationReviews = (stationId) =>
  safeApiCall(() =>
    axios.get(`${BASE_URL}/stations/${stationId}/reviews`, authHeaders())
  );

export const createStationReview = (stationId, formData) =>
  safeApiCall(() =>
    axios.post(
      `${BASE_URL}/stations/${stationId}/reviews`,
      formData,
      {
        headers: {
          Authorization: getAuthToken() ? `Bearer ${getAuthToken()}` : "",
          "Content-Type": "multipart/form-data",
        },
        timeout: API_TIMEOUT,
      }
    )
  );

// =============================
// ⭐ EMERGENCY SUPPORT
// =============================
export const sendEmergencyAlert = (payload) =>
  safeApiCall(() =>
    axios.post(`${BASE_URL}/support/emergency`, payload, authHeaders())
  );
