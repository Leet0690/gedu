import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, CalendarDays } from 'lucide-react';
import { getDefaultAcademicYearTransition } from '../utils/studentStatus';
import { cn } from '../lib/cn';

export const AcademicYearSelector = ({ activeYear, availableYears, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const currentOfficialYear = getDefaultAcademicYearTransition().fromAcademicYear;

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!availableYears || availableYears.length === 0) return null;

  return (
    <div ref={containerRef} className="relative inline-block text-left select-none">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all duration-200 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1",
          isOpen 
            ? "bg-violet-50 text-violet-700 border border-violet-200"
            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 active:scale-95"
        )}
      >
        <CalendarDays size={14} className={isOpen ? "text-violet-600" : "text-slate-400"} />
        <span>{activeYear}</span>
        <ChevronDown size={14} className={cn("transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white p-1.5 shadow-xl border border-slate-100 z-50 overflow-hidden origin-top-right animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50 flex items-center justify-between">
            <span>Années Académiques</span>
            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{availableYears.length}</span>
          </div>
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto no-scrollbar">
            {availableYears.map(year => {
              const isSelected = year === activeYear;
              const isCurrent = year === currentOfficialYear;
              
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => {
                    onChange(year);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "group flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-left transition-all duration-200 outline-none",
                    isSelected
                      ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-300/40"
                      : "text-slate-700 hover:bg-violet-50/70 hover:text-violet-900 focus-visible:bg-violet-50"
                  )}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className={cn("text-[12px] font-bold tracking-wide", isSelected ? "text-white" : "text-slate-700 group-hover:text-violet-900")}>
                      {year}
                    </span>
                    <span className={cn(
                      "text-[9px] uppercase tracking-widest font-semibold",
                      isSelected ? "text-violet-200" : (isCurrent ? "text-emerald-500" : "text-slate-400")
                    )}>
                      {isCurrent ? "Année Actuelle" : "Archive"}
                    </span>
                  </div>
                  {isSelected && <Check size={16} strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
