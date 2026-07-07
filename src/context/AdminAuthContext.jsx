import React, { createContext, useContext, useState, useEffect } from 'react';

const SESSION_KEY = 'admin_session';
const SESSION_TOKEN_KEY = 'admin_session_token';

const makeSessionToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = new Uint32Array(20);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join('');
};

const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Check if admin is already logged in (on app load)
  useEffect(() => {
    const storedAdmin = localStorage.getItem(SESSION_KEY);
    const storedToken = localStorage.getItem(SESSION_TOKEN_KEY);
    if (storedAdmin && storedToken) {
      try {
        const parsed = JSON.parse(storedAdmin);
        if (!parsed?.sessionToken || parsed.sessionToken !== storedToken) {
          throw new Error('Session administrateur invalide');
        }
        setAdminUser(parsed);
        setIsAdmin(true);
      } catch (error) {
        console.error('Failed to parse admin session:', error);
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_TOKEN_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
      const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;
      const DIRECTOR_PASSWORD = import.meta.env.VITE_DIRECTOR_PASSWORD;
      const cleanPassword = password.trim();

      if (email === ADMIN_EMAIL && (cleanPassword === ADMIN_PASSWORD || cleanPassword === DIRECTOR_PASSWORD)) {
        const sessionToken = makeSessionToken();
        const admin = {
          id: cleanPassword === DIRECTOR_PASSWORD ? 'director_001' : 'admin_001',
          email,
          role: cleanPassword === DIRECTOR_PASSWORD ? 'director' : 'super_admin',
          sessionToken,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        };

        setAdminUser(admin);
        setIsAdmin(true);
        localStorage.setItem(SESSION_KEY, JSON.stringify(admin));
        localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
        localStorage.setItem('admin_lastLogin', new Date().toISOString());

        return { success: true, admin };
      } else {
        return { success: false, error: 'Email or password incorrect' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setIsAdmin(false);
    setAdminUser(null);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem('admin_lastLogin');
  };

  return (
    <AdminAuthContext.Provider value={{ isAdmin, adminUser, login, logout, loading }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
};
