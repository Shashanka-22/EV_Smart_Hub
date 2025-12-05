// 📄 src/components/PrivateRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * PrivateRoute component to protect routes
 * Props:
 * - allowedRoles: array of roles that can access this route (optional)
 *    e.g., ["user"], ["station_owner"], ["admin"]
 */
const PrivateRoute = ({ allowedRoles }) => {
  const { token, user } = useAuth();

  // Not logged in
  if (!token) return <Navigate to="/login" />;

  // If allowedRoles is provided, check user role
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect owners to their dashboard
    if (user?.role === 'station_owner') return <Navigate to="/admin/reservations" />;
    // Redirect normal users to main dashboard
    return <Navigate to="/dashboard" />;
  }

  return <Outlet />;
};

export default PrivateRoute;
