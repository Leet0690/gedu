import React from 'react';
import { cn } from '../lib/cn';

export const SemesterToggle = ({ activeSemester, onChange, compact = false }) => {
  return (
    <div className="inline-flex gap-1 bg-slate-100 rounded-full p-1 shadow-inner">
      {['S1', 'S2'].map(sem => (
        <button
          key={sem}
          type="button"
          onClick={() => onChange(sem)}
          title={`Activer le semestre ${sem}`}
          className={cn(
            'rounded-full font-black uppercase tracking-wider transition-all duration-200 active:scale-95 select-none',
            compact ? 'px-3 py-1.5 text-[11px] min-w-[38px]' : 'px-4 py-2 text-xs min-w-[52px]',
            activeSemester === sem
              ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-300/40 -translate-y-px'
              : 'text-slate-400 bg-transparent hover:text-slate-700 hover:bg-white/70',
          )}
        >
          {sem}
        </button>
      ))}
    </div>
  );
};
