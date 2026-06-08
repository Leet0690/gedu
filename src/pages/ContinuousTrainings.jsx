import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { jsPDF } from 'jspdf';
import { logoBase64 } from '../utils/logoBase64';
import {
  BookOpen, Plus, Trash2, Edit3, X, Users, CalendarDays, Wallet,
  Search, ChevronDown, Phone, Clock,
  CheckCircle, FileDown, MapPin, GraduationCap,
  Languages, Monitor, Percent, BarChart3, User, List, LayoutGrid,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { cn } from '../lib/cn';

const START_HOUR = 8;
const END_HOUR = 19;
const PX_PER_HOUR = 64;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const totalGridHeight = (END_HOUR - START_HOUR + 1) * PX_PER_HOUR;

const parseTimeRange = (t = '') => {
  const parts = t.split('-');
  if (parts.length < 2) return { start: '08:00', end: '10:00' };
  const fmt = s => { const p = s.replace(/h/gi, ':').trim().split(':'); return `${p[0].padStart(2, '0')}:${(p[1] || '00').padStart(2, '0')}`; };
  return { start: fmt(parts[0]), end: fmt(parts[1]) };
};
const timeToPixels = (t = '08:00') => {
  const [h, m] = t.split(':').map(Number);
  return ((h - START_HOUR) * 60 + (m || 0)) * (PX_PER_HOUR / 60);
};

const TRAINING_TYPES = [
  { value: 'langue', label: 'Langue', icon: Languages, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', borderClass: 'border-blue-200' },
  { value: 'informatique', label: 'Informatique', icon: Monitor, colorClass: 'text-purple-600', bgClass: 'bg-purple-50', borderClass: 'border-purple-200' },
];
const typeConfig = type => TRAINING_TYPES.find(t => t.value === type) || { value: type, label: type || 'Autre', icon: BookOpen, colorClass: 'text-slate-500', bgClass: 'bg-slate-50', borderClass: 'border-slate-200' };

const TABS = [
  { id: 'formations', label: 'Formations', icon: BookOpen },
  { id: 'etudiants', label: 'Étudiants', icon: Users },
  { id: 'planning', label: 'Planning', icon: CalendarDays },
  { id: 'salaires', label: 'Salaires', icon: Wallet },
];

function Label({ children }) {
  return (
    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
      {children}
    </label>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NativeSelect({ className, ...props }) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

function EmptyPlaceholder({ icon: Icon, text, subtext }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Icon className="h-10 w-10 opacity-25 mb-3" />
      <p className="text-sm font-semibold">{text}</p>
      {subtext && <p className="text-xs mt-1 opacity-70">{subtext}</p>}
    </div>
  );
}

function TableHead({ cols }) {
  return (
    <thead>
      <tr className="border-b bg-muted/40">
        {cols.map(h => (
          <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TypeBadge({ cfg }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full', cfg.bgClass, cfg.colorClass)}>
      {cfg.label}
    </span>
  );
}

function ActionBtn({ onClick, title, variant = 'ghost', className, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
        variant === 'ghost' && 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
        variant === 'danger' && 'bg-red-50 text-red-500 hover:bg-red-100',
        variant === 'info' && 'bg-blue-50 text-blue-600 hover:bg-blue-100',
        className,
      )}
    >
      {children}
    </button>
  );
}

function FormationsTab({ trainings, ctStudents, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const filtered = useMemo(() => trainings.filter(t => {
    if (typeFilter && typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (search) { const q = search.toLowerCase(); return t.name?.toLowerCase().includes(q) || t.teacherName?.toLowerCase().includes(q); }
    return true;
  }), [trainings, search, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {TRAINING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            {Array.from(new Set(trainings.map(t => t.type))).filter(t => t && !TRAINING_TYPES.some(tt => tt.value === t)).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={onAdd} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Nouvelle formation
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyPlaceholder icon={BookOpen} text="Aucune formation continue" subtext="Créez votre première formation pour commencer" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(tr => {
            const cfg = typeConfig(tr.type);
            const Icon = cfg.icon;
            const studentCount = ctStudents.filter(s => s.trainingId === tr.id).length;
            const totalPaid = ctStudents.filter(s => s.trainingId === tr.id)
              .reduce((sum, s) => sum + (s.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0), 0);
            return (
              <Card key={tr.id} className="group transition-all duration-200 hover:-translate-y-1 hover:shadow-lg border border-border/60">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', cfg.bgClass, cfg.colorClass)}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">{tr.name}</p>
                        <TypeBadge cfg={cfg} />
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ActionBtn onClick={() => onEdit(tr)} title="Modifier"><Edit3 size={13} /></ActionBtn>
                      <ActionBtn onClick={() => onDelete(tr)} title="Supprimer" variant="danger"><Trash2 size={13} /></ActionBtn>
                    </div>
                  </div>

                  {tr.description && <p className="text-xs text-muted-foreground mb-4 leading-relaxed line-clamp-2">{tr.description}</p>}

                  <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-1.5">
                      <User size={11} className="shrink-0" />
                      <span className="font-semibold truncate">{tr.teacherName || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users size={11} className="shrink-0" />
                      <span className="font-semibold">{studentCount} étudiant{studentCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-semibold col-span-1">
                      {Number(tr.pricePerStudent || 0).toLocaleString()} DH
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Percent size={11} className="shrink-0" />
                      <span className="font-semibold">{tr.teacherPct || 0}% formateur</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/60 flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">Total encaissé</span>
                    <span className="text-base font-black text-green-600">{totalPaid.toLocaleString()} DH</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EtudiantsTab({ trainings, ctStudents, onAddStudent, onEditStudent, onDeleteStudent, onGeneratePDF }) {
  const [trainingFilter, setTrainingFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const filtered = useMemo(() => ctStudents.filter(s => {
    if (trainingFilter && s.trainingId !== trainingFilter) return false;
    if (search) { const q = search.toLowerCase(); return (s.firstName + ' ' + s.lastName).toLowerCase().includes(q) || (s.phone || '').includes(q); }
    return true;
  }), [ctStudents, trainingFilter, search]);
  const getTraining = id => trainings.find(t => t.id === id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un étudiant…" className="pl-9" />
        </div>
        <Select value={trainingFilter || 'all'} onValueChange={v => setTrainingFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Toutes les formations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les formations</SelectItem>
            {trainings.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => onAddStudent(trainingFilter)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Ajouter étudiant
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyPlaceholder icon={Users} text="Aucun étudiant enregistré" />
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
          <table className="w-full text-sm">
            <TableHead cols={['Étudiant', 'Formation', 'Contact', 'Paiements', 'Statut', 'Actions']} />
            <tbody className="divide-y divide-border/40">
              {filtered.map(s => {
                const tr = getTraining(s.trainingId);
                const totalDue = Number(tr?.pricePerStudent || 0);
                const totalPaid = (s.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0);
                const remaining = totalDue - totalPaid;
                const isPaid = totalDue > 0 && remaining <= 0;
                const isPartial = !isPaid && totalPaid > 0;
                const cfg = typeConfig(tr?.type);

                return (
                  <React.Fragment key={s.id}>
                    <tr className={cn('transition-colors hover:bg-muted/30', expandedId === s.id && 'bg-purple-50/40')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-black shrink-0">
                            {(s.firstName?.[0] || '?').toUpperCase()}
                          </div>
                          <span className="font-semibold text-foreground">{s.firstName} {s.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge cfg={cfg} />
                        <span className="ml-1.5 text-xs text-muted-foreground font-medium">{tr?.name || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {s.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone size={11} />{s.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-green-600">{totalPaid.toLocaleString()} DH</span>
                        {totalDue > 0 && <span className="text-xs text-muted-foreground"> / {totalDue.toLocaleString()}</span>}
                        {remaining > 0 && (
                          <div className="text-[10px] font-semibold text-red-500 mt-0.5">
                            Reste : {remaining.toLocaleString()} DH
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full',
                          isPaid && 'bg-green-50 text-green-600',
                          isPartial && 'bg-amber-50 text-amber-600',
                          !isPaid && !isPartial && 'bg-red-50 text-red-500',
                        )}>
                          {isPaid ? '✓ Soldé' : isPartial ? 'Partiel' : 'Non payé'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <ActionBtn onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} title="Paiements">
                            <ChevronDown size={13} className={cn('transition-transform duration-200', expandedId === s.id && 'rotate-180')} />
                          </ActionBtn>
                          <ActionBtn onClick={() => onGeneratePDF(s, tr)} title="Attestation PDF" variant="info"><FileDown size={13} /></ActionBtn>
                          <ActionBtn onClick={() => onEditStudent(s)} title="Modifier"><Edit3 size={13} /></ActionBtn>
                          <ActionBtn onClick={() => onDeleteStudent(s)} title="Supprimer" variant="danger"><Trash2 size={13} /></ActionBtn>
                        </div>
                      </td>
                    </tr>

                    <AnimatePresence>
                      {expandedId === s.id && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 py-4 bg-muted/30 border-b border-border/40">
                                <p className="text-xs font-bold text-foreground mb-3">Historique des paiements</p>
                                {(s.payments || []).length === 0 ? (
                                  <p className="text-xs text-muted-foreground">Aucun paiement enregistré</p>
                                ) : (
                                  <div className="flex flex-col gap-2">
                                    {(s.payments || []).map((p, pi) => (
                                      <div key={pi} className="flex items-center gap-2.5 text-xs">
                                        <CheckCircle size={12} className="text-green-600 shrink-0" />
                                        <span className="font-bold text-green-600 min-w-[80px]">{Number(p.amount).toLocaleString()} DH</span>
                                        <span className="text-muted-foreground">{p.date}</span>
                                        {p.note && <span className="text-muted-foreground italic">{p.note}</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PlanningTab({ sessions, trainings, onAddSession, onDeleteSession }) {
  const [viewMode, setViewMode] = useState('grid');
  const [trainingFilter, setTrainingFilter] = useState('');
  const filtered = useMemo(() => sessions.filter(s => !trainingFilter || s.trainingId === trainingFilter), [sessions, trainingFilter]);
  const activeDays = useMemo(() => DAYS.filter(d => filtered.some(s => s.day === d)), [filtered]);
  const getTraining = id => trainings.find(t => t.id === id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={trainingFilter || 'all'} onValueChange={v => setTrainingFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Toutes les formations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les formations</SelectItem>
            {trainings.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex gap-1 bg-muted rounded-xl p-1">
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
              viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <List size={13} /> Liste
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
              viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid size={13} /> Grille
          </button>
        </div>

        <Button onClick={onAddSession} className="gap-2 ml-auto shrink-0">
          <Plus className="h-4 w-4" /> Ajouter séance
        </Button>
      </div>

      {viewMode === 'list' ? (
        filtered.length === 0 ? (
          <EmptyPlaceholder icon={CalendarDays} text="Aucune séance planifiée" />
        ) : (
          <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
            <table className="w-full text-sm">
              <TableHead cols={['Jour', 'Horaire', 'Formation', 'Formateur', 'Salle', '']} />
              <tbody className="divide-y divide-border/40">
                {filtered.map(s => {
                  const tr = getTraining(s.trainingId);
                  const cfg = typeConfig(tr?.type);
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">{s.day}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Clock size={11} className="text-muted-foreground" />{s.time}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge cfg={cfg} />
                        <span className="ml-1.5 text-xs text-muted-foreground">{tr?.name || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{tr?.teacherName || '—'}</td>
                      <td className="px-4 py-3">
                        {s.room && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin size={11} />{s.room}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ActionBtn onClick={() => onDeleteSession(s)} title="Supprimer" variant="danger">
                          <Trash2 size={13} />
                        </ActionBtn>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-border/60 bg-card p-5 overflow-x-auto">
          {activeDays.length === 0 ? (
            <EmptyPlaceholder icon={CalendarDays} text="Aucune séance à afficher" />
          ) : (
            <div
              className="grid gap-0 min-w-[400px]"
              style={{ gridTemplateColumns: `56px repeat(${activeDays.length}, minmax(140px, 1fr))` }}
            >
              <div />
              {activeDays.map(day => (
                <div key={day} className="px-2 py-2 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b-2 border-border/40">
                  {day.slice(0, 3)}
                </div>
              ))}
              <div className="border-r border-border/40">
                {HOURS.map(h => (
                  <div key={h} className="flex items-start justify-end pr-2 pt-1.5" style={{ height: PX_PER_HOUR }}>
                    <span className="text-[10px] font-bold text-muted-foreground/50">{h}:00</span>
                  </div>
                ))}
              </div>
              {activeDays.map(day => {
                const daySessions = filtered.filter(s => s.day === day);
                return (
                  <div key={day} className="relative border-r border-border/40" style={{ height: totalGridHeight }}>
                    {HOURS.map(h => (
                      <div key={h} className="absolute left-0 right-0 border-t border-border/30" style={{ top: (h - START_HOUR) * PX_PER_HOUR }} />
                    ))}
                    {daySessions.map(s => {
                      const { start, end } = parseTimeRange(s.time);
                      const top = timeToPixels(start);
                      const height = Math.max(timeToPixels(end) - top, PX_PER_HOUR * 0.75);
                      const tr = getTraining(s.trainingId);
                      const cfg = typeConfig(tr?.type);
                      return (
                        <div
                          key={s.id}
                          className={cn('absolute left-1 right-1 rounded-lg px-2 py-1 overflow-hidden border-l-4', cfg.bgClass)}
                          style={{ top, height, borderLeftColor: cfg.colorClass.includes('blue') ? '#2563eb' : cfg.colorClass.includes('purple') ? '#9333ea' : '#64748b' }}
                        >
                          <p className={cn('text-[10px] font-bold truncate m-0', cfg.colorClass)}>{tr?.name}</p>
                          <p className="text-[9px] text-muted-foreground m-0">{s.time}</p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const KPI_CONFIGS = [
  { label: 'Revenu total', key: 'revenue', colorClass: 'text-green-600', bgClass: 'bg-green-50', icon: Wallet },
  { label: 'Total salaires', key: 'salaries', colorClass: 'text-purple-600', bgClass: 'bg-purple-50', icon: User },
  { label: 'Marge nette', key: 'margin', colorClass: 'text-blue-600', bgClass: 'bg-blue-50', icon: BarChart3 },
  { label: 'Formations', key: 'count', colorClass: 'text-amber-500', bgClass: 'bg-amber-50', icon: BookOpen },
];

function SalairesTab({ trainings, ctStudents }) {
  const rows = useMemo(() => trainings.map(tr => {
    const students = ctStudents.filter(s => s.trainingId === tr.id);
    const totalEncaisse = students.reduce((sum, s) => sum + (s.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0), 0);
    const pct = Number(tr.teacherPct || 0);
    const salary = Math.round(totalEncaisse * pct / 100);
    return { tr, students, totalEncaisse, pct, salary, cfg: typeConfig(tr.type) };
  }), [trainings, ctStudents]);

  const totalRevenue = rows.reduce((a, r) => a + r.totalEncaisse, 0);
  const totalSalaries = rows.reduce((a, r) => a + r.salary, 0);
  const kpiValues = { revenue: totalRevenue.toLocaleString() + ' DH', salaries: totalSalaries.toLocaleString() + ' DH', margin: (totalRevenue - totalSalaries).toLocaleString() + ' DH', count: trainings.length };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPI_CONFIGS.map(k => (
          <Card key={k.label} className="border border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', k.bgClass, k.colorClass)}>
                  <k.icon size={15} />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">{k.label}</span>
              </div>
              <p className={cn('text-xl font-black', k.colorClass)}>{kpiValues[k.key]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyPlaceholder icon={Wallet} text="Aucune formation" />
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
          <table className="w-full text-sm">
            <TableHead cols={['Formation', 'Formateur', 'Étudiants', 'Total encaissé', '% Formateur', 'Salaire', 'Marge']} />
            <tbody className="divide-y divide-border/40">
              {rows.map(({ tr, students, totalEncaisse, pct, salary, cfg }) => {
                const marge = totalEncaisse - salary;
                return (
                  <tr key={tr.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', cfg.bgClass, cfg.colorClass)}>
                          <cfg.icon size={13} />
                        </div>
                        <span className="font-semibold text-foreground">{tr.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{tr.teacherName || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{students.length}</td>
                    <td className="px-4 py-3 font-bold text-green-600">{totalEncaisse.toLocaleString()} DH</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', cfg.bgClass, cfg.colorClass)}>{pct}%</span>
                    </td>
                    <td className="px-4 py-3 text-base font-black text-purple-600">{salary.toLocaleString()} DH</td>
                    <td className={cn('px-4 py-3 font-bold', marge >= 0 ? 'text-green-600' : 'text-red-500')}>{marge.toLocaleString()} DH</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-border bg-muted/30 font-bold">
                <td colSpan={3} className="px-4 py-3 text-sm">Total</td>
                <td className="px-4 py-3 text-base font-black text-green-600">{totalRevenue.toLocaleString()} DH</td>
                <td />
                <td className="px-4 py-3 text-base font-black text-purple-600">{totalSalaries.toLocaleString()} DH</td>
                <td className={cn('px-4 py-3 text-base font-black', (totalRevenue - totalSalaries) >= 0 ? 'text-green-600' : 'text-red-500')}>
                  {(totalRevenue - totalSalaries).toLocaleString()} DH
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ContinuousTrainings() {
  const navigate = useNavigate();
  const {
    teachers = [], confirmAction,
    continuousTrainings = [], addContinuousTraining, updateContinuousTraining, deleteContinuousTraining,
    ctStudents = [], addCtStudent, updateCtStudent, deleteCtStudent,
    ctSessions = [], addCtSession, deleteCtSession,
  } = useApp();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('formations');

  const [trainingModal, setTrainingModal] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const emptyT = { name: '', type: 'langue', description: '', teacherId: '', pricePerStudent: '', teacherPct: '' };
  const [tForm, setTForm] = useState(emptyT);
  const openAddTraining = () => { setEditingTraining(null); setTForm(emptyT); setTrainingModal(true); };
  const openEditTraining = tr => { setEditingTraining(tr); setTForm({ name: tr.name || '', type: tr.type || 'langue', description: tr.description || '', teacherId: tr.teacherId || '', pricePerStudent: tr.pricePerStudent || '', teacherPct: tr.teacherPct || '' }); setTrainingModal(true); };
  const saveTraining = async () => {
    if (!tForm.name.trim()) { showToast('Nom requis', 'error'); return; }
    const teacher = teachers.find(t => t.id === tForm.teacherId);
    const data = { ...tForm, teacherName: teacher?.name || '', pricePerStudent: Number(tForm.pricePerStudent) || 0, teacherPct: Number(tForm.teacherPct) || 0 };
    if (editingTraining) { await updateContinuousTraining(editingTraining.id, data); showToast('Formation mise à jour', 'success'); }
    else { await addContinuousTraining(data); showToast('Formation créée', 'success'); }
    setTrainingModal(false);
  };
  const handleDeleteTraining = async tr => {
    if (await confirmAction({ title: 'Supprimer', message: 'Supprimer cette formation ?', type: 'danger' })) {
      await deleteContinuousTraining(tr.id);
      showToast('Formation supprimée', 'warning');
    }
  };

  const [studentModal, setStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const emptyS = { firstName: '', lastName: '', phone: '', trainingId: '', payments: [] };
  const [sForm, setSForm] = useState(emptyS);
  const today = new Date().toISOString().split('T')[0];
  const [newPayment, setNewPayment] = useState({ amount: '', date: today });
  const openAddStudent = (preId = '') => { setEditingStudent(null); setSForm({ ...emptyS, trainingId: preId }); setNewPayment({ amount: '', date: today }); setStudentModal(true); };
  const openEditStudent = s => { setEditingStudent(s); setSForm({ ...s }); setNewPayment({ amount: '', date: today }); setStudentModal(true); };
  const addPaymentEntry = () => {
    if (!sForm.trainingId) { showToast("Sélectionnez une formation d'abord", 'error'); return; }
    if (!newPayment.amount || isNaN(Number(newPayment.amount))) { showToast('Montant invalide', 'error'); return; }
    const tr = continuousTrainings.find(t => t.id === sForm.trainingId);
    const totalDue = Number(tr?.pricePerStudent || 0);
    const currentPaid = (sForm.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0);
    const newAmount = Number(newPayment.amount);
    if (currentPaid + newAmount > totalDue) { showToast(`Le total dépasse le prix de la formation (${totalDue} DH)`, 'error'); return; }
    setSForm(prev => ({ ...prev, payments: [...(prev.payments || []), { ...newPayment, amount: newAmount }] }));
    setNewPayment({ amount: '', date: today });
  };
  const removePaymentEntry = idx => setSForm(prev => ({ ...prev, payments: prev.payments.filter((_, i) => i !== idx) }));
  const saveStudent = async () => {
    if (!sForm.firstName.trim() || !sForm.lastName.trim()) { showToast('Nom et prénom requis', 'error'); return; }
    if (!sForm.trainingId) { showToast('Sélectionnez une formation', 'error'); return; }
    let finalSForm = { ...sForm };
    if (newPayment.amount && !isNaN(Number(newPayment.amount))) {
      const tr = continuousTrainings.find(t => t.id === sForm.trainingId);
      const totalDue = Number(tr?.pricePerStudent || 0);
      const currentPaid = (finalSForm.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0);
      const newAmount = Number(newPayment.amount);
      if (currentPaid + newAmount > totalDue) { showToast(`Le paiement dépasse le prix de la formation (${totalDue} DH)`, 'error'); return; }
      finalSForm.payments = [...(finalSForm.payments || []), { ...newPayment, amount: newAmount }];
    }
    if (editingStudent) { await updateCtStudent(editingStudent.id, finalSForm); showToast('Étudiant mis à jour', 'success'); }
    else { await addCtStudent(finalSForm); showToast('Étudiant ajouté', 'success'); }
    setStudentModal(false);
  };
  const handleDeleteStudent = async s => {
    if (await confirmAction({ title: 'Supprimer', message: 'Supprimer cet étudiant ?', type: 'danger' })) {
      await deleteCtStudent(s.id);
      showToast('Étudiant supprimé', 'warning');
    }
  };

  const [sessionModal, setSessionModal] = useState(false);
  const emptySes = { trainingId: '', day: 'Lundi', startTime: '08:00', endTime: '10:00', room: '' };
  const [sesForm, setSesForm] = useState(emptySes);
  const openAddSession = () => { setSesForm({ ...emptySes, trainingId: continuousTrainings[0]?.id || '' }); setSessionModal(true); };
  const saveSession = async () => {
    if (!sesForm.trainingId) { showToast('Sélectionnez une formation', 'error'); return; }
    await addCtSession({ ...sesForm, time: sesForm.startTime + '-' + sesForm.endTime });
    showToast('Séance ajoutée', 'success'); setSessionModal(false);
  };
  const handleDeleteSession = async s => {
    if (await confirmAction({ title: 'Supprimer', message: 'Supprimer cette séance ?', type: 'danger' })) {
      await deleteCtSession(s.id);
      showToast('Séance supprimée', 'warning');
    }
  };

  const generateAttestation = (student, training) => {
    if (!student || !training) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    if (logoBase64) {
      try { doc.addImage(logoBase64, 'PNG', 20, 15, 30, 30); } catch (e) { console.warn(e); }
    }
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('INSTITUT POLYTECHNIQUE DE LA FORMATION PROFESSIONNELLE', 105, 22, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('IPFP — Formation Continue', 105, 28, { align: 'center' });
    doc.setDrawColor(176, 104, 185); doc.setLineWidth(0.8); doc.line(20, 38, 190, 38);
    doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(176, 104, 185);
    doc.text('ATTESTATION DE FORMATION', 105, 60, { align: 'center' });
    doc.setTextColor(0); doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    const lines = ['Nous soussignés, Institut Polytechnique de la Formation Professionnelle,', 'attestons que :', '', student.firstName + ' ' + student.lastName, '', 'a suivi avec succès la formation :', '', '« ' + training.name + ' »', 'Type : ' + typeConfig(training.type).label, training.teacherName ? 'Formateur : ' + training.teacherName : '', '', 'Cette attestation est délivrée pour faire valoir ce que de droit.'].filter(Boolean);
    lines.forEach((line, i) => doc.text(line, 25, 80 + i * 7));
    const y = 80 + lines.length * 7 + 20;
    doc.setFont('helvetica', 'bold'); doc.text('Date de délivrance :', 25, y);
    doc.setFont('helvetica', 'normal'); doc.text(new Date().toLocaleDateString('fr-FR'), 80, y);
    doc.setFont('helvetica', 'bold'); doc.text('Cachet et Signature :', 120, y + 20);
    doc.setDrawColor(200); doc.rect(120, y + 24, 60, 25);
    doc.save('Attestation_' + student.firstName + '_' + student.lastName + '.pdf');
    showToast('Attestation générée', 'success');
  };

  const isCustomType = !TRAINING_TYPES.some(t => t.value === tForm.type) &&
    !Array.from(new Set(continuousTrainings.map(t => t.type))).filter(t => t && !TRAINING_TYPES.some(tt => tt.value === t)).includes(tForm.type);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
          <GraduationCap size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground leading-tight">Formations Continues</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Langues · Informatique — Inscriptions, plannings et salaires</p>
        </div>
      </div>

      <div className="flex gap-1 bg-muted rounded-2xl p-1 w-fit flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
              activeTab === tab.id
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <tab.icon size={15} />{tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {activeTab === 'formations' && <FormationsTab trainings={continuousTrainings} ctStudents={ctStudents} onAdd={openAddTraining} onEdit={openEditTraining} onDelete={handleDeleteTraining} />}
          {activeTab === 'etudiants' && <EtudiantsTab trainings={continuousTrainings} ctStudents={ctStudents} onAddStudent={openAddStudent} onEditStudent={openEditStudent} onDeleteStudent={handleDeleteStudent} onGeneratePDF={generateAttestation} />}
          {activeTab === 'planning' && <PlanningTab sessions={ctSessions} trainings={continuousTrainings} onAddSession={openAddSession} onDeleteSession={handleDeleteSession} />}
          {activeTab === 'salaires' && <SalairesTab trainings={continuousTrainings} ctStudents={ctStudents} />}
        </motion.div>
      </AnimatePresence>

      <Dialog open={trainingModal} onOpenChange={setTrainingModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTraining ? 'Modifier la formation' : 'Nouvelle formation'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Nom">
              <Input value={tForm.name} onChange={e => setTForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Anglais des affaires" />
            </Field>
            <Field label="Type">
              <div className="flex gap-2">
                <NativeSelect
                  className="flex-1"
                  value={isCustomType ? 'custom' : tForm.type}
                  onChange={e => {
                    if (e.target.value === 'custom') setTForm(p => ({ ...p, type: '' }));
                    else setTForm(p => ({ ...p, type: e.target.value }));
                  }}
                >
                  {TRAINING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  {Array.from(new Set(continuousTrainings.map(t => t.type))).filter(t => t && !TRAINING_TYPES.some(tt => tt.value === t)).map(t => <option key={t} value={t}>{t}</option>)}
                  <option value="custom">Nouveau type…</option>
                </NativeSelect>
                {isCustomType && (
                  <Input value={tForm.type} onChange={e => setTForm(p => ({ ...p, type: e.target.value }))} placeholder="Nom du type" className="flex-1" autoFocus />
                )}
              </div>
            </Field>
            <Field label="Description">
              <textarea
                value={tForm.description}
                onChange={e => setTForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
                placeholder="Description courte…"
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
              />
            </Field>
            <Field label="Formateur">
              <NativeSelect
                value={tForm.teacherId}
                onChange={e => {
                  if (e.target.value === 'add_new') navigate('/admin/add-teacher');
                  else setTForm(p => ({ ...p, teacherId: e.target.value }));
                }}
              >
                <option value="">— Choisir un formateur —</option>
                <option value="add_new">+ Ajouter un formateur</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prix / étudiant (DH)">
                <Input type="number" value={tForm.pricePerStudent} onChange={e => setTForm(p => ({ ...p, pricePerStudent: e.target.value }))} placeholder="0" />
              </Field>
              <Field label="% Formateur">
                <Input type="number" value={tForm.teacherPct} onChange={e => setTForm(p => ({ ...p, teacherPct: e.target.value }))} placeholder="0" min="0" max="100" />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTrainingModal(false)}>Annuler</Button>
            <Button onClick={saveTraining}>{editingTraining ? 'Enregistrer' : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={studentModal} onOpenChange={setStudentModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingStudent ? "Modifier l'étudiant" : 'Ajouter un étudiant'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <div className="grid grid-cols-2 gap-x-3">
              <Field label="Prénom">
                <Input value={sForm.firstName} onChange={e => setSForm(p => ({ ...p, firstName: e.target.value }))} placeholder="Prénom" />
              </Field>
              <Field label="Nom">
                <Input value={sForm.lastName} onChange={e => setSForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Nom" />
              </Field>
              <Field label="Téléphone">
                <Input value={sForm.phone} onChange={e => setSForm(p => ({ ...p, phone: e.target.value }))} placeholder="06xxxxxxxx" />
              </Field>
              <Field label="Formation">
                <NativeSelect value={sForm.trainingId} onChange={e => setSForm(p => ({ ...p, trainingId: e.target.value }))}>
                  <option value="">— Choisir —</option>
                  {continuousTrainings.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </NativeSelect>
              </Field>
            </div>

            <div className="border-t border-border/50 pt-4 space-y-3">
              <p className="text-xs font-bold text-foreground">Paiements</p>
              {(sForm.payments || []).length > 0 && (
                <div className="flex flex-col gap-2">
                  {(sForm.payments || []).map((p, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-muted/60 rounded-lg">
                      <CheckCircle size={13} className="text-green-600 shrink-0" />
                      <span className="text-xs font-bold text-green-600 flex-1">{Number(p.amount).toLocaleString()} DH</span>
                      <span className="text-xs text-muted-foreground">{p.date}</span>
                      <button onClick={() => removePaymentEntry(i)} className="text-red-400 hover:text-red-600 transition-colors p-0.5">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <Field label="Montant (DH)">
                  <Input type="number" value={newPayment.amount} onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
                </Field>
                <Field label="Date">
                  <Input type="date" value={newPayment.date} onChange={e => setNewPayment(p => ({ ...p, date: e.target.value }))} />
                </Field>
                <button
                  onClick={addPaymentEntry}
                  className="mb-4 h-10 px-4 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  + Ajouter
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStudentModal(false)}>Annuler</Button>
            <Button onClick={saveStudent}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sessionModal} onOpenChange={setSessionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une séance</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <Field label="Formation">
              <NativeSelect value={sesForm.trainingId} onChange={e => setSesForm(p => ({ ...p, trainingId: e.target.value }))}>
                <option value="">— Choisir —</option>
                {continuousTrainings.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Jour">
              <NativeSelect value={sesForm.day} onChange={e => setSesForm(p => ({ ...p, day: e.target.value }))}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Heure début">
                <Input type="time" value={sesForm.startTime} onChange={e => setSesForm(p => ({ ...p, startTime: e.target.value }))} />
              </Field>
              <Field label="Heure fin">
                <Input type="time" value={sesForm.endTime} onChange={e => setSesForm(p => ({ ...p, endTime: e.target.value }))} />
              </Field>
            </div>
            <Field label="Salle (optionnel)">
              <Input value={sesForm.room} onChange={e => setSesForm(p => ({ ...p, room: e.target.value }))} placeholder="Ex: Salle A1" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSessionModal(false)}>Annuler</Button>
            <Button onClick={saveSession}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
