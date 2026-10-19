import { educationText } from '../utils/education';
import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { FilterSelect } from '../components/ui/FilterSelect';
import {
  getClassCode, getModulesForFiliere,
  getDiplomaForMajor
} from '../data/modules';
import {
  buildSessionPool, detectMergeGroups, generateSchedule,
  validateSchedule, DAYS, DEFAULT_CONFIG
} from '../utils/scheduleGenerator';
import {
  CalendarClock, Wand2, Settings2, Users, Layers, Zap, Save,
  ChevronRight, ChevronLeft, Check, AlertTriangle, Clock,
  User, GraduationCap, BookOpen, Merge, Play, CheckCircle2,
  XCircle, RefreshCw, Trash2, ArrowRight, Info, MapPin
} from 'lucide-react';
import { db } from '../firebase';
import { writeBatch, doc, collection, serverTimestamp } from 'firebase/firestore';
import { getScheduleAcademicYear, INITIAL_OPERATIONAL_ACADEMIC_YEAR } from '../utils/studentStatus';

// ── Helpers ──
const labelStyle = {
  fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em'
};

const getDeterministicColor = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash % 360);
  return {
    bg: `hsla(${hue}, 80%, 96%, 0.95)`,
    border: `hsla(${hue}, 55%, 72%, 0.7)`,
    text: `hsl(${hue}, 55%, 35%)`
  };
};

const STEPS = [
  { label: 'Configuration', icon: Settings2 },
  { label: 'Assignations', icon: Users },
  { label: 'Génération', icon: Zap },
  { label: 'Publication', icon: Save }
];

const ScheduleGeneration = () => {
  const {
    teachers, schedules, modules: moduleCatalog, academicCatalog,
    activeSemester, addSchedule, confirmAction,
    activeAcademicYear, operationalAcademicYear
  } = useApp();
  const { showToast } = useToast();
  const targetAcademicYear = activeAcademicYear || operationalAcademicYear || INITIAL_OPERATIONAL_ACADEMIC_YEAR;

  // ── Wizard State ──
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [semester, setSemester] = useState(activeSemester || 'S1');
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG });
  const [sessionPool, setSessionPool] = useState([]);
  const [mergedPool, setMergedPool] = useState([]);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [previewFilter, setPreviewFilter] = useState('all');
  const [publishMode, setPublishMode] = useState('replace');

  const scopedModuleCatalog = useMemo(() => {
    const scoped = (moduleCatalog || []).filter(m => !m.academicYear || m.academicYear === targetAcademicYear);
    return scoped.length > 0 ? scoped : (moduleCatalog || []);
  }, [moduleCatalog, targetAcademicYear]);

  // ── Compute all possible groups ──
  const allGroups = useMemo(() => {
    const groups = [];
    for (const [diploma, filieres] of Object.entries(academicCatalog?.filieres || {})) {
      const years = academicCatalog?.years?.[diploma] || [];
      for (const filiere of filieres) {
        for (const annee of years) {
          const mods = Array.from(new Set(getModulesForFiliere(diploma, filiere, annee) || []));
          // Aussi checker les modules configurés dans scopedModuleCatalog
          const configuredMods = Array.from(new Set(scopedModuleCatalog.filter(
            m => m.diploma === diploma && m.major === filiere && m.year === annee
          ).map(m => m.name).filter(Boolean)));
          if (mods.length > 0 || configuredMods.length > 0) {
            groups.push({
              diploma,
              filiere,
              annee,
              code: getClassCode(diploma, filiere, annee),
              moduleCount: Math.max(mods.length, configuredMods.length)
            });
          }
        }
      }
    }
    return groups;
  }, [academicCatalog, scopedModuleCatalog]);

  const groupsByDiploma = useMemo(() => {
    const map = {};
    for (const g of allGroups) {
      if (!map[g.diploma]) map[g.diploma] = [];
      map[g.diploma].push(g);
    }
    return map;
  }, [allGroups]);

  // ── Group Selection ──
  const toggleGroup = useCallback((group) => {
    setSelectedGroups(prev => {
      const key = `${group.diploma}|${group.filiere}|${group.annee}`;
      const exists = prev.some(g => `${g.diploma}|${g.filiere}|${g.annee}` === key);
      if (exists) return prev.filter(g => `${g.diploma}|${g.filiere}|${g.annee}` !== key);
      return [...prev, group];
    });
  }, []);

  const selectAllForDiploma = useCallback((diploma) => {
    const diplomaGroups = allGroups.filter(g => g.diploma === diploma);
    setSelectedGroups(prev => {
      const allSelected = diplomaGroups.every(dg =>
        prev.some(p => p.diploma === dg.diploma && p.filiere === dg.filiere && p.annee === dg.annee)
      );
      if (allSelected) {
        return prev.filter(p => p.diploma !== diploma);
      }
      const others = prev.filter(p => p.diploma !== diploma);
      return [...others, ...diplomaGroups];
    });
  }, [allGroups]);

  const isGroupSelected = useCallback((group) => {
    return selectedGroups.some(
      g => g.diploma === group.diploma && g.filiere === group.filiere && g.annee === group.annee
    );
  }, [selectedGroups]);

  // ── Day config toggles ──
  const toggleDay = useCallback((day) => {
    setConfig(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  }, []);

  // ── Step 2: Build session pool ──
  const buildPool = useCallback(() => {
    if (selectedGroups.length === 0) {
      showToast('Veuillez sélectionner au moins un groupe.', 'warning');
      return;
    }
    const pool = buildSessionPool(selectedGroups, semester, teachers, scopedModuleCatalog, getModulesForFiliere, config.slotMinutes);
    setSessionPool(pool);
    const merged = detectMergeGroups(pool);
    setMergedPool(merged);
    setCurrentStep(1);
  }, [selectedGroups, semester, teachers, scopedModuleCatalog, getModulesForFiliere, config.slotMinutes, showToast]);

  const updateSessionDuration = useCallback((index, newDuration) => {
    setMergedPool(prev => {
      const clone = [...prev];
      clone[index] = { ...clone[index], duration: newDuration };
      return clone;
    });
  }, []);

  // ── Step 3: Generate schedule ──
  const runGeneration = useCallback(() => {
    if (mergedPool.length === 0) {
      showToast('Aucune séance à planifier.', 'warning');
      return;
    }
    setIsGenerating(true);
    // Utiliser setTimeout pour permettre à l'UI de se mettre à jour
    setTimeout(() => {
      try {
        const result = generateSchedule(mergedPool, config);
        setGeneratedResult(result);
        if (result.unplanned.length > 0) {
          showToast(`${result.scheduled.length} séances planifiées, ${result.unplanned.length} non placées.`, 'warning');
        } else {
          showToast(`${result.scheduled.length} séances générées avec succès !`, 'success');
        }
      } catch (err) {
        console.error('Generation error:', err);
        showToast('Erreur lors de la génération.', 'error');
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  }, [mergedPool, config, showToast]);

  // ── Step 4: Publish ──
  const { hasPermission } = useAdminAuth();
  const handlePublish = useCallback(async () => {
    if (!hasPermission('schedule_generation', 'edit') || !hasPermission('schedules', 'edit')) { showToast('Droits de modification requis pour la génération et les emplois du temps.', 'error'); return; }
    if (!generatedResult || generatedResult.scheduled.length === 0) return;

    const confirmed = await confirmAction({
      title: publishMode === 'replace' ? 'Remplacer l\'emploi du temps ?' : 'Ajouter les séances ?',
      message: publishMode === 'replace'
        ? `${generatedResult.scheduled.length} séances seront publiées. L'emploi du temps existant pour les groupes sélectionnés sera supprimé.`
        : `${generatedResult.scheduled.length} séances seront ajoutées à l'emploi du temps existant.`,
      type: publishMode === 'replace' ? 'danger' : 'warning',
      confirmText: 'Publier'
    });

    if (!confirmed) return;

    setIsPublishing(true);
    try {
      // Si mode remplacer, supprimer les séances existantes pour ces groupes
      if (publishMode === 'replace') {
        const groupKeys = new Set(selectedGroups.map(g => `${g.diploma}|${g.filiere}|${g.annee}`));
        const toDelete = schedules.filter(s => {
          const d = s.diploma || getDiplomaForMajor(s.filiere);
          const matchYear = getScheduleAcademicYear(s, INITIAL_OPERATIONAL_ACADEMIC_YEAR) === targetAcademicYear;
          return matchYear && groupKeys.has(`${d}|${s.filiere}|${s.annee}`);
        });

        if (toDelete.length > 0) {
          for (let i = 0; i < toDelete.length; i += 450) {
            const batch = writeBatch(db);
            toDelete.slice(i, i + 450).forEach(s => {
              batch.delete(doc(db, 'schedules', s.id));
            });
            await batch.commit();
          }
        }
      }

      // Écrire les nouvelles séances par batch
      const entries = generatedResult.scheduled;
      for (let i = 0; i < entries.length; i += 450) {
        const batch = writeBatch(db);
        entries.slice(i, i + 450).forEach(entry => {
          const ref = doc(collection(db, 'schedules'));
          batch.set(ref, {
            day: entry.day,
            time: entry.time,
            module: entry.module || entry.moduleS1 || '',
            moduleS1: entry.moduleS1 || entry.module || '',
            moduleS2: entry.moduleS2 || '',
            teacherId: entry.teacherId,
            diploma: entry.diploma,
            filiere: entry.filiere,
            annee: entry.annee,
            room: entry.room || '',
            type: entry.type || 'Cours',
            academicYear: targetAcademicYear,
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
      }

      showToast(`${entries.length} séances publiées avec succès !`, 'success');

      // Recharger la page après succès
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error('Publish error:', err);
      showToast('Erreur lors de la publication.', 'error');
    } finally {
      setIsPublishing(false);
    }
  }, [generatedResult, publishMode, selectedGroups, schedules, confirmAction, showToast, hasPermission, targetAcademicYear]);

  // ── Preview data ──
  const previewByDay = useMemo(() => {
    if (!generatedResult) return {};
    let entries = generatedResult.scheduled;

    if (previewFilter !== 'all') {
      if (previewFilter.startsWith('teacher:')) {
        const tid = previewFilter.replace('teacher:', '');
        entries = entries.filter(e => e.teacherId === tid);
      } else if (previewFilter.startsWith('group:')) {
        const gkey = previewFilter.replace('group:', '');
        entries = entries.filter(e => `${e.diploma}|${e.filiere}|${e.annee}` === gkey);
      }
    }

    const byDay = {};
    for (const day of config.days) {
      byDay[day] = entries
        .filter(e => e.day === day)
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    }
    return byDay;
  }, [generatedResult, previewFilter, config.days]);

  const previewFilterOptions = useMemo(() => {
    const opts = [{ label: 'Tous', value: 'all' }];
    // Groupes
    for (const g of selectedGroups) {
      opts.push({
        label: `📚 ${g.code}`,
        value: `group:${g.diploma}|${g.filiere}|${g.annee}`
      });
    }
    // Formateurs
    const teacherIds = new Set();
    if (generatedResult) {
      for (const e of generatedResult.scheduled) {
        if (e.teacherId && !teacherIds.has(e.teacherId)) {
          teacherIds.add(e.teacherId);
          const t = teachers.find(t => t.id === e.teacherId);
          if (t) opts.push({ label: `👤 ${t.name}`, value: `teacher:${e.teacherId}` });
        }
      }
    }
    return opts;
  }, [selectedGroups, generatedResult, teachers]);

  // ── Validation stats ──
  const validationResult = useMemo(() => {
    if (!generatedResult) return null;
    return validateSchedule(generatedResult.scheduled);
  }, [generatedResult]);

  // ── Navigation ──
  const canGoNext = () => {
    if (currentStep === 0) return selectedGroups.length > 0;
    if (currentStep === 1) return mergedPool.length > 0;
    if (currentStep === 2) return generatedResult && generatedResult.scheduled.length > 0;
    return false;
  };

  const goNext = () => {
    if (currentStep === 0) {
      buildPool();
      return;
    }
    if (currentStep === 1) {
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2) {
      setCurrentStep(3);
      return;
    }
  };

  const goBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  // Mode "En cours de construction" actif
  const isUnderConstruction = true;
  if (isUnderConstruction) {
    return (
      <div className="max-w-container section-padding" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-ultra-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <Wand2 size={40} style={{ color: 'var(--primary)' }} />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '12px' }}>
          Génération Automatique
        </h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', lineHeight: '1.6' }}>{educationText("Ce module est en cours de développement. Il permettra bientôt de générer et répartir les emplois du temps automatiquement en détectant les cours communs et les conflits.")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-container section-padding">
      {/* ── Header ── */}
      <div className="schedule-premium-header">
        <div className="schedule-premium-header-icon">
          <Wand2 size={24} />
        </div>
        <div className="schedule-premium-header-copy">
          <span className="schedule-premium-eyebrow">{educationText("Module automatisé")}</span>
          <h1>Génération des Emplois du Temps</h1>
          <p>Créez et répartissez les emplois du temps automatiquement.</p>
        </div>
        <div className="schedule-premium-header-orb" aria-hidden="true">
          <CalendarClock size={112} />
        </div>
      </div>

      {/* ── Stepper ── */}
      <div className="sched-gen-stepper">
        {STEPS.map((step, idx) => (
          <React.Fragment key={idx}>
            <div
              className={`sched-gen-step-item ${idx === currentStep ? 'active' : ''} ${idx < currentStep ? 'completed' : ''}`}
              onClick={() => { if (idx < currentStep) setCurrentStep(idx); }}
            >
              <div className="sched-gen-step-num">
                {idx < currentStep ? <Check size={14} /> : <step.icon size={14} />}
              </div>
              <span className="sched-gen-step-label">{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`sched-gen-step-connector ${idx < currentStep ? 'filled' : ''}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Step Content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          {/* ═══ STEP 0: CONFIGURATION ═══ */}
          {currentStep === 0 && (
            <div className="glass-card form-card" style={{ padding: '28px' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: '900', color: 'var(--text-primary)', marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Settings2 size={20} style={{ color: 'var(--primary)' }} />
                Configuration
              </h2>

              {/* Semestre + Config */}
              <div className="sched-gen-config-grid" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="sched-gen-config-field">
                  <label>Semestre</label>
                  <div className="sched-gen-toggle-group">
                    {['S1', 'S2'].map(s => (
                      <button key={s} type="button"
                        className={`sched-gen-toggle-item ${semester === s ? 'active' : ''}`}
                        onClick={() => setSemester(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sched-gen-config-field">
                  <label>Durée des séances</label>
                  <div className="sched-gen-toggle-group">
                    {[{ label: '1h30', val: 90 }, { label: '2h', val: 120 }].map(d => (
                      <button key={d.val} type="button"
                        className={`sched-gen-toggle-item ${config.slotMinutes === d.val ? 'active' : ''}`}
                        onClick={() => setConfig(prev => ({ ...prev, slotMinutes: d.val }))}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sched-gen-config-field">
                  <label>Heure début</label>
                  <input
                    type="time" className="input-premium"
                    value={`${String(config.startHour).padStart(2, '0')}:00`}
                    onChange={e => setConfig(prev => ({ ...prev, startHour: parseInt(e.target.value.split(':')[0]) || 8 }))}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
                <div className="sched-gen-config-field">
                  <label>Heure fin</label>
                  <input
                    type="time" className="input-premium"
                    value={`${String(config.endHour).padStart(2, '0')}:00`}
                    onChange={e => setConfig(prev => ({ ...prev, endHour: parseInt(e.target.value.split(':')[0]) || 20 }))}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              </div>

              {/* Jours actifs */}
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <label style={labelStyle}>Jours actifs</label>
                <div className="sched-gen-toggle-group" style={{ marginTop: '8px' }}>
                  {DAYS.map(day => (
                    <button key={day} type="button"
                      className={`sched-gen-toggle-item ${config.days.includes(day) ? 'active' : ''}`}
                      onClick={() => toggleDay(day)}
                    >
                      {day.substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sélection des groupes */}
              <div>
                <label style={{ ...labelStyle, marginBottom: '12px', display: 'block' }}>
                  Groupes à planifier ({selectedGroups.length} sélectionné{selectedGroups.length > 1 ? 's' : ''})
                </label>

                {Object.entries(groupsByDiploma).map(([diploma, groups]) => (
                  <div key={diploma} className="sched-gen-diploma-section">
                    <div className="sched-gen-diploma-title">
                      <GraduationCap size={16} style={{ color: 'var(--primary)' }} />
                      {diploma}
                      <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: '700', color: 'var(--primary)', cursor: 'pointer' }}
                        onClick={() => selectAllForDiploma(diploma)}>
                        {groups.every(g => isGroupSelected(g)) ? 'Tout désélectionner' : 'Tout sélectionner'}
                      </span>
                    </div>
                    <div className="sched-gen-groups-grid">
                      {groups.map(group => (
                        <div
                          key={`${group.diploma}-${group.filiere}-${group.annee}`}
                          className={`sched-gen-group-card ${isGroupSelected(group) ? 'selected' : ''}`}
                          onClick={() => toggleGroup(group)}
                        >
                          <div className="group-check">
                            {isGroupSelected(group) && <Check size={12} />}
                          </div>
                          <div className="group-code">{group.code}</div>
                          <div className="group-filiere">{group.filiere}</div>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-faint)', marginTop: '4px' }}>
                            {group.annee} · {group.moduleCount}{educationText(" modules")}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="sched-gen-actions">
                <div />
                <button
                  className="sched-gen-btn-generate"
                  onClick={goNext}
                  disabled={!canGoNext()}
                >
                  Continuer <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 1: ASSIGNATIONS ═══ */}
          {currentStep === 1 && (
            <div className="glass-card form-card" style={{ padding: '28px' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={20} style={{ color: 'var(--primary)' }} />
                Assignations & Fusions
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: 'var(--space-5)' }}>
                {sessionPool.length} séances individuelles → {mergedPool.length} séances après fusion automatique
              </p>

              {/* Stats résumé */}
              <div className="sched-gen-stats-grid" style={{ marginBottom: 'var(--space-5)' }}>
                <div className="sched-gen-stat-card">
                  <div className="sched-gen-stat-value">{selectedGroups.length}</div>
                  <div className="sched-gen-stat-label">Groupes</div>
                </div>
                <div className="sched-gen-stat-card">
                  <div className="sched-gen-stat-value">{sessionPool.length}</div>
                  <div className="sched-gen-stat-label">Séances totales</div>
                </div>
                <div className="sched-gen-stat-card">
                  <div className="sched-gen-stat-value" style={{ color: 'var(--secondary)' }}>
                    {sessionPool.length - mergedPool.length}
                  </div>
                  <div className="sched-gen-stat-label">Fusions détectées</div>
                </div>
                <div className="sched-gen-stat-card">
                  <div className="sched-gen-stat-value" style={{ color: 'var(--success)' }}>
                    {mergedPool.length}
                  </div>
                  <div className="sched-gen-stat-label">Séances à planifier</div>
                </div>
              </div>

              {/* Cours communs détectés */}
              {mergedPool.some(s => s.mergedGroups && s.mergedGroups.length > 1) && (
                <div className="sched-gen-alert-panel success" style={{ marginBottom: 'var(--space-5)' }}>
                  <div className="alert-title">
                    <Merge size={16} /> Cours communs détectés automatiquement
                  </div>
                  <div className="alert-items">
                    {mergedPool.filter(s => s.mergedGroups && s.mergedGroups.length > 1).map((s, i) => {
                      const t = teachers.find(t => t.id === s.teacherId);
                      return (
                        <div key={i} className="alert-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '800', color: 'var(--text-primary)' }}>{s.module}</span>
                          <span style={{ color: 'var(--text-muted)' }}>·</span>
                          <span>{t?.name || s.teacherId}</span>
                          <span className="sched-gen-merge-badge">
                            <Merge size={10} /> {s.mergedGroups.length} groupes fusionnés
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tableau des assignations */}
              <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-xl)' }}>
                <table className="sched-gen-assign-table">
                  <thead>
                    <tr>
                      <th>{educationText("Module")}</th>
                      <th>Groupe(s)</th>
                      <th>{educationText("Formateur")}</th>
                      <th>Durée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedPool.map((session, i) => {
                      const t = teachers.find(t => t.id === session.teacherId);
                      const isMerged = session.mergedGroups && session.mergedGroups.length > 1;
                      return (
                        <tr key={i}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <BookOpen size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                              <span style={{ fontWeight: '700' }}>{session.module}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {(isMerged ? session.mergedGroups : [session.groupKey]).map((gk, j) => {
                                const parts = gk.split('|');
                                const code = getClassCode(parts[0], parts[1], parts[2]);
                                return (
                                  <span key={j} style={{
                                    padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                                    background: 'var(--primary-ultra-light)', color: 'var(--primary)',
                                    fontSize: '10px', fontWeight: '800'
                                  }}>
                                    {code}
                                  </span>
                                );
                              })}
                              {isMerged && <span className="sched-gen-merge-badge"><Merge size={9} /> Fusionné</span>}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <User size={12} style={{ color: 'var(--text-muted)' }} />
                              {t ? t.name : <span style={{ color: 'var(--danger)', fontStyle: 'italic' }}>Non assigné</span>}
                            </div>
                          </td>
                          <td style={{ fontSize: '11px', fontWeight: '700' }}>
                            <select
                              className="input-premium"
                              style={{ padding: '4px 8px', fontSize: '11px', width: '80px' }}
                              value={session.duration}
                              onChange={(e) => updateSessionDuration(i, parseInt(e.target.value))}
                            >
                              <option value={60}>1h00</option>
                              <option value={90}>1h30</option>
                              <option value={120}>2h00</option>
                              <option value={150}>2h30</option>
                              <option value={180}>3h00</option>
                              <option value={240}>4h00</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="sched-gen-actions">
                <button className="btn-modern" onClick={goBack}>
                  <ChevronLeft size={16} /> Retour
                </button>
                <button className="sched-gen-btn-generate" onClick={goNext}>
                  Continuer <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 2: GENERATION & PREVIEW ═══ */}
          {currentStep === 2 && (
            <div className="glass-card form-card" style={{ padding: '28px' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Zap size={20} style={{ color: 'var(--primary)' }} />
                Génération & Aperçu
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: 'var(--space-5)' }}>
                {mergedPool.length} séances à planifier sur {config.days.length} jours
              </p>

              {/* Bouton Générer */}
              {!generatedResult && (
                <div style={{ textAlign: 'center', padding: 'var(--space-10) 0' }}>
                  <div style={{
                    width: '80px', height: '80px', borderRadius: '50%',
                    background: 'var(--primary-ultra-light)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-5)'
                  }}>
                    <Wand2 size={36} style={{ color: 'var(--primary)' }} />
                  </div>
                  <button
                    className="sched-gen-btn-generate"
                    onClick={runGeneration}
                    disabled={isGenerating}
                    style={{ margin: '0 auto' }}
                  >
                    {isGenerating ? (
                      <><RefreshCw size={18} className="animate-spin" /> Génération en cours...</>
                    ) : (
                      <><Play size={18} /> Lancer la génération automatique</>
                    )}
                  </button>
                </div>
              )}

              {/* Résultat */}
              {generatedResult && (
                <>
                  {/* Stats */}
                  <div className="sched-gen-stats-grid" style={{ marginBottom: 'var(--space-5)' }}>
                    <div className="sched-gen-stat-card">
                      <div className="sched-gen-stat-value" style={{ color: 'var(--success)' }}>
                        {generatedResult.scheduled.length}
                      </div>
                      <div className="sched-gen-stat-label">Séances placées</div>
                    </div>
                    <div className="sched-gen-stat-card">
                      <div className="sched-gen-stat-value" style={{ color: generatedResult.unplanned.length > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {generatedResult.unplanned.length}
                      </div>
                      <div className="sched-gen-stat-label">Non placées</div>
                    </div>
                    <div className="sched-gen-stat-card">
                      <div className="sched-gen-stat-value">{generatedResult.stats?.mergedSessions || 0}</div>
                      <div className="sched-gen-stat-label">Cours communs</div>
                    </div>
                    <div className="sched-gen-stat-card">
                      <div className="sched-gen-stat-value">
                        {Object.keys(generatedResult.stats?.hoursByTeacher || {}).length}
                      </div>
                      <div className="sched-gen-stat-label">{educationText("Formateurs")}</div>
                    </div>
                  </div>

                  {/* Validation */}
                  {validationResult && (
                    <>
                      {validationResult.teacherConflicts.length === 0 && validationResult.groupConflicts.length === 0 ? (
                        <div className="sched-gen-alert-panel success">
                          <div className="alert-title"><CheckCircle2 size={16} /> Aucun conflit détecté</div>
                        </div>
                      ) : (
                        <div className="sched-gen-alert-panel danger">
                          <div className="alert-title"><XCircle size={16} /> Conflits détectés</div>
                          <div className="alert-items">
                            {validationResult.teacherConflicts.map((c, i) => (
                              <div key={`t${i}`} className="alert-item">{educationText("⚠️ Formateur «")}{c.teacher}» double-booké le {c.day} ({c.time1} & {c.time2})
                              </div>
                            ))}
                            {validationResult.groupConflicts.map((c, i) => (
                              <div key={`g${i}`} className="alert-item">
                                ⚠️ Groupe «{c.group}» double-booké le {c.day} ({c.time1} & {c.time2})
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Unplanned */}
                  {generatedResult.unplanned.length > 0 && (
                    <div className="sched-gen-alert-panel warning" style={{ marginTop: 'var(--space-4)' }}>
                      <div className="alert-title"><AlertTriangle size={16} /> Séances non planifiées</div>
                      <div className="alert-items">
                        {generatedResult.unplanned.map((s, i) => (
                          <div key={i} className="alert-item">
                            {s.module} — {teachers.find(t => t.id === s.teacherId)?.name || 'Inconnu'}
                            {s.mergedGroups ? ` (${s.mergedGroups.length} groupes)` : ` (${s.groupKey})`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Filter toolbar */}
                  <div className="sched-gen-preview-toolbar" style={{ marginTop: 'var(--space-5)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0' }}>
                    <div className="sched-gen-preview-filter-group">
                      <label>Filtrer par</label>
                      <FilterSelect
                        value={previewFilter}
                        onChange={setPreviewFilter}
                        options={previewFilterOptions}
                      />
                    </div>
                    <button
                      className="btn-modern"
                      onClick={() => { setGeneratedResult(null); runGeneration(); }}
                      style={{ marginLeft: 'auto', fontSize: '12px', padding: '6px 14px' }}
                    >
                      <RefreshCw size={13} /> Regénérer
                    </button>
                  </div>

                  {/* Preview Grid */}
                  <div className="sched-gen-mini-grid" style={{ borderRadius: '0 0 var(--radius-xl) var(--radius-xl)', borderTop: 'none' }}>
                    {config.days.map(day => (
                      <React.Fragment key={day}>
                        <div className="sched-gen-mini-grid-day">{day.substring(0, 3)}</div>
                        <div className="sched-gen-mini-grid-slots">
                          {(previewByDay[day] || []).length === 0 ? (
                            <span className="sched-gen-empty-day">Libre</span>
                          ) : (
                            (previewByDay[day] || []).map((entry, i) => {
                              const colors = getDeterministicColor(entry.module || '');
                              const t = teachers.find(t => t.id === entry.teacherId);
                              return (
                                <div
                                  key={i}
                                  className="sched-gen-slot-chip"
                                  style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
                                  title={`${entry.module}\n${entry.time}\n${t?.name || ''}\n${getClassCode(entry.diploma, entry.filiere, entry.annee)}`}
                                >
                                  <Clock size={9} />
                                  <span>{entry.time?.split('-')[0]}</span>
                                  <span style={{ fontWeight: '800' }}>
                                    {entry.module?.length > 18 ? entry.module.substring(0, 16) + '…' : entry.module}
                                  </span>
                                  <span style={{ opacity: 0.7, fontSize: '9px' }}>
                                    {getClassCode(entry.diploma, entry.filiere, entry.annee)}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="sched-gen-actions">
                <button className="btn-modern" onClick={goBack}>
                  <ChevronLeft size={16} /> Retour
                </button>
                {generatedResult && generatedResult.scheduled.length > 0 && (
                  <button className="sched-gen-btn-generate" onClick={goNext}>
                    Continuer vers Publication <ChevronRight size={18} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ═══ STEP 3: PUBLICATION ═══ */}
          {currentStep === 3 && generatedResult && (
            <div className="glass-card form-card" style={{ padding: '28px' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Save size={20} style={{ color: 'var(--success)' }} />
                Publication de l'emploi du temps
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: 'var(--space-5)' }}>
                {generatedResult.scheduled.length} séances prêtes à être publiées
              </p>

              {/* Récapitulatif */}
              <div className="sched-gen-stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="sched-gen-stat-card">
                  <div className="sched-gen-stat-value" style={{ color: 'var(--success)' }}>
                    {generatedResult.scheduled.length}
                  </div>
                  <div className="sched-gen-stat-label">Séances à publier</div>
                </div>
                <div className="sched-gen-stat-card">
                  <div className="sched-gen-stat-value">{selectedGroups.length}</div>
                  <div className="sched-gen-stat-label">Groupes concernés</div>
                </div>
                <div className="sched-gen-stat-card">
                  <div className="sched-gen-stat-value">
                    {Object.keys(generatedResult.stats?.hoursByTeacher || {}).length}
                  </div>
                  <div className="sched-gen-stat-label">{educationText("Formateurs")}</div>
                </div>
                <div className="sched-gen-stat-card">
                  <div className="sched-gen-stat-value">{semester}</div>
                  <div className="sched-gen-stat-label">Semestre</div>
                </div>
              </div>

              {/* Heures par groupe */}
              {generatedResult.stats?.hoursByGroup && (
                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <label style={{ ...labelStyle, marginBottom: '12px', display: 'block' }}>Heures par groupe</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {Object.entries(generatedResult.stats.hoursByGroup).map(([gk, hours]) => {
                      const parts = gk.split('|');
                      const code = getClassCode(parts[0], parts[1], parts[2]);
                      return (
                        <div key={gk} style={{
                          padding: '8px 14px', borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-subtle)', border: '1px solid var(--border-light)',
                          display: 'flex', alignItems: 'center', gap: '8px'
                        }}>
                          <span style={{ fontWeight: '800', fontSize: '12px', color: 'var(--primary)' }}>{code}</span>
                          <span style={{ fontWeight: '700', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {(hours / 60).toFixed(1)}h
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mode de publication */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <label style={{ ...labelStyle, marginBottom: '10px', display: 'block' }}>Mode de publication</label>
                <div className="sched-gen-toggle-group">
                  <button type="button"
                    className={`sched-gen-toggle-item ${publishMode === 'replace' ? 'active' : ''}`}
                    onClick={() => setPublishMode('replace')}
                    style={{ padding: '10px 16px' }}
                  >
                    <div style={{ fontWeight: '800', fontSize: '12px' }}>Remplacer</div>
                    <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Supprime l'ancien EDT des groupes sélectionnés
                    </div>
                  </button>
                  <button type="button"
                    className={`sched-gen-toggle-item ${publishMode === 'add' ? 'active' : ''}`}
                    onClick={() => setPublishMode('add')}
                    style={{ padding: '10px 16px' }}
                  >
                    <div style={{ fontWeight: '800', fontSize: '12px' }}>Ajouter</div>
                    <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Conserve les séances existantes
                    </div>
                  </button>
                </div>
              </div>

              {publishMode === 'replace' && (
                <div className="sched-gen-alert-panel warning" style={{ marginBottom: 'var(--space-5)' }}>
                  <div className="alert-title"><AlertTriangle size={16} /> Attention</div>
                  <div className="alert-items">
                    <div className="alert-item">
                      Les séances existantes pour les {selectedGroups.length} groupes sélectionnés seront supprimées et remplacées.
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="sched-gen-actions">
                <button className="btn-modern" onClick={goBack}>
                  <ChevronLeft size={16} /> Retour
                </button>
                <button
                  className="sched-gen-btn-publish"
                  onClick={handlePublish}
                  disabled={isPublishing}
                >
                  {isPublishing ? (
                    <><RefreshCw size={18} className="animate-spin" /> Publication en cours...</>
                  ) : (
                    <><CheckCircle2 size={18} /> Publier l'emploi du temps</>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ScheduleGeneration;
