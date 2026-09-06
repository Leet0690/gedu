import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import App from './App.jsx'
import './index.css'
import { AppProvider } from './context/AppContext'
import { ToastProvider } from './context/ToastContext'
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext'

const AuthScopedApp = () => {
  const { adminUser } = useAdminAuth();
  const scope = JSON.stringify([adminUser?.uid, adminUser?.role, adminUser?.isActive, adminUser?.permissions]);
  return <AppProvider key={scope}><App /></AppProvider>;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MotionConfig transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}>
      <BrowserRouter>
        <ToastProvider>
          <AdminAuthProvider>
            <AuthScopedApp />
          </AdminAuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </MotionConfig>
  </React.StrictMode>,
)
