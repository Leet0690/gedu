import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { educationText } from '../utils/education';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const recentToastRef = useRef({ key: '', timestamp: 0 });

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const now = Date.now();
    const key = `${type}:${message}`;

    if (recentToastRef.current.key === key && now - recentToastRef.current.timestamp < 800) {
      return;
    }

    recentToastRef.current = { key, timestamp: now };

    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message: educationText(message), type, duration }]);

    if (duration !== Infinity) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastItem = ({ toast, onClose }) => {
  const icons = {
    success: <CheckCircle size={18} className="toast-icon success" />,
    error: <AlertCircle size={18} className="toast-icon error" />,
    warning: <AlertTriangle size={18} className="toast-icon warning" />,
    info: <Info size={18} className="toast-icon info" />,
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.12 } }}
      className={`toast-item ${toast.type}`}
    >
      <div className="toast-content">
        {icons[toast.type] || icons.info}
        <span className="toast-message">{toast.message}</span>
      </div>
      <button onClick={onClose} className="toast-close" aria-label="Fermer la notification" title="Fermer">
        <X size={14} />
      </button>
    </motion.div>
  );
};
