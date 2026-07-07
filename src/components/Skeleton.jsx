import React, { memo } from 'react';
import { motion } from 'framer-motion';

export const Skeleton = memo(function Skeleton({ width, height, borderRadius = 'var(--radius-md)', margin = '0' }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
      style={{
        width: width || '100%',
        height: height || '20px',
        background: 'linear-gradient(90deg, var(--bg-subtle) 25%, var(--border-light) 50%, var(--bg-subtle) 75%)',
        backgroundSize: '200% 100%',
        borderRadius,
        margin
      }}
    />
  );
});

export const TableSkeleton = ({ rows = 5 }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="dashboard-grid-row" style={{ border: 'none', background: 'transparent' }}>
          <Skeleton height="40px" width="40px" borderRadius="50%" />
          <Skeleton height="20px" width="70%" />
          <Skeleton height="20px" width="40%" />
          <Skeleton height="20px" width="30%" />
          <Skeleton height="32px" width="32px" />
        </div>
      ))}
    </div>
  );
};
