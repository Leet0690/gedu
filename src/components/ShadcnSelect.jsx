import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

const ShadcnSelect = ({ 
  value, 
  onChange, 
  options, // Array of strings/numbers or objects { label, value }
  placeholder = "Sélectionner",
  className = "",
  style = {},
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  // Handle click outside to close
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Scroll selected item into view when dropdown opens
  useEffect(() => {
    if (isOpen && listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      if (selected) selected.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen]);

  // Determine dropdown direction
  const handleToggle = useCallback(() => {
    if (disabled) return;
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 290);
    }
    setIsOpen(prev => !prev);
  }, [disabled, isOpen]);

  // Normalize options to { label, value }
  const normalizedOptions = (options || []).map((opt, i) => {
    if (typeof opt === 'string' || typeof opt === 'number') {
      return { label: String(opt), value: opt, _key: `opt-${i}` };
    }
    return { ...opt, _key: `opt-${i}` };
  });

  // Find selected label
  const selectedOption = normalizedOptions.find(opt => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  const dropdownPosition = openUpward
    ? { bottom: 'calc(100% + 4px)', top: 'auto' }
    : { top: 'calc(100% + 4px)', bottom: 'auto' };

  return (
    <div 
      ref={containerRef} 
      className={`shadcn-select-container ${className}`} 
      style={{ position: 'relative', width: '100%', ...style }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '8px 12px',
          backgroundColor: 'var(--bg-page, #ffffff)',
          border: `1px solid ${isOpen ? 'var(--primary, #b068b9)' : 'var(--border-light, #e2e8f0)'}`,
          borderRadius: 'var(--radius-md, 6px)',
          fontSize: '13px',
          fontWeight: '600',
          color: selectedOption ? 'var(--text-primary, #0f172a)' : 'var(--text-muted, #94a3b8)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          boxShadow: isOpen ? '0 0 0 2px rgba(176, 104, 185, 0.2)' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
      >
        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {displayLabel}
        </span>
        <ChevronDown 
          size={14} 
          style={{ 
            opacity: 0.5, 
            marginLeft: '8px', 
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: openUpward ? 5 : -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpward ? 5 : -5, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              ...dropdownPosition,
              left: 0,
              right: 0,
              zIndex: 9999,
              maxHeight: '260px',
              overflowY: 'auto',
              backgroundColor: 'rgba(255, 255, 255, 0.99)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-light, #e2e8f0)',
              borderRadius: 'var(--radius-md, 6px)',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              padding: '4px',
            }}
            ref={listRef}
          >
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {normalizedOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <li key={opt._key} data-selected={isSelected || undefined}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f1f5f9)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        padding: '7px 8px 7px 30px',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary, #0f172a)',
                        fontSize: '13px',
                        fontWeight: isSelected ? '600' : '400',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      {isSelected && (
                        <span style={{ position: 'absolute', left: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary, #b068b9)' }}>
                          <Check size={14} />
                        </span>
                      )}
                      {opt.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShadcnSelect;
