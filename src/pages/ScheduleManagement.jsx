import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilterSelect } from '../components/ui/FilterSelect';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import {
  FILIERES,
  getClassCode,
  getDiplomaForMajor,
  getModulesForFiliere,
  getStudyYearsForDiploma
} from '../data/modules';
import {
  CalendarDays, Plus, Trash2, Clock, User, MapPin,
  X, Layers, Users, Calendar, Edit
} from 'lucide-react';

const START_HOUR = 8;
const END_HOUR = 19;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const PX_PER_HOUR = 80;
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const formatTimeDash = (timeStr) => {
  if (!timeStr) return '';
  const cleaned = timeStr.replace(/h/gi, ':').trim();
  const parts = cleaned.split(':');
  if (parts.length < 2) return cleaned;
  return `${parts[0].trim().padStart(2, '0')}:${parts[1].trim().padStart(2, '0')}`;
};

const parseTimeRange = (timeStr = '') => {
  const parts = timeStr.split('-');
  if (parts.length >= 2) return { 
    start: formatTimeDash(parts[0].trim()), 
    end: formatTimeDash(parts[1].trim()) 
  };
  return { start: '08:00', end: '10:00' };
};

const timeToPixels = (timeStr = '08:00') => {
  const [h, m] = timeStr.split(':').map(Number);
  return ((h - START_HOUR) * 60 + (m || 0)) * (PX_PER_HOUR / 60);
};

const getDeterministicEventStyles = (moduleName = '') => {
  let hash = 0;
  const str = moduleName || 'non defini';
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return {
    '--event-bg': `linear-gradient(135deg, hsla(${hue}, 85%, 96%, 0.95) 0%, hsla(${hue}, 85%, 98%, 0.8) 100%)`,
    '--event-border': `hsla(${hue}, 60%, 75%, 0.8)`,
    '--event-color': `hsl(${hue}, 60%, 40%)`,
    '--event-text': `hsl(${hue}, 70%, 20%)`,
    '--event-rail': `linear-gradient(180deg, hsl(${hue}, 75%, 48%) 0%, hsl(${hue}, 75%, 32%) 100%)`
  };
};

const getDayColors = (day = '') => {
  const normalized = day.trim().toLowerCase();
  if (normalized.includes('lun')) {
    return { bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.02) 100%)', text: '#4f46e5', border: 'rgba(99, 102, 241, 0.2)' };
  }
  if (normalized.includes('mar')) {
    return { bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)', text: '#059669', border: 'rgba(16, 185, 129, 0.2)' };
  }
  if (normalized.includes('mer')) {
    return { bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)', text: '#d97706', border: 'rgba(245, 158, 11, 0.2)' };
  }
  if (normalized.includes('jeu')) {
    return { bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.02) 100%)', text: '#7c3aed', border: 'rgba(139, 92, 246, 0.2)' };
  }
  if (normalized.includes('ven')) {
    return { bg: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(244, 63, 94, 0.02) 100%)', text: '#e11d48', border: 'rgba(244, 63, 94, 0.2)' };
  }
  if (normalized.includes('sam')) {
    return { bg: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(14, 165, 233, 0.02) 100%)', text: '#0284c7', border: 'rgba(14, 165, 233, 0.2)' };
  }
  return { bg: 'linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, rgba(20, 184, 166, 0.02) 100%)', text: '#0d9488', border: 'rgba(20, 184, 166, 0.2)' };
};

const getHourColors = (hour) => {
  const hue = ((hour - 8) * 30) % 360;
  return {
    bg: `linear-gradient(180deg, hsla(${hue}, 85%, 97%, 0.95) 0%, hsla(${hue}, 85%, 99%, 0.7) 100%)`,
    text: `hsl(${hue}, 70%, 35%)`,
    border: `hsla(${hue}, 60%, 80%, 0.5)`,
    accent: `hsl(${hue}, 75%, 45%)`
  };
};

const getGroupAbbreviation = (diploma, filiere, annee) => getClassCode(diploma, filiere, annee);

const labelStyle = {
  fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em'
};

const ScheduleManagement = () => {
  const { 
    teachers, schedules, addSchedule, updateSchedule, 
    deleteSchedule, modules: allModules, confirmAction,
    activeSemester, getActiveScheduleModule
  } = useApp();
  const { showToast } = useToast();

  const diplomas = useMemo(() => Object.keys(FILIERES), []);
  const defaultDiploma = diplomas.includes('Technicien Spécialisé') ? 'Technicien Spécialisé' : diplomas[0];
  const [diploma, setDiploma] = useState(defaultDiploma);
  const availableFilieres = useMemo(() => FILIERES[diploma] || [], [diploma]);
  const [filiere, setFiliere] = useState(() => {
    const defaultFilieres = FILIERES[defaultDiploma] || [];
    return defaultFilieres.includes('Développement Informatique') ? 'Développement Informatique' : defaultFilieres[0];
  });
  const availableStudyYears = useMemo(() => getStudyYearsForDiploma(diploma), [diploma]);
  const [annee, setAnnee] = useState(availableStudyYears[0]);
  const semester = activeSemester;

  const groupLabel = useMemo(() => getGroupAbbreviation(diploma, filiere, annee), [diploma, filiere, annee]);
  const modulesBySemester = useMemo(() => {
    const configured = allModules.filter(m => m.diploma === diploma && m.major === filiere && m.year === annee);
    if (configured.length === 0) {
      const defaultModules = getModulesForFiliere(diploma, filiere, annee);
      return { S1: defaultModules, S2: defaultModules };
    }
    return {
      S1: configured.filter(m => ['S1', 'Annuel'].includes(m.semester || 'S1')).map(m => m.name),
      S2: configured.filter(m => ['S2', 'Annuel'].includes(m.semester || 'S1')).map(m => m.name)
    };
  }, [diploma, filiere, annee, allModules]);
  const filteredSchedules = useMemo(
    () => schedules.filter(s =>
      (s.diploma || getDiplomaForMajor(s.filiere)) === diploma &&
      s.filiere === filiere &&
      s.annee === annee
    ),
    [schedules, diploma, filiere, annee]
  );
  const activeDays = useMemo(
    () => DAYS.filter(day => filteredSchedules.some(s => s.day === day)).length,
    [filteredSchedules]
  );

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [formData, setFormData] = useState({
    day: 'Lundi', time: '08:30-10:30', module: '', moduleS1: '', moduleS2: '', teacherId: '', room: '', type: 'Cours'
  });

  const openAdd = () => {
    setEditingSession(null);
    setFormData({ day: 'Lundi', time: '08:30-10:30', module: '', moduleS1: '', moduleS2: '', teacherId: '', room: '', type: 'Cours' });
    setShowAddModal(true);
  };

  const openEdit = (session) => {
    setEditingSession(session);
    setFormData({
      day: session.day,
      time: session.time,
      module: session.module || '',
      moduleS1: session.moduleS1 || session.module || '',
      moduleS2: session.moduleS2 || '',
      teacherId: session.teacherId,
      room: session.room || '',
      type: session.type || 'Cours'
    });
    setShowAddModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((!formData.moduleS1 && !formData.moduleS2 && !formData.module) || !formData.teacherId) return showToast('Veuillez renseigner au moins un module et le formateur', 'warning');
    
    // Normalize time format to HH:mm-HH:mm
    const parts = formData.time.split('-');
    const startTime = formatTimeDash(parts[0]);
    const endTime = parts[1] ? formatTimeDash(parts[1]) : '';
    const normalizedTime = startTime + (endTime ? `-${endTime}` : '');
    
    const finalData = {
      ...formData,
      module: formData.moduleS1 || formData.moduleS2 || formData.module,
      time: normalizedTime,
      diploma,
      filiere,
      annee
    };
    
    if (editingSession) {
      updateSchedule(editingSession.id, finalData);
    } else {
      addSchedule(finalData);
    }
    
    setShowAddModal(false);
    setFormData(prev => ({ ...prev, module: '', moduleS1: '', moduleS2: '', room: '' }));
  };

  const handleDelete = async (id) => {
    if (await confirmAction({ title: 'Supprimer séance ?', message: "Voulez-vous retirer cette séance de l'emploi du temps ?", type: 'danger' })) {
      deleteSchedule(id);
    }
  };

  const totalGridHeight = (END_HOUR - START_HOUR + 1) * PX_PER_HOUR;
  const today = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const topScrollRef = useRef(null);
  const mainScrollRef = useRef(null);

  const handleTopScroll = () => {
    if (topScrollRef.current && mainScrollRef.current) {
      mainScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleMainScroll = () => {
    if (topScrollRef.current && mainScrollRef.current) {
      topScrollRef.current.scrollLeft = mainScrollRef.current.scrollLeft;
    }
  };

  return (
    <div className="max-w-container section-padding schedule-premium-page">
      {/* Page Header */}
      <div className="schedule-premium-header">
        <div className="schedule-premium-header-icon">
          <CalendarDays size={24} />
        </div>
        <div className="schedule-premium-header-copy">
          <span className="schedule-premium-eyebrow">Organisation pédagogique</span>
          <h1>Emplois du Temps</h1>
          <p>Plannings hebdomadaires par filière et groupe.</p>
        </div>
        <button onClick={openAdd} className="btn-modern primary schedule-premium-add">
          <Plus size={18} style={{ marginRight: '8px' }} /> Ajouter une séance
        </button>
        <div className="schedule-premium-header-orb" aria-hidden="true">
          <Calendar size={112} />
        </div>
      </div>

      {/* Filter + Stats Bar */}
      <div className="glass-card schedule-premium-filter-card" style={{ padding: '16px 20px', marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'end', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '0 1 220px' }}>
          <label style={labelStyle}>Niveau</label>
          <FilterSelect
            value={diploma}
            onChange={val => {
              const nextFiliere = (FILIERES[val] || [])[0] || '';
              setDiploma(val);
              setFiliere(nextFiliere);
              setAnnee(getStudyYearsForDiploma(val)[0]);
            }}
            options={diplomas.map(d => ({ label: d, value: d }))}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 260px' }}>
          <label style={labelStyle}>Filière</label>
          <FilterSelect
            value={filiere}
            onChange={val => { setFiliere(val); setAnnee(getStudyYearsForDiploma(diploma)[0]); }}
            options={availableFilieres.map(f => ({ label: f, value: f }))}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '0 1 180px' }}>
          <label style={labelStyle}>Année</label>
          <FilterSelect
            value={annee}
            onChange={val => setAnnee(val)}
            options={availableStudyYears.map(a => ({ label: a, value: a }))}
          />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '999px', background: 'var(--primary-ultra-light)', border: '1px solid rgba(176,104,185,0.15)' }}>
            <Users size={13} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)' }}>{groupLabel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '999px', background: 'rgba(254,205,8,0.12)', border: '1px solid rgba(254,205,8,0.2)' }}>
            <Clock size={13} style={{ color: '#a06208' }} />
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#a06208' }}>{filteredSchedules.length} séances {semester}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '999px', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.15)' }}>
            <Calendar size={13} style={{ color: '#16a34a' }} />
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#16a34a' }}>{activeDays} jours actifs</span>
          </div>
        </div>
      </div>

      {/* Time Grid */}
      <div className="glass-card schedule-premium-grid-shell" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Top Sync Scrollbar */}
        <div 
          ref={topScrollRef} 
          onScroll={handleTopScroll} 
          className="top-scrollbar-container"
          style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', height: '6px' }}
        >
          <div style={{ width: `${90 + HOURS.length * PX_PER_HOUR}px`, height: '1px' }} />
        </div>

        <div ref={mainScrollRef} onScroll={handleMainScroll} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'none' }}>
          <div className="home-schedule-grid-inverted" style={{ width: '100%' }}>
            {/* Columns Header Row (Hours) */}
            <div className="home-schedule-header-row">
              <div className="home-schedule-corner-inverted">Jour / Heure</div>
              <div className="home-schedule-hours-row">
                {HOURS.map(hour => {
                  const colors = getHourColors(hour);
                  return (
                    <div 
                      key={hour} 
                      className="home-schedule-hour-col-header" 
                      style={{ 
                        width: `${PX_PER_HOUR}px`, 
                        flexShrink: 0,
                        background: colors.bg,
                        borderBottom: `2.5px solid ${colors.accent}`,
                        borderRight: `1px solid ${colors.border}`
                      }}
                    >
                      <span style={{ color: colors.text }}>{hour.toString().padStart(2, '0')}:00</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rows (Days) */}
            <div className="home-schedule-rows-container" style={{ position: 'relative' }}>
              {/* Watermark */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '130px',
                fontWeight: '900',
                color: 'rgba(176, 104, 185, 0.09)',
                zIndex: 2,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                letterSpacing: '0.08em',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>
                {groupLabel}
              </div>
              {DAYS.map(day => {
                const daySessions = filteredSchedules
                  .filter(s => s.day === day)
                  .map(s => { const { start, end } = parseTimeRange(s.time); return { ...s, start, end }; })
                  .sort((a, b) => a.start.localeCompare(b.start));

                const colors = getDayColors(day);
                return (
                  <div key={day} className="home-schedule-day-row" style={{ height: '96px' }}>
                    {/* Day label (sticky col) */}
                    <div 
                      className="home-schedule-day-label-col"
                      style={{
                        background: colors.bg,
                        borderRightColor: colors.border,
                        borderLeft: `4px solid ${colors.text}`
                      }}
                    >
                      <span className="home-schedule-day-name" style={{ color: colors.text }}>
                        {day.toUpperCase()}
                      </span>
                      {daySessions.length > 0 && (
                        <span className="home-schedule-day-count" style={{ backgroundColor: colors.text, color: '#ffffff' }}>
                          {daySessions.length}
                        </span>
                      )}
                    </div>

                    {/* Day Timeline body */}
                    <div className="home-schedule-day-timeline" style={{ width: `${HOURS.length * PX_PER_HOUR}px`, flexShrink: 0 }}>
                      {/* Hour grid lines (vertical columns) */}
                      {HOURS.map(hour => (
                        <div key={hour} className="home-schedule-hour-vertical-line" style={{ left: `${(hour - START_HOUR) * PX_PER_HOUR}px` }} />
                      ))}
                      {/* Half-hour lines (dashed) */}
                      {HOURS.map(hour => (
                        <div key={`h-${hour}`} className="home-schedule-half-vertical-line" style={{ left: `${(hour - START_HOUR) * PX_PER_HOUR + PX_PER_HOUR / 2}px` }} />
                      ))}

                      {daySessions.length === 0 && (
                        <div className="home-schedule-free">
                          <span>Libre</span>
                        </div>
                      )}

                      {daySessions.map(session => {
                        const left = timeToPixels(session.start);
                        const width = Math.max(timeToPixels(session.end) - left, PX_PER_HOUR * 0.7);
                        const isTP = session.type === 'TP';
                        const teacher = teachers.find(t => t.id === session.teacherId);
                        const displayedModule = getActiveScheduleModule(session);
                        const eventStyles = getDeterministicEventStyles(displayedModule || session.module || '');

                        return (
                          <motion.div
                            key={session.id}
                            layout
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`home-schedule-event ${isTP ? 'home-schedule-event-tp' : 'home-schedule-event-course'} ${day === today ? 'home-schedule-event-today' : ''}`}
                            style={{
                              position: 'absolute',
                              left: `${left + 4}px`,
                              width: `${width - 8}px`,
                              top: '6px',
                              bottom: '6px',
                              height: 'auto',
                              cursor: 'default',
                              zIndex: 5,
                              ...eventStyles
                            }}
                            whileHover={{ scale: 1.015, zIndex: 10 }}
                          >
                            <div className="home-schedule-event-rail-horizontal" />

                            {/* Action buttons */}
                            <div style={{ position: 'absolute', top: '5px', right: '5px', display: 'flex', gap: '4px', zIndex: 15 }}>
                              <button
                                onClick={() => openEdit(session)}
                                className="schedule-action-btn edit"
                                title="Modifier"
                              >
                                <Edit size={10} />
                              </button>
                              <button
                                onClick={() => handleDelete(session.id)}
                                className="schedule-action-btn delete"
                                title="Supprimer"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>

                            {/* Session type badge */}
                            <div style={{
                              position: 'absolute',
                              top: '5px',
                              left: '8px',
                              fontSize: '7.5px',
                              fontWeight: '850',
                              padding: '1.5px 4.5px',
                              borderRadius: '4px',
                              backgroundColor: isTP ? 'rgba(99, 102, 241, 0.12)' : 'rgba(245, 158, 11, 0.15)',
                              color: 'var(--event-text)',
                              textTransform: 'uppercase',
                              lineHeight: 1.1,
                              border: '1.5px solid currentColor',
                              opacity: 0.9
                            }}>
                              {session.type || 'Cours'}
                            </div>

                            {/* Time range */}
                            <div className="home-schedule-event-time">
                              <Clock size={8} />
                              <span>
                                {session.start}–{session.end}
                              </span>
                            </div>

                            {/* Module name */}
                            <div className="home-schedule-event-title">
                              {displayedModule || 'Module non défini'}
                            </div>

                            {/* Meta */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                              {session.room && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%' }}>
                                  <MapPin size={9} style={{ color: 'var(--event-color)', opacity: 0.7, flexShrink: 0 }} />
                                  <span style={{ fontSize: '8.5px', fontWeight: '700', fontFamily: 'Inter, sans-serif', color: 'var(--event-text)', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {session.room}
                                  </span>
                                </div>
                              )}
                              {teacher && (
                                <div className="home-schedule-event-teacher" style={{ width: '100%' }}>
                                  <User size={8} />
                                  <span>
                                    {teacher.name}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Hover Tooltip */}
                            <div className="schedule-tooltip">
                              <div style={{ fontWeight: '800', fontSize: '10px', marginBottom: '4px', borderBottom: '1px solid var(--event-border)', paddingBottom: '3px', color: 'var(--event-color)' }}>
                                {displayedModule || 'Module non défini'}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--event-text)', opacity: 0.95, fontSize: '9px' }}>
                                <div>🕒 {session.start} – {session.end} ({session.type || 'Cours'})</div>
                                {teacher && <div>👤 {teacher.name}</div>}
                                {session.room && <div>📍 Salle : {session.room}</div>}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add Session Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="app-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }}>
            <motion.div
              className="app-modal-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.1)', backdropFilter: 'blur(8px)' }}
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="glass-premium schedule-premium-dialog app-modal-surface"
              style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', position: 'relative', zIndex: 101, borderRadius: 'var(--radius-3xl)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '900', color: 'var(--text-primary)' }}>
                    {editingSession ? 'Modifier la séance' : 'Ajouter une séance'}
                  </h3>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '2px' }}>
                    {diploma} · {filiere} · {annee} · {semester}
                  </p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="close-button" aria-label="Fermer la fenêtre" title="Fermer"><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Jour</label>
                    <div style={{ marginTop: '4px' }}>
                      <FilterSelect
                        value={formData.day}
                        onChange={val => setFormData({ ...formData, day: val })}
                        options={DAYS.map(d => ({ label: d, value: d }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Type</label>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                      {['Cours', 'TP', 'TD'].map(type => (
                        <button
                          key={type} type="button"
                          onClick={() => setFormData({ ...formData, type })}
                          style={{
                            flex: 1, padding: '8px 4px', borderRadius: 'var(--radius-md)', border: '1px solid',
                            fontWeight: '800', fontSize: '10px', cursor: 'pointer', transition: 'all 0.1s',
                            borderColor: formData.type === type ? 'var(--primary)' : 'var(--border-light)',
                            background: formData.type === type ? 'var(--primary-ultra-light)' : 'white',
                            color: formData.type === type ? 'var(--primary)' : 'var(--text-muted)'
                          }}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Horaire</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <input
                      type="time" className="input-premium" style={{ flex: 1, padding: '8px 12px' }}
                      required
                      value={formData.time ? formData.time.split('-')[0] : ''}
                      onChange={e => {
                        const end = formData.time && formData.time.includes('-') ? formData.time.split('-')[1] : '';
                        setFormData({ ...formData, time: `${e.target.value}-${end}` });
                      }}
                    />
                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>à</span>
                    <input
                      type="time" className="input-premium" style={{ flex: 1, padding: '8px 12px' }}
                      required
                      value={formData.time && formData.time.includes('-') ? formData.time.split('-')[1] : ''}
                      onChange={e => {
                        const start = formData.time ? formData.time.split('-')[0] : '';
                        setFormData({ ...formData, time: `${start}-${e.target.value}` });
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Formateur</label>
                    <div style={{ marginTop: '4px' }}>
                      {(() => {
                        const filtered = teachers.filter(t =>
                          (!t.diplomas?.length || t.diplomas.includes(diploma)) &&
                          (t.groups || []).includes(filiere) && (t.years || []).includes(annee)
                        );
                        const options = [
                          { label: "Choisir...", value: "" },
                          ...filtered.map(t => ({ label: t.name, value: t.id }))
                        ];
                        
                        return (
                          <FilterSelect
                            value={formData.teacherId}
                            onChange={val => {
                              const teacher = teachers.find(t => t.id === val);
                              const teacherSubjects = (teacher?.subjects || [teacher?.subject]).filter(Boolean);
                              const nextModuleS1 = teacherSubjects.find(subject => modulesBySemester.S1.includes(subject)) || '';
                              const nextModuleS2 = teacherSubjects.find(subject => modulesBySemester.S2.includes(subject)) || '';
                              setFormData({ ...formData, teacherId: val, module: nextModuleS1, moduleS1: nextModuleS1, moduleS2: nextModuleS2 });
                            }}
                            options={filtered.length > 0 ? options : [{ label: "Aucun formateur", value: "" }]}
                          />
                        );
                      })()}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Salle (optionnel)</label>
                    <input
                      type="text" className="input-premium"
                      style={{ width: '100%', marginTop: '4px', padding: '8px 12px' }}
                      placeholder="Ex: A1"
                      value={formData.room}
                      onChange={e => setFormData({ ...formData, room: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Module S1</label>
                    <div style={{ marginTop: '4px' }}>
                      {(() => {
                        const teacher = teachers.find(t => t.id === formData.teacherId);
                        if (!teacher) return <FilterSelect value="" onChange={()=>{}} options={[{label: "Choisir formateur", value: ""}]} disabled />;
                        const teacherModules = teacher.subjects || (teacher.subject ? [teacher.subject] : []);
                        const filtered = (modulesBySemester.S1 || []).filter(m => teacherModules.includes(m));
                        if (filtered.length === 0) return <FilterSelect value="" onChange={()=>{}} options={[{label: "Aucun module", value: ""}]} disabled />;
                        
                        return (
                          <FilterSelect
                            value={formData.moduleS1}
                            onChange={val => setFormData({ ...formData, module: val, moduleS1: val })}
                            options={[
                              { label: "Choisir...", value: "" },
                              ...filtered.map(m => ({ label: m, value: m }))
                            ]}
                          />
                        );
                      })()}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Module S2</label>
                    <div style={{ marginTop: '4px' }}>
                      {(() => {
                        const teacher = teachers.find(t => t.id === formData.teacherId);
                        if (!teacher) return <FilterSelect value="" onChange={()=>{}} options={[{label: "Choisir formateur", value: ""}]} disabled />;
                        const teacherModules = teacher.subjects || (teacher.subject ? [teacher.subject] : []);
                        const filtered = (modulesBySemester.S2 || []).filter(m => teacherModules.includes(m));
                        if (filtered.length === 0) return <FilterSelect value="" onChange={()=>{}} options={[{label: "Aucun module", value: ""}]} disabled />;
                        
                        return (
                          <FilterSelect
                            value={formData.moduleS2}
                            onChange={val => setFormData({ ...formData, moduleS2: val })}
                            options={[
                              { label: "Aucun module", value: "" },
                              ...filtered.map(m => ({ label: m, value: m }))
                            ]}
                          />
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button type="submit" className="btn-modern primary" style={{ flex: 1, justifyContent: 'center' }}>
                    Valider la séance
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScheduleManagement;
