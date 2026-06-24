import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, type = 'danger', confirmText, cancelText }) => {
  if (!isOpen) return null;

  const themes = {
    danger: {
      primary: 'var(--danger)',
      bg: 'var(--danger-ultra-light)',
      icon: AlertTriangle
    },
    warning: {
      primary: 'var(--warning)',
      bg: 'var(--warning-ultra-light)',
      icon: AlertCircle
    },
    info: {
      primary: 'var(--primary)',
      bg: 'var(--primary-ultra-light)',
      icon: Info
    },
    success: {
      primary: 'var(--success)',
      bg: 'var(--success-ultra-light)',
      icon: CheckCircle2
    }
  };

  const theme = themes[type] || themes.danger;
  const Icon = theme.icon;
  const defaultConfirmText = type === 'danger' ? 'Supprimer' : 'Confirmer';
  const defaultCancelText = 'Annuler';

  return (
    <AnimatePresence>
      <div className="app-modal-overlay app-confirm-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="app-modal-backdrop"
          style={{ position: 'absolute', inset: 0, background: 'rgba(15, 12, 20, 0.4)', backdropFilter: 'blur(8px)' }}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="glass-premium app-modal-surface app-confirm-modal"
          style={{
            width: '100%',
            maxWidth: '400px',
            borderRadius: 'var(--radius-3xl)',
            padding: '40px 32px',
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            boxShadow: 'var(--shadow-2xl)'
          }}
        >
          <div style={{ 
            width: '72px', height: '72px', borderRadius: 'var(--radius-2xl)', background: theme.bg, color: theme.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
            boxShadow: `0 12px 24px -8px ${theme.primary}44`
          }}>
            <Icon size={32} strokeWidth={2.5} />
          </div>

          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '12px', letterSpacing: '-0.02em' }}>
            {title}
          </h3>
          
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '32px', fontWeight: '500' }}>
            {message}
          </p>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={onCancel}
              className="btn-modern btn-confirm-cancel"
              style={{ flex: 1, justifyContent: 'center', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: 'none' }}
            >
              {cancelText || defaultCancelText}
            </button>
            <button 
              onClick={onConfirm}
              className="btn-modern btn-confirm-submit"
              style={{ 
                flex: 1.5, 
                justifyContent: 'center', 
                background: theme.primary,
                '--confirm-bg': theme.primary,
                color: 'white',
                border: 'none',
                boxShadow: `0 10px 20px -10px ${theme.primary}`
              }}
            >
              {confirmText || defaultConfirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConfirmModal;
