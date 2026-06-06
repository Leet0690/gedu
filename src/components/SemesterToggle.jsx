import React from 'react';

export const SemesterToggle = ({ activeSemester, onChange, compact = false }) => (
  <div className={`home-semester-toggle ${compact ? 'home-semester-toggle-compact' : ''}`}>
    {['S1', 'S2'].map(sem => (
      <button
        key={sem}
        type="button"
        onClick={() => onChange(sem)}
        className={`home-semester-toggle-button ${activeSemester === sem ? 'is-active' : ''}`}
        data-tooltip={`Activer le semestre ${sem}`}
      >
        {sem}
      </button>
    ))}
  </div>
);
