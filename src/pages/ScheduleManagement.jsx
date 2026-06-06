import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilterSelect } from '../components/ui/FilterSelect';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { FILIERES, MODULES_DATA, getModulesForFiliere } from '../data/modules';
import {
  CalendarDays, Plus, Trash2, Clock, User, MapPin,
  X, Layers, Users, Calendar, Edit
} from 'lucide-react';

const START_HOUR = 8;
const END_HOUR = 19;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const PX_PER_HOUR = 64;
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

const getGroupAbbreviation = (filiere, annee) => {
  let diplomaAbbr = '';
  for (const dip in MODULES_DATA) {
    if (MODULES_DATA[dip][filiere]) {
      diplomaAbbr = dip.includes('Spécialisé') ? 'TS' : 'T';
      break;
    }
  }
  let majorAbbr = '';
  if (filiere.includes('Développement')) majorAbbr = 'DI';
  else if (filiere.includes('Gestion Informatisée')) majorAbbr = 'GI';
  else if (filiere.includes('Logistique')) majorAbbr = 'GTL';
  else if (filiere.includes('Entreprises')) majorAbbr = 'GE';
  else majorAbbr = filiere.split(' ').map(w => w[0]).join('').toUpperCase();
  const yearNum = annee.includes('1') ? '1' : '2';
  return diplomaAbbr + majorAbbr + yearNum;
};

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

  const allFilieres = useMemo(() => Array.from(new Set(Object.values(FILIERES).flat())), []);
  const allAnnees = ['1ère année', '2ème année'];

  const [filiere, setFiliere] = useState(
    allFilieres.includes('Développement Informatique') ? 'Développement Informatique' : allFilieres[0]
  );
  const [annee, setAnnee] = useState(allAnnees[0]);
  const semester = activeSemester;

  const groupLabel = useMemo(() => getGroupAbbreviation(filiere, annee), [filiere, annee]);
  const modulesBySemester = useMemo(() => {
    const configured = allModules.filter(m => m.major === filiere && m.year === annee);
    if (configured.length === 0) {
      const diploma = Object.keys(FILIERES).find(d => FILIERES[d].includes(filiere));
      const defaultModules = getModulesForFiliere(diploma, filiere, annee);
      return { S1: defaultModules, S2: defaultModules };
    }
    return {
      S1: configured.filter(m => ['S1', 'Annuel'].includes(m.semester || 'S1')).map(m => m.name),
      S2: configured.filter(m => ['S2', 'Annuel'].includes(m.semester || 'S1')).map(m => m.name)
    };
  }, [filiere, annee, allModules]);
  const filteredSchedules = useMemo(
    () => schedules.filter(s => s.filiere === filiere && s.annee === annee),
    [schedules, filiere, annee]
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

  return (
    <div className="max-w-container section-padding">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '900', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <CalendarDays size={28} style={{ color: 'var(--primary)' }} /> Emplois du Temps
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>
            Plannings hebdomadaires par filière et groupe.
          </p>
        </div>
        <button onClick={openAdd} className="btn-modern primary">
          <Plus size={18} style={{ marginRight: '8px' }} /> Ajouter une séance
        </button>
      </div>

      {/* Filter + Stats Bar */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'end', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 260px' }}>
          <label style={labelStyle}>Filière</label>
          <FilterSelect
            value={filiere}
            onChange={val => setFiliere(val)}
            options={allFilieres.map(f => ({ label: f, value: f }))}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '0 1 180px' }}>
          <label style={labelStyle}>Année</label>
          <FilterSelect
            value={annee}
            onChange={val => setAnnee(val)}
            options={allAnnees.map(a => ({ label: a, value: a }))}
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
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
          <div style={{ display: 'flex', minWidth: '900px' }}>

            {/* Time Axis */}
            <div style={{
              width: '72px', flexShrink: 0,
              borderRight: '1px solid var(--border-light)',
              background: '#fcfdfe',
              position: 'sticky', left: 0, zIndex: 20
            }}>
              {/* Corner spacer */}
              <div style={{ height: '48px', borderBottom: '1px solid var(--border-light)' }} />
              {/* Hour labels */}
              <div style={{ position: 'relative', height: `${totalGridHeight}px` }}>
                {HOURS.map(hour => (
                  <div key={hour} style={{ position: 'absolute', top: `${(hour - START_HOUR) * PX_PER_HOUR - 9}px`, right: '12px' }}>
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: '800', 
                      color: 'var(--text-secondary)', 
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.02em'
                    }}>
                      {hour.toString().padStart(2, '0')}:00
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Day Columns */}
            <div style={{ flex: 1, display: 'flex' }}>
              {DAYS.map(day => {
                const daySessions = filteredSchedules
                  .filter(s => s.day === day)
                  .map(s => {
                    const { start, end } = parseTimeRange(s.time);
                    return { ...s, start, end };
                  })
                  .sort((a, b) => a.start.localeCompare(b.start));

                return (
                  <div key={day} style={{ flex: 1, borderRight: '1px solid var(--border-light)', minWidth: '140px' }}>
                    {/* Day header */}
                    <div style={{
                      height: '48px', borderBottom: '1px solid var(--border-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0 12px',
                      background: daySessions.length > 0 ? 'rgba(176,104,185,0.04)' : 'rgba(248,249,251,0.6)',
                      position: 'sticky', top: 0, zIndex: 10
                    }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {day.toUpperCase()}
                      </span>
                      {daySessions.length > 0 && (
                        <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--primary)', background: 'var(--primary-ultra-light)', padding: '2px 7px', borderRadius: '999px' }}>
                          {daySessions.length}
                        </span>
                      )}
                    </div>

                    {/* Grid body */}
                    <div style={{ position: 'relative', height: `${totalGridHeight}px` }}>
                      {/* Hour grid lines */}
                      {HOURS.map(hour => (
                        <div key={hour} style={{
                          position: 'absolute', top: `${(hour - START_HOUR) * PX_PER_HOUR}px`,
                          left: 0, right: 0, borderTop: '1px solid var(--border-light)',
                          pointerEvents: 'none'
                        }} />
                      ))}

                      {/* Half-hour lines */}
                      {HOURS.map(hour => (
                        <div key={`h-${hour}`} style={{
                          position: 'absolute', top: `${(hour - START_HOUR) * PX_PER_HOUR + PX_PER_HOUR / 2}px`,
                          left: 0, right: 0,
                          borderTop: '1px dashed rgba(0,0,0,0.04)',
                          pointerEvents: 'none'
                        }} />
                      ))}

                      {/* Empty state */}
                      {daySessions.length === 0 && (
                        <div style={{
                          position: 'absolute', inset: 0, display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          flexDirection: 'column', gap: '6px'
                        }}>
                          <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            Libre
                          </span>
                        </div>
                      )}

                      {/* Session cards */}
      {/* Session cards */}
                      {daySessions.map(session => {
                      const top = timeToPixels(session.start);
                      const height = Math.max(timeToPixels(session.end) - top, PX_PER_HOUR * 0.75);
                      const isTP = session.type === 'TP';
                      const teacher = teachers.find(t => t.id === session.teacherId);
                      const displayedModule = getActiveScheduleModule(session);

                        return (
                          <motion.div
                            key={session.id}
                            layout
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`home-schedule-event ${isTP ? 'home-schedule-event-tp' : 'home-schedule-event-course'}`}
                            style={{
                              position: 'absolute',
                              top: `${top}px`,
                              height: `${height}px`,
                              left: '6px', right: '6px',
                              cursor: 'default',
                              zIndex: 5
                            }}
                            whileHover={{ scale: 1.015, zIndex: 10 }}
                          >
                            {/* Left accent bar */}
                            <div className="home-schedule-event-rail" />

                            {/* Action buttons */}
                            <div style={{ position: 'absolute', top: '5px', right: '5px', display: 'flex', gap: '4px', zIndex: 15 }}>
                              <button
                                onClick={() => openEdit(session)}
                                style={{
                                  background: 'transparent', border: 'none', cursor: 'pointer',
                                  color: 'var(--event-color)', padding: '2px', borderRadius: '4px',
                                  lineHeight: 1, opacity: 0.6,
                                  transition: 'opacity 0.15s, color 0.15s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; }}
                              >
                                <Edit size={11} />
                              </button>
                              <button
                                onClick={() => handleDelete(session.id)}
                                style={{
                                  background: 'transparent', border: 'none', cursor: 'pointer',
                                  color: 'var(--event-color)', padding: '2px', borderRadius: '4px',
                                  lineHeight: 1, opacity: 0.6,
                                  transition: 'opacity 0.15s, color 0.15s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--event-color)'; e.currentTarget.style.opacity = '0.6'; }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>

                            {/* Time range */}
                            <div className="home-schedule-event-time">
                              <Clock size={8} />
                              <span>
                                {session.start}–{session.end}
                              </span>
                              <span style={{
                                marginLeft: 'auto',
                                marginRight: '16px',
                                fontSize: '8px', fontWeight: '850', padding: '1px 5px', borderRadius: '4px',
                                backgroundColor: isTP ? 'rgba(99, 102, 241, 0.12)' : 'rgba(245, 158, 11, 0.15)',
                                color: 'var(--event-text)',
                                textTransform: 'uppercase',
                                lineHeight: 1.1
                              }}>
                                {session.type || 'Cours'}
                              </span>
                            </div>

                            {/* Module name */}
                            <div className="home-schedule-event-title" style={{ marginRight: '12px' }}>
                              {displayedModule || 'Module non défini'}
                            </div>

                            {/* Meta */}
                            {height >= 56 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: 'auto' }}>
                                {session.room && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <MapPin size={9} style={{ color: 'var(--event-color)', opacity: 0.7, flexShrink: 0 }} />
                                    <span style={{ fontSize: '8.5px', fontWeight: '700', fontFamily: 'Inter, sans-serif', color: 'var(--event-text)', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {session.room}
                                    </span>
                                  </div>
                                )}
                                {teacher && (
                                  <div className="home-schedule-event-teacher">
                                    <User size={8} />
                                    <span>
                                      {teacher.name}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
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
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }}>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.1)', backdropFilter: 'blur(8px)' }}
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="glass-premium"
              style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', position: 'relative', zIndex: 101, borderRadius: 'var(--radius-3xl)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '900' }}>
                  {editingSession ? 'Modifier la séance' : 'Ajouter une séance'}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="close-button" aria-label="Fermer la fenêtre" title="Fermer"><X size={20} /></button>
              </div>

              <div className="badge-status primary" style={{ marginBottom: '24px', justifyContent: 'flex-start', padding: '12px 16px' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: '800' }}>{filiere} — {annee} — {semester}</span>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={labelStyle}>Jour</label>
                    <div style={{ marginTop: '6px' }}>
                      <FilterSelect
                        value={formData.day}
                        onChange={val => setFormData({ ...formData, day: val })}
                        options={DAYS.map(d => ({ label: d, value: d }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Horaire</label>
                    <input
                      type="text" className="input-premium"
                      style={{ width: '100%', marginTop: '6px' }}
                      placeholder="Ex: 08:30-10:30" required
                      value={formData.time}
                      onChange={e => setFormData({ ...formData, time: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Type de séance</label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    {['Cours', 'TP', 'TD'].map(type => (
                      <button
                        key={type} type="button"
                        onClick={() => setFormData({ ...formData, type })}
                        style={{
                          flex: 1, padding: '8px', borderRadius: 'var(--radius-lg)', border: '1.5px solid',
                          fontWeight: '800', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s',
                          borderColor: formData.type === type ? 'var(--primary)' : 'var(--border)',
                          background: formData.type === type ? 'var(--primary-ultra-light)' : 'white',
                          color: formData.type === type ? 'var(--primary)' : 'var(--text-muted)'
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Intervenant</label>
                  <div style={{ marginTop: '6px' }}>
                    {(() => {
                      const filtered = teachers.filter(t =>
                        (t.groups || []).includes(filiere) && (t.years || []).includes(annee)
                      );
                      const options = [
                        { label: "Sélectionner un formateur...", value: "" },
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
                          options={filtered.length > 0 ? options : [{ label: "Aucun formateur assigné à cette filière/année", value: "" }]}
                        />
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Module S1 / Même horaire</label>
                  <div style={{ marginTop: '6px' }}>
                    {(() => {
                      const teacher = teachers.find(t => t.id === formData.teacherId);
                      if (!teacher) return <FilterSelect value="" onChange={()=>{}} options={[{label: "Veuillez sélectionner un formateur d'abord", value: ""}]} />;
                      const teacherModules = teacher.subjects || (teacher.subject ? [teacher.subject] : []);
                      const filtered = (modulesBySemester.S1 || []).filter(m => teacherModules.includes(m));
                      if (filtered.length === 0) return <FilterSelect value="" onChange={()=>{}} options={[{label: "Aucun module commun disponible pour S1", value: ""}]} />;
                      
                      return (
                        <FilterSelect
                          value={formData.moduleS1}
                          onChange={val => setFormData({ ...formData, module: val, moduleS1: val })}
                          options={[
                            { label: "Sélectionner un module...", value: "" },
                            ...filtered.map(m => ({ label: m, value: m }))
                          ]}
                        />
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Module S2 / Même horaire</label>
                  <div style={{ marginTop: '6px' }}>
                    {(() => {
                      const teacher = teachers.find(t => t.id === formData.teacherId);
                      if (!teacher) return <FilterSelect value="" onChange={()=>{}} options={[{label: "Veuillez sélectionner un formateur d'abord", value: ""}]} />;
                      const teacherModules = teacher.subjects || (teacher.subject ? [teacher.subject] : []);
                      const filtered = (modulesBySemester.S2 || []).filter(m => teacherModules.includes(m));
                      if (filtered.length === 0) return <FilterSelect value="" onChange={()=>{}} options={[{label: "Aucun module commun disponible pour S2", value: ""}]} />;
                      
                      return (
                        <FilterSelect
                          value={formData.moduleS2}
                          onChange={val => setFormData({ ...formData, moduleS2: val })}
                          options={[
                            { label: "Aucun module S2", value: "" },
                            ...filtered.map(m => ({ label: m, value: m }))
                          ]}
                        />
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Salle (optionnel)</label>
                  <input
                    type="text" className="input-premium"
                    style={{ width: '100%', marginTop: '6px' }}
                    placeholder="Ex: Salle A1, Amphi…"
                    value={formData.room}
                    onChange={e => setFormData({ ...formData, room: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn-modern" style={{ flex: 1, justifyContent: 'center' }}>
                    Annuler
                  </button>
                  <button type="submit" className="btn-modern primary" style={{ flex: 2, justifyContent: 'center' }}>
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
