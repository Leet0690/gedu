import React from 'react';

export const SemesterToggle = ({ activeSemester, onChange, compact = false }) => (
  <div className={`home-semester-toggle ${compact ? 'home-semester-toggle-compact' : ''}`}>
    {['S1', 'S2'].map(sem => (
      <button
        key={sem}
        type="button"
        onClick={() => onChange(sem)}
        className={`home-semester-toggle-button ${activeSemester === sem ? 'is-active' : ''}`}
        title={`Activer ${sem}`}
      >
        {sem}
      </button>
    ))}
  </div>
);
