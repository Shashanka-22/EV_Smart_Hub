import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./auth/Login";
import Register from "./auth/Register";
import Profile from "./pages/Profile";

import Dashboard from "./pages/Dashboard";
import StationList from "./pages/StationList";
import TripPlanner from "./pages/TripPlanner";
import ReservationForm from "./pages/ReservationForm";
import MyReservations from "./pages/MyReservations";
import Preferences from "./pages/Preferences";
import SmartCharging from "./pages/SmartCharging";
import MapView from "./pages/MapView";

import AdminPanel from "./pages/AdminPanel";
import OwnerReservations from "./pages/OwnerReservations";
import OwnerVerify from "./pages/OwnerVerify";
import OwnerDashboard from "./pages/OwnerDashboard";
import AddReview from "./pages/AddReview";

// SUPER ADMIN PAGES
import AdminDashboard from "./admin/AdminDashboard";
import AdminUsersPage from "./admin/pages/AdminUsersPage";
import AdminOwnersPage from "./admin/pages/AdminOwnersPage";
import AdminStationsPage from "./admin/pages/AdminStationsPage";
import AdminReservationsPage from "./admin/pages/AdminReservationsPage";
import AdminRevenuePage from "./admin/pages/AdminRevenuePage";

// Other admin pages
import AdminRefunds from "./admin/AdminRefunds";
import AdminPerformance from "./admin/AdminPerformance";
import AdminStationApprovals from "./admin/AdminStationApprovals";

import Navbar from "./components/Navbar";
import ChatWidget from "./components/ChatWidget";
import PrivateRoute from "./components/PrivateRoute";

import { useAuth } from "./context/AuthContext";

import "leaflet/dist/leaflet.css";
import "react-toastify/dist/ReactToastify.css";

const App = () => {
  const { token } = useAuth();

  return (
    <>
      <Navbar />
      <ChatWidget />

      <Routes>
        {/* ---------------- PUBLIC ROUTES ---------------- */}
        <Route
          path="/"
          element={token ? <Navigate to="/dashboard" /> : <Login />}
        />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />

        {/* ---------------- USER ROUTES ---------------- */}
        <Route element={<PrivateRoute allowedRoles={["user"]} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/smart-charging" element={<SmartCharging />} />
          <Route path="/stations" element={<StationList />} />
          <Route path="/trip-planner" element={<TripPlanner />} />
          <Route path="/reserve/:stationId" element={<ReservationForm />} />
          <Route path="/preferences" element={<Preferences />} />
          <Route path="/my-reservations" element={<MyReservations />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/stations/:stationId/review" element={<AddReview />} />

        </Route>

        {/* ---------------- OWNER ROUTES ---------------- */}
        <Route element={<PrivateRoute allowedRoles={["station_owner"]} />}>
          <Route path="/admin" element={<OwnerDashboard />} />
          <Route path="/admin/reservations" element={<OwnerReservations />} />
          <Route path="/admin/charging" element={<OwnerVerify />} />
          <Route path="/admin/panel" element={<AdminPanel />} />
        </Route>

        {/* ---------------- SUPER ADMIN ROUTES ---------------- */}
        <Route
          path="/super-admin"
          element={<PrivateRoute allowedRoles={["super_admin"]} />}
        >
          {/* Dashboard */}
          <Route path="dashboard" element={<AdminDashboard />} />

          {/* Full Admin Pages */}
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="owners" element={<AdminOwnersPage />} />
          <Route path="station" element={<AdminStationsPage />} />
          <Route path="stations" element={<AdminStationApprovals />} />
          <Route path="reservations" element={<AdminReservationsPage />} />
          <Route path="revenue" element={<AdminRevenuePage />} />

          {/* Additional */}
          <Route path="refunds" element={<AdminRefunds />} />
          <Route path="performance" element={<AdminPerformance />} />
        </Route>

        {/* ---------------- FALLBACK ---------------- */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
};

export default App;
