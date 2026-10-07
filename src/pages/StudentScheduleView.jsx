import PortalBrand from '../components/PortalBrand';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './ScheduleManagement.css';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, Clock, User, MapPin, Download, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { getClassCode } from '../data/modules';
import { useToast } from '../context/ToastContext';
import { getPublicSchedule, getScheduleShareErrorMessage } from '../services/scheduleShareService';
import { exportSchedule } from '../utils/scheduleExport';

const START_HOUR = 8;
const END_HOUR = 19;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const PX_PER_HOUR = 80;
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const parseTimeRange = (timeStr = '') => {
  const parts = timeStr.split('-');
  const normalizeTime = value => value.trim().replace(/(\d{1,2})\s*[h:]\s*(\d{2})/i, (_, hour, minute) => `${hour.padStart(2, '0')}:${minute}`);
  if (parts.length >= 2) return { start: normalizeTime(parts[0]), end: normalizeTime(parts[1]) };
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
  if (normalized.includes('lun')) return { bg: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.08) 0%, rgba(var(--primary-rgb), 0.02) 100%)', text: 'var(--primary)', border: 'rgba(var(--primary-rgb), 0.2)' };
  if (normalized.includes('mar')) return { bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)', text: '#059669', border: 'rgba(16, 185, 129, 0.2)' };
  if (normalized.includes('mer')) return { bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)', text: '#d97706', border: 'rgba(245, 158, 11, 0.2)' };
  if (normalized.includes('jeu')) return { bg: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.08) 0%, rgba(var(--primary-rgb), 0.02) 100%)', text: 'var(--primary)', border: 'rgba(var(--primary-rgb), 0.2)' };
  if (normalized.includes('ven')) return { bg: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(244, 63, 94, 0.02) 100%)', text: '#e11d48', border: 'rgba(244, 63, 94, 0.2)' };
  if (normalized.includes('sam')) return { bg: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(14, 165, 233, 0.02) 100%)', text: '#0284c7', border: 'rgba(14, 165, 233, 0.2)' };
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

const StudentScheduleView = () => {
  const { token } = useParams();
  const { showToast } = useToast();
  const [request, setRequest] = useState({ loading: true, data: null, error: '' });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let current = true;
    setRequest({ loading: true, data: null, error: '' });
    if (!token) {
      setRequest({ loading: false, data: null, error: 'Ce lien doit être renouvelé. Demandez un nouveau lien de consultation à votre établissement.' });
      return () => { current = false; };
    }
    getPublicSchedule(token).then(data => {
      if (current) setRequest({ loading: false, data, error: '' });
    }).catch(error => {
      if (current) setRequest({ loading: false, data: null, error: getScheduleShareErrorMessage(error) });
    });
    return () => { current = false; };
  }, [token, refreshVersion]);

  const { diploma = '', filiere = '', annee = '', academicYear = '', semester = '', schedules: filteredSchedules = [] } = request.data || {};
  const groupLabel = useMemo(() => getClassCode(diploma, filiere, annee), [diploma, filiere, annee]);

  const topScrollRef = useRef(null);
  const mainScrollRef = useRef(null);

  const handleTopScroll = () => {
    if (topScrollRef.current && mainScrollRef.current) mainScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
  };
  const handleMainScroll = () => {
    if (topScrollRef.current && mainScrollRef.current) topScrollRef.current.scrollLeft = mainScrollRef.current.scrollLeft;
  };

  const handleDownload = async format => {
    if (exporting || !filteredSchedules.length) return;
    setExporting(true);
    try {
      await exportSchedule({
        format, schedules: filteredSchedules, teachers: [], groupLabel, diploma, filiere,
        annee, academicYear, semester, getModule: session => session.module,
      });
    } catch {
      showToast('Impossible de télécharger l’emploi du temps. Réessayez.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const today = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  if (request.loading || request.error) {
    return (
      <div className="max-w-container section-padding schedule-premium-page schedule-colorful-page" style={{ paddingTop: '40px' }}>
      <PortalBrand />
        <div className="schedule-premium-header">
          <div className="schedule-premium-header-icon"><CalendarDays size={24} /></div>
          <div className="schedule-premium-header-copy">
            <span className="schedule-premium-eyebrow">Consultation Stagiaire</span>
            <h1>Consultation de l’emploi du temps</h1>
            <p>Votre planning hebdomadaire et vos séances de cours.</p>
          </div>
        </div>
        {request.loading ? <p role="status">Chargement de l’emploi du temps…</p> : (
          <div role="alert">
            <p>{request.error}</p>
            {token && <button className="btn-modern secondary" onClick={() => setRefreshVersion(value => value + 1)}>Réessayer</button>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-container section-padding schedule-premium-page schedule-colorful-page" style={{ paddingTop: '40px' }}>
      <PortalBrand />
      <div className="schedule-premium-header">
        <div className="schedule-premium-header-icon">
          <CalendarDays size={24} />
        </div>
        <div className="schedule-premium-header-copy">
          <span className="schedule-premium-eyebrow">Consultation Stagiaire</span>
          <h1>Emploi du Temps - {groupLabel}</h1>
          <p>{filiere} ({annee}) · Consultation en lecture seule</p>
        </div>
        
        <div className="schedule-header-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setRefreshVersion(value => value + 1)} className="btn-modern secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <RefreshCw size={16} style={{ marginRight: '6px' }} /> Actualiser
          </button>
          <button onClick={() => handleDownload('png')} disabled={exporting || !filteredSchedules.length} className="btn-modern secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <ImageIcon size={16} style={{ marginRight: '6px' }} /> Télécharger PNG
          </button>
          <button onClick={() => handleDownload('pdf')} disabled={exporting || !filteredSchedules.length} className="btn-modern secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <Download size={16} style={{ marginRight: '6px' }} /> Télécharger PDF
          </button>
        </div>
      </div>

      <div className="glass-card schedule-premium-filter-card" style={{ padding: '16px 20px', marginBottom: 'var(--space-5)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '999px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#2563eb' }}>Semestre: {semester}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '999px', background: 'var(--primary-ultra-light)', border: '1px solid rgba(var(--primary-rgb), 0.15)' }}>
          <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)' }}>Année: {academicYear}</span>
        </div>
      </div>

      {request.data?.publishedAt && <p style={{ marginBottom: '16px', fontSize: '12px' }}>Version publiée le {new Date(request.data.publishedAt).toLocaleString('fr-FR')}</p>}

      {filteredSchedules.length === 0 && (
        <div style={{ padding: '14px 20px', borderRadius: 'var(--radius-xl)', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#1e40af' }}>
          <CalendarDays size={18} style={{ color: '#2563eb', flexShrink: 0 }} />
          <span>Aucune séance enregistrée pour <strong>{groupLabel}</strong> ({semester}).</span>
        </div>
      )}

      <div className="glass-card schedule-premium-grid-shell" style={{ padding: 0, overflow: 'hidden' }}>
        <div ref={topScrollRef} onScroll={handleTopScroll} className="top-scrollbar-container" style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', height: '6px' }}>
          <div style={{ width: `${90 + HOURS.length * PX_PER_HOUR}px`, height: '1px' }} />
        </div>

        <div ref={mainScrollRef} onScroll={handleMainScroll} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'none' }}>
          <div className="home-schedule-grid-inverted" style={{ width: '100%' }}>
            <div className="home-schedule-header-row">
              <div className="home-schedule-corner-inverted">Jour / Heure</div>
              <div className="home-schedule-hours-row">
                {HOURS.map(hour => {
                  const colors = getHourColors(hour);
                  return (
                    <div key={hour} className="home-schedule-hour-col-header" style={{ width: `${PX_PER_HOUR}px`, flexShrink: 0, background: colors.bg, borderBottom: `2.5px solid ${colors.accent}`, borderRight: `1px solid ${colors.border}` }}>
                      <span style={{ color: colors.text }}>{hour.toString().padStart(2, '0')}:00</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="home-schedule-rows-container" style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '130px', fontWeight: '900', color: 'rgba(var(--primary-rgb), 0.09)', zIndex: 2, pointerEvents: 'none', whiteSpace: 'nowrap', userSelect: 'none', letterSpacing: '0.08em', fontFamily: 'Inter, system-ui, sans-serif' }}>
                {groupLabel}
              </div>
              {DAYS.map(day => {
                const daySessions = filteredSchedules
                  .filter(s => s.day === day)
                  .map(s => { const { start, end } = parseTimeRange(s.time); return { ...s, start, end }; })
                  .sort((a, b) => a.start.localeCompare(b.start));

                const colors = getDayColors(day);
                return (
                  <div key={day} className="home-schedule-day-row" style={{ height: 'auto', minHeight: '112px' }}>
                    <div className="home-schedule-day-label-col" style={{ background: colors.bg, borderRightColor: colors.border, borderLeft: `4px solid ${colors.text}` }}>
                      <span className="home-schedule-day-name" style={{ color: colors.text }}>{day.toUpperCase()}</span>
                    </div>
                    <div className="home-schedule-day-timeline" style={{ width: `${HOURS.length * PX_PER_HOUR}px`, flexShrink: 0, height: 'auto', display: 'grid', gridTemplateColumns: `repeat(${HOURS.length * 60}, minmax(0, 1fr))`, alignItems: 'stretch' }}>
                      {HOURS.map(hour => <div key={hour} className="home-schedule-hour-vertical-line" style={{ left: `${(hour - START_HOUR) * PX_PER_HOUR}px` }} />)}
                      {HOURS.map(hour => <div key={`h-${hour}`} className="home-schedule-half-vertical-line" style={{ left: `${(hour - START_HOUR) * PX_PER_HOUR + PX_PER_HOUR / 2}px` }} />)}

                      {daySessions.map(session => {
                        const left = timeToPixels(session.start);
                        const width = Math.max(timeToPixels(session.end) - left, PX_PER_HOUR * 0.7);
                        const isTP = session.type === 'TP';
                        const displayedModule = session.module;
                        const eventStyles = getDeterministicEventStyles(displayedModule || session.module || '');

                        return (
                          <motion.div
                            key={session.id}
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`home-schedule-event ${isTP ? 'home-schedule-event-tp' : 'home-schedule-event-course'} ${day === today ? 'home-schedule-event-today' : ''}`}
                            style={{ position: 'relative', gridColumn: `${Math.max(1, Math.round(left / (PX_PER_HOUR / 60)) + 1)} / span ${Math.max(1, Math.round(width / (PX_PER_HOUR / 60)))}`, gridRow: 1, margin: '6px 4px', minWidth: 0, height: 'auto', zIndex: 5, ...eventStyles }}
                            whileHover={{ scale: 1.015, zIndex: 10 }}
                          >
                            <div className="home-schedule-event-rail-horizontal" />
                            <div style={{ position: 'absolute', top: '5px', left: '8px', fontSize: '7.5px', fontWeight: '850', padding: '1.5px 4.5px', borderRadius: '4px', backgroundColor: isTP ? 'rgba(var(--primary-rgb), 0.12)' : 'rgba(245, 158, 11, 0.15)', color: 'var(--event-text)', textTransform: 'uppercase', lineHeight: 1.1, border: '1.5px solid currentColor', opacity: 0.9 }}>
                              {session.type || 'Cours'}
                            </div>
                            <div className="home-schedule-event-time">
                              <Clock size={8} /><span>{session.start}–{session.end}</span>
                            </div>
                            <div className="home-schedule-event-title">{displayedModule || 'Module non défini'}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                              {session.room && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%' }}>
                                  <MapPin size={9} style={{ color: 'var(--event-color)', opacity: 0.7, flexShrink: 0 }} />
                                  <span style={{ fontSize: '8.5px', fontWeight: '700', fontFamily: 'Inter, sans-serif', color: 'var(--event-text)', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.room}</span>
                                </div>
                              )}
                              {session.teacherName && (
                                <div className="home-schedule-event-teacher" style={{ width: '100%' }}>
                                  <User size={8} /><span>{session.teacherName}</span>
                                </div>
                              )}
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
    </div>
  );
};

export default StudentScheduleView;
