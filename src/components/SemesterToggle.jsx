import React from 'react';

export const SemesterToggle = ({ activeSemester, onChange, compact = false }) => {
  const handleToggle = () => onChange(activeSemester === 'S1' ? 'S2' : 'S1');

  return (
    <div 
      className={`home-semester-toggle ${compact ? 'home-semester-toggle-compact' : ''}`}
      onClick={handleToggle}
      style={{ cursor: 'pointer' }}
      data-tooltip={`Activer le semestre ${activeSemester === 'S1' ? 'S2' : 'S1'}`}
    >
      {['S1', 'S2'].map(sem => (
        <button
          key={sem}
          type="button"
          className={`home-semester-toggle-button ${activeSemester === sem ? 'is-active' : ''}`}
        >
          {sem}
        </button>
      ))}
    </div>
  );
};
