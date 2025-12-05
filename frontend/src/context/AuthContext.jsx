// 📄 src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { decodeToken, getAuthToken, setAuthToken, clearAuthToken } from '../utils/jwt';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(getAuthToken());
  const [user, setUser] = useState(() => {
    const t = getAuthToken();
    return t ? decodeToken(t) : null;
  });

  // Login function
  const login = (jwtToken) => {
    setAuthToken(jwtToken);
    setToken(jwtToken);
    const decoded = decodeToken(jwtToken);
    setUser(decoded);
  };

  // Logout function
  const logout = () => {
    clearAuthToken();
    setToken(null);
    setUser(null);
  };

  // Keep user state synced with token
  useEffect(() => {
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) {
        setUser(decoded);
      } else {
        logout(); // Invalid token, clear state
      }
    } else {
      setUser(null);
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook for easy access
export const useAuth = () => useContext(AuthContext);
