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
  Save, UserPlus, CalendarPlus, Filter,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
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
  { value: 'langue', label: 'Langue', icon: Languages, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', borderClass: 'border-blue-200', hex: '#2563eb' },
  { value: 'informatique', label: 'Informatique', icon: Monitor, colorClass: 'text-violet-600', bgClass: 'bg-violet-50', borderClass: 'border-violet-200', hex: '#7c3aed' },
];
const typeConfig = type => TRAINING_TYPES.find(t => t.value === type) || { value: type, label: type || 'Autre', icon: BookOpen, colorClass: 'text-slate-500', bgClass: 'bg-slate-50', borderClass: 'border-slate-200', hex: '#64748b' };

const TABS = [
  { id: 'formations', label: 'Formations', icon: BookOpen, color: 'text-violet-600', activeBg: 'bg-violet-50' },
  { id: 'etudiants', label: 'Étudiants', icon: Users, color: 'text-blue-600', activeBg: 'bg-blue-50' },
  { id: 'planning', label: 'Planning', icon: CalendarDays, color: 'text-amber-500', activeBg: 'bg-amber-50' },
  { id: 'salaires', label: 'Salaires', icon: Wallet, color: 'text-green-600', activeBg: 'bg-green-50' },
];

/* ── Reusable primitives ─────────────────────────────────────── */

function Label({ children }) {
  return (
    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
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
        'flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800',
        'focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400',
        'disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        className,
      )}
      {...props}
    />
  );
}

/* Colored action icon buttons */
function ActionBtn({ onClick, title, variant = 'ghost', className, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 active:scale-95',
        variant === 'ghost'    && 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700',
        variant === 'edit'     && 'bg-amber-50 text-amber-500 hover:bg-amber-100 hover:text-amber-600',
        variant === 'danger'   && 'bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600',
        variant === 'info'     && 'bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-700',
        variant === 'success'  && 'bg-green-50 text-green-500 hover:bg-green-100 hover:text-green-700',
        variant === 'expand'   && 'bg-violet-50 text-violet-500 hover:bg-violet-100 hover:text-violet-700',
        className,
      )}
    >
      {children}
    </button>
  );
}

/* Gradient primary CTA buttons */
function PrimaryBtn({ onClick, children, className, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white',
        'bg-gradient-to-r from-violet-500 to-purple-600 shadow-md shadow-violet-200',
        'hover:from-violet-600 hover:to-purple-700 hover:shadow-lg hover:shadow-violet-300',
        'active:scale-[0.97] transition-all duration-150',
        className,
      )}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

/* Outlined cancel button */
function CancelBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-[0.97] transition-all duration-150"
    >
      {children}
    </button>
  );
}

function TypeBadge({ cfg }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border', cfg.bgClass, cfg.colorClass, cfg.borderClass)}>
      <cfg.icon size={10} />
      {cfg.label}
    </span>
  );
}

function EmptyPlaceholder({ icon: Icon, text, subtext, iconClass = 'text-violet-300' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
      <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
        <Icon className={cn('h-8 w-8', iconClass)} />
      </div>
      <p className="text-sm font-semibold text-slate-600">{text}</p>
      {subtext && <p className="text-xs mt-1 text-slate-400">{subtext}</p>}
    </div>
  );
}

function TableHead({ cols }) {
  return (
    <thead>
      <tr className="border-b bg-slate-50/80">
        {cols.map(h => (
          <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/* ── Formations tab ──────────────────────────────────────────── */

function FormationsTab({ trainings, ctStudents, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const filtered = useMemo(() => trainings.filter(t => {
    if (typeFilter && typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (search) { const q = search.toLowerCase(); return t.name?.toLowerCase().includes(q) || t.teacherName?.toLowerCase().includes(q); }
    return true;
  }), [trainings, search, typeFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400 pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" className="pl-9 border-slate-200 focus:border-violet-400" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 border-slate-200">
            <Filter size={13} className="text-slate-400 mr-1" />
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {TRAINING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            {Array.from(new Set(trainings.map(t => t.type))).filter(t => t && !TRAINING_TYPES.some(tt => tt.value === t)).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <PrimaryBtn onClick={onAdd} icon={Plus}>Nouvelle formation</PrimaryBtn>
      </div>

      {filtered.length === 0 ? (
        <EmptyPlaceholder icon={BookOpen} text="Aucune formation continue" subtext="Créez votre première formation pour commencer" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(tr => {
            const cfg = typeConfig(tr.type);
            const trainingStudents = ctStudents.filter(s => s.trainingId === tr.id);
            const studentCount = trainingStudents.length;
            const totalPaid = trainingStudents.reduce((sum, s) => sum + (s.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0), 0);
            const totalDue = Number(tr.pricePerStudent || 0) * studentCount;
            const paidPct = totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0;
            const soldéCount = trainingStudents.filter(s => {
              const paid = (s.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0);
              return Number(tr.pricePerStudent || 0) > 0 && paid >= Number(tr.pricePerStudent || 0);
            }).length;
            const barColor = paidPct === 100 ? 'bg-green-500' : paidPct >= 50 ? 'bg-amber-400' : 'bg-red-400';

            return (
              <Card key={tr.id} className="group transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60 border border-slate-100 bg-white">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm', cfg.bgClass, cfg.colorClass)}>
                        <cfg.icon size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 leading-tight">{tr.name}</p>
                        <div className="mt-1"><TypeBadge cfg={cfg} /></div>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ActionBtn onClick={() => onEdit(tr)} title="Modifier" variant="edit"><Edit3 size={13} /></ActionBtn>
                      <ActionBtn onClick={() => onDelete(tr)} title="Supprimer" variant="danger"><Trash2 size={13} /></ActionBtn>
                    </div>
                  </div>

                  {tr.description && <p className="text-xs text-slate-400 mb-4 leading-relaxed line-clamp-2">{tr.description}</p>}

                  <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs mb-4">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <User size={11} className="text-violet-400 shrink-0" />
                      <span className="font-semibold truncate">{tr.teacherName || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Users size={11} className="text-blue-400 shrink-0" />
                      <span className="font-semibold">{studentCount} étudiant{studentCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
                      <Wallet size={11} className="text-green-400 shrink-0" />
                      {Number(tr.pricePerStudent || 0).toLocaleString()} DH / étudiant
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Percent size={11} className="text-amber-400 shrink-0" />
                      <span className="font-semibold">{tr.teacherPct || 0}% formateur</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Encaissements</span>
                      <div className="flex items-center gap-2">
                        <span className={cn('font-bold', paidPct === 100 ? 'text-green-600' : paidPct >= 50 ? 'text-amber-500' : 'text-red-500')}>
                          {paidPct}%
                        </span>
                        <span className="text-slate-400">{soldéCount}/{studentCount} soldé{soldéCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="relative h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <motion.div
                        className={cn('absolute inset-y-0 left-0 rounded-full', barColor)}
                        initial={{ width: 0 }}
                        animate={{ width: `${paidPct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-green-600">{totalPaid.toLocaleString()} DH</span>
                      {totalDue > 0 && <span className="text-slate-400">{totalDue.toLocaleString()} DH total</span>}
                    </div>
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

/* ── Étudiants tab ───────────────────────────────────────────── */

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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400 pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un étudiant…" className="pl-9 border-slate-200" />
        </div>
        <Select value={trainingFilter || 'all'} onValueChange={v => setTrainingFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-56 border-slate-200">
            <Filter size={13} className="text-slate-400 mr-1" />
            <SelectValue placeholder="Toutes les formations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les formations</SelectItem>
            {trainings.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <PrimaryBtn onClick={() => onAddStudent(trainingFilter)} icon={UserPlus}>Ajouter étudiant</PrimaryBtn>
      </div>

      {filtered.length === 0 ? (
        <EmptyPlaceholder icon={Users} text="Aucun étudiant enregistré" iconClass="text-blue-300" />
      ) : (
        <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm">
            <TableHead cols={['Étudiant', 'Formation', 'Contact', 'Paiements', 'Statut', 'Actions']} />
            <tbody className="divide-y divide-slate-50">
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
                    <tr className={cn('transition-colors hover:bg-slate-50/60', expandedId === s.id && 'bg-violet-50/30')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-sm">
                            {(s.firstName?.[0] || '?').toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-800">{s.firstName} {s.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><TypeBadge cfg={cfg} /></td>
                      <td className="px-4 py-3">
                        {s.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Phone size={11} className="text-blue-400" />{s.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-green-600">{totalPaid.toLocaleString()} DH</span>
                        {totalDue > 0 && <span className="text-xs text-slate-400"> / {totalDue.toLocaleString()}</span>}
                        {remaining > 0 && <div className="text-[10px] font-semibold text-red-400 mt-0.5">Reste : {remaining.toLocaleString()} DH</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border',
                          isPaid    && 'bg-green-50 text-green-600 border-green-200',
                          isPartial && 'bg-amber-50 text-amber-600 border-amber-200',
                          !isPaid && !isPartial && 'bg-red-50 text-red-500 border-red-200',
                        )}>
                          {isPaid ? <CheckCircle size={10} /> : null}
                          {isPaid ? 'Soldé' : isPartial ? 'Partiel' : 'Non payé'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <ActionBtn onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} title="Paiements" variant="expand">
                            <ChevronDown size={13} className={cn('transition-transform duration-200', expandedId === s.id && 'rotate-180')} />
                          </ActionBtn>
                          <ActionBtn onClick={() => onGeneratePDF(s, tr)} title="Attestation PDF" variant="info"><FileDown size={13} /></ActionBtn>
                          <ActionBtn onClick={() => onEditStudent(s)} title="Modifier" variant="edit"><Edit3 size={13} /></ActionBtn>
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
                              <div className="px-6 py-4 bg-violet-50/40 border-b border-slate-100">
                                <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                                  <Wallet size={12} className="text-violet-500" /> Historique des paiements
                                </p>
                                {(s.payments || []).length === 0 ? (
                                  <p className="text-xs text-slate-400">Aucun paiement enregistré</p>
                                ) : (
                                  <div className="flex flex-col gap-2">
                                    {(s.payments || []).map((p, pi) => (
                                      <div key={pi} className="flex items-center gap-2.5 text-xs">
                                        <CheckCircle size={12} className="text-green-500 shrink-0" />
                                        <span className="font-bold text-green-600 min-w-[80px]">{Number(p.amount).toLocaleString()} DH</span>
                                        <span className="text-slate-400 flex items-center gap-1"><CalendarDays size={10} className="text-blue-400" />{p.date}</span>
                                        {p.note && <span className="text-slate-400 italic">{p.note}</span>}
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

/* ── Planning tab ────────────────────────────────────────────── */

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
          <SelectTrigger className="w-56 border-slate-200">
            <Filter size={13} className="text-slate-400 mr-1" />
            <SelectValue placeholder="Toutes les formations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les formations</SelectItem>
            {trainings.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {[
            { mode: 'list', label: 'Liste', Icon: List },
            { mode: 'grid', label: 'Grille', Icon: LayoutGrid },
          ].map(({ mode, label, Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150',
                viewMode === mode
                  ? 'bg-white text-violet-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600',
              )}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <PrimaryBtn onClick={onAddSession} icon={CalendarPlus} className="ml-auto">Ajouter séance</PrimaryBtn>
      </div>

      {viewMode === 'list' ? (
        filtered.length === 0 ? (
          <EmptyPlaceholder icon={CalendarDays} text="Aucune séance planifiée" iconClass="text-amber-300" />
        ) : (
          <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
            <table className="w-full text-sm">
              <TableHead cols={['Jour', 'Horaire', 'Formation', 'Formateur', 'Salle', '']} />
              <tbody className="divide-y divide-slate-50">
                {filtered.map(s => {
                  const tr = getTraining(s.trainingId);
                  const cfg = typeConfig(tr?.type);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">{s.day}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <Clock size={11} className="text-amber-400" />{s.time}
                        </div>
                      </td>
                      <td className="px-4 py-3"><TypeBadge cfg={cfg} /></td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <User size={11} className="text-violet-400" />{tr?.teacherName || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {s.room && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <MapPin size={11} className="text-green-400" />{s.room}
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
        <div className="rounded-2xl border border-slate-100 bg-white p-5 overflow-x-auto shadow-sm">
          {activeDays.length === 0 ? (
            <EmptyPlaceholder icon={CalendarDays} text="Aucune séance à afficher" iconClass="text-amber-300" />
          ) : (
            <div
              className="grid gap-0 min-w-[400px]"
              style={{ gridTemplateColumns: `56px repeat(${activeDays.length}, minmax(140px, 1fr))` }}
            >
              <div />
              {activeDays.map(day => (
                <div key={day} className="px-2 py-2 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b-2 border-slate-100">
                  {day.slice(0, 3)}
                </div>
              ))}
              <div className="border-r border-slate-100">
                {HOURS.map(h => (
                  <div key={h} className="flex items-start justify-end pr-2 pt-1.5" style={{ height: PX_PER_HOUR }}>
                    <span className="text-[10px] font-bold text-slate-300">{h}:00</span>
                  </div>
                ))}
              </div>
              {activeDays.map(day => {
                const daySessions = filtered.filter(s => s.day === day);
                return (
                  <div key={day} className="relative border-r border-slate-100" style={{ height: totalGridHeight }}>
                    {HOURS.map(h => (
                      <div key={h} className="absolute left-0 right-0 border-t border-slate-50" style={{ top: (h - START_HOUR) * PX_PER_HOUR }} />
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
                          className={cn('absolute left-1 right-1 rounded-xl px-2 py-1.5 overflow-hidden border-l-[3px] shadow-sm', cfg.bgClass)}
                          style={{ top, height, borderLeftColor: cfg.hex }}
                        >
                          <p className={cn('text-[10px] font-bold truncate', cfg.colorClass)}>{tr?.name}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">{s.time}</p>
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

/* ── Salaires tab ────────────────────────────────────────────── */

const KPI_CONFIGS = [
  { label: 'Revenu total',  key: 'revenue',  colorClass: 'text-green-600',  bgClass: 'bg-green-50',  borderClass: 'border-green-200',  icon: Wallet },
  { label: 'Total salaires', key: 'salaries', colorClass: 'text-violet-600', bgClass: 'bg-violet-50', borderClass: 'border-violet-200', icon: User },
  { label: 'Marge nette',   key: 'margin',   colorClass: 'text-blue-600',   bgClass: 'bg-blue-50',   borderClass: 'border-blue-200',   icon: BarChart3 },
  { label: 'Formations',    key: 'count',    colorClass: 'text-amber-500',  bgClass: 'bg-amber-50',  borderClass: 'border-amber-200',  icon: BookOpen },
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
  const kpiValues = {
    revenue:  totalRevenue.toLocaleString() + ' DH',
    salaries: totalSalaries.toLocaleString() + ' DH',
    margin:   (totalRevenue - totalSalaries).toLocaleString() + ' DH',
    count:    trainings.length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPI_CONFIGS.map(k => (
          <Card key={k.label} className={cn('border bg-white shadow-sm', k.borderClass)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shadow-sm', k.bgClass, k.colorClass)}>
                  <k.icon size={16} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{k.label}</span>
              </div>
              <p className={cn('text-xl font-black', k.colorClass)}>{kpiValues[k.key]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyPlaceholder icon={Wallet} text="Aucune formation" iconClass="text-green-300" />
      ) : (
        <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm">
            <TableHead cols={['Formation', 'Formateur', 'Étudiants', 'Total encaissé', '% Formateur', 'Salaire', 'Marge']} />
            <tbody className="divide-y divide-slate-50">
              {rows.map(({ tr, students, totalEncaisse, pct, salary, cfg }) => {
                const marge = totalEncaisse - salary;
                return (
                  <tr key={tr.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', cfg.bgClass, cfg.colorClass)}>
                          <cfg.icon size={13} />
                        </div>
                        <span className="font-semibold text-slate-800">{tr.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <User size={11} className="text-violet-400" />{tr.teacherName || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <Users size={11} className="text-blue-400" />{students.length}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-green-600">{totalEncaisse.toLocaleString()} DH</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', cfg.bgClass, cfg.colorClass, cfg.borderClass)}>{pct}%</span>
                    </td>
                    <td className="px-4 py-3 text-base font-black text-violet-600">{salary.toLocaleString()} DH</td>
                    <td className={cn('px-4 py-3 font-bold', marge >= 0 ? 'text-green-600' : 'text-red-500')}>{marge.toLocaleString()} DH</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                <td colSpan={3} className="px-4 py-3 text-sm text-slate-700">Total</td>
                <td className="px-4 py-3 text-base font-black text-green-600">{totalRevenue.toLocaleString()} DH</td>
                <td />
                <td className="px-4 py-3 text-base font-black text-violet-600">{totalSalaries.toLocaleString()} DH</td>
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

/* ── Main page ───────────────────────────────────────────────── */

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

  /* Training modal */
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

  /* Student modal */
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
      if (currentPaid + newAmount > totalDue) { showToast(`Le paiement dépasse le prix (${totalDue} DH)`, 'error'); return; }
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

  /* Session modal */
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

  /* PDF */
  const generateAttestation = (student, training) => {
    if (!student || !training) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    if (logoBase64) { try { doc.addImage(logoBase64, 'PNG', 20, 15, 30, 30); } catch (e) { console.warn(e); } }
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

  /* Shared dialog class — fully opaque white */
  const modalCls = 'bg-white border border-slate-200 shadow-2xl shadow-slate-300/40 rounded-2xl';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-violet-200 mt-0.5">
          <GraduationCap size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 leading-tight">Formations Continues</h1>
          <p className="text-sm text-slate-400 mt-0.5">Langues · Informatique — Inscriptions, plannings et salaires</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-slate-100 rounded-2xl p-1.5 w-fit flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
              activeTab === tab.id
                ? cn('bg-white shadow-md shadow-slate-200/80', tab.color)
                : 'text-slate-400 hover:text-slate-600 hover:bg-white/50',
            )}
          >
            <tab.icon size={15} className={activeTab === tab.id ? tab.color : ''} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {activeTab === 'formations' && <FormationsTab trainings={continuousTrainings} ctStudents={ctStudents} onAdd={openAddTraining} onEdit={openEditTraining} onDelete={handleDeleteTraining} />}
          {activeTab === 'etudiants'  && <EtudiantsTab  trainings={continuousTrainings} ctStudents={ctStudents} onAddStudent={openAddStudent} onEditStudent={openEditStudent} onDeleteStudent={handleDeleteStudent} onGeneratePDF={generateAttestation} />}
          {activeTab === 'planning'   && <PlanningTab   sessions={ctSessions} trainings={continuousTrainings} onAddSession={openAddSession} onDeleteSession={handleDeleteSession} />}
          {activeTab === 'salaires'   && <SalairesTab   trainings={continuousTrainings} ctStudents={ctStudents} />}
        </motion.div>
      </AnimatePresence>

      {/* ── Modal : Formation ── */}
      <Dialog open={trainingModal} onOpenChange={setTrainingModal}>
        <DialogContent className={modalCls}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <span className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <BookOpen size={14} className="text-violet-600" />
              </span>
              {editingTraining ? 'Modifier la formation' : 'Nouvelle formation'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Nom">
              <Input value={tForm.name} onChange={e => setTForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Anglais des affaires" className="border-slate-200 focus:border-violet-400" />
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
                  <Input value={tForm.type} onChange={e => setTForm(p => ({ ...p, type: e.target.value }))} placeholder="Nom du type" className="flex-1 border-slate-200" autoFocus />
                )}
              </div>
            </Field>
            <Field label="Description">
              <textarea
                value={tForm.description}
                onChange={e => setTForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
                placeholder="Description courte…"
                className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 resize-y transition-colors"
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
                <Input type="number" value={tForm.pricePerStudent} onChange={e => setTForm(p => ({ ...p, pricePerStudent: e.target.value }))} placeholder="0" className="border-slate-200" />
              </Field>
              <Field label="% Formateur">
                <Input type="number" value={tForm.teacherPct} onChange={e => setTForm(p => ({ ...p, teacherPct: e.target.value }))} placeholder="0" min="0" max="100" className="border-slate-200" />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <CancelBtn onClick={() => setTrainingModal(false)}><X size={14} /> Annuler</CancelBtn>
            <PrimaryBtn onClick={saveTraining} icon={editingTraining ? Save : Plus}>
              {editingTraining ? 'Enregistrer' : 'Créer la formation'}
            </PrimaryBtn>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal : Étudiant ── */}
      <Dialog open={studentModal} onOpenChange={setStudentModal}>
        <DialogContent className={cn(modalCls, 'max-w-xl')}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <span className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users size={14} className="text-blue-600" />
              </span>
              {editingStudent ? "Modifier l'étudiant" : 'Ajouter un étudiant'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <div className="grid grid-cols-2 gap-x-3">
              <Field label="Prénom">
                <Input value={sForm.firstName} onChange={e => setSForm(p => ({ ...p, firstName: e.target.value }))} placeholder="Prénom" className="border-slate-200" />
              </Field>
              <Field label="Nom">
                <Input value={sForm.lastName} onChange={e => setSForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Nom" className="border-slate-200" />
              </Field>
              <Field label="Téléphone">
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
                  <Input value={sForm.phone} onChange={e => setSForm(p => ({ ...p, phone: e.target.value }))} placeholder="06xxxxxxxx" className="pl-9 border-slate-200" />
                </div>
              </Field>
              <Field label="Formation">
                <NativeSelect value={sForm.trainingId} onChange={e => setSForm(p => ({ ...p, trainingId: e.target.value }))}>
                  <option value="">— Choisir —</option>
                  {continuousTrainings.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </NativeSelect>
              </Field>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Wallet size={12} className="text-green-500" /> Paiements
              </p>
              {(sForm.payments || []).length > 0 && (
                <div className="flex flex-col gap-2">
                  {(sForm.payments || []).map((p, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-green-50 border border-green-100 rounded-xl">
                      <CheckCircle size={13} className="text-green-500 shrink-0" />
                      <span className="text-xs font-bold text-green-600 flex-1">{Number(p.amount).toLocaleString()} DH</span>
                      <span className="text-xs text-slate-400 flex items-center gap-1"><CalendarDays size={10} className="text-blue-400" />{p.date}</span>
                      <button onClick={() => removePaymentEntry(i)} className="text-red-300 hover:text-red-500 transition-colors p-0.5 rounded-md hover:bg-red-50">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <Field label="Montant (DH)">
                  <Input type="number" value={newPayment.amount} onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))} placeholder="0" className="border-slate-200" />
                </Field>
                <Field label="Date">
                  <Input type="date" value={newPayment.date} onChange={e => setNewPayment(p => ({ ...p, date: e.target.value }))} className="border-slate-200" />
                </Field>
                <button
                  onClick={addPaymentEntry}
                  className="mb-4 h-10 px-4 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-sm shadow-green-200 whitespace-nowrap flex items-center gap-1.5"
                >
                  <Plus size={13} /> Ajouter
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <CancelBtn onClick={() => setStudentModal(false)}><X size={14} /> Annuler</CancelBtn>
            <PrimaryBtn onClick={saveStudent} icon={Save}>Enregistrer</PrimaryBtn>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal : Séance ── */}
      <Dialog open={sessionModal} onOpenChange={setSessionModal}>
        <DialogContent className={cn(modalCls, 'max-w-md')}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <span className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <CalendarDays size={14} className="text-amber-500" />
              </span>
              Ajouter une séance
            </DialogTitle>
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
                <div className="relative">
                  <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" />
                  <Input type="time" value={sesForm.startTime} onChange={e => setSesForm(p => ({ ...p, startTime: e.target.value }))} className="pl-9 border-slate-200" />
                </div>
              </Field>
              <Field label="Heure fin">
                <div className="relative">
                  <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" />
                  <Input type="time" value={sesForm.endTime} onChange={e => setSesForm(p => ({ ...p, endTime: e.target.value }))} className="pl-9 border-slate-200" />
                </div>
              </Field>
            </div>
            <Field label="Salle (optionnel)">
              <div className="relative">
                <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-green-400 pointer-events-none" />
                <Input value={sesForm.room} onChange={e => setSesForm(p => ({ ...p, room: e.target.value }))} placeholder="Ex: Salle A1" className="pl-9 border-slate-200" />
              </div>
            </Field>
          </div>
          <DialogFooter>
            <CancelBtn onClick={() => setSessionModal(false)}><X size={14} /> Annuler</CancelBtn>
            <PrimaryBtn onClick={saveSession} icon={CalendarPlus}>Ajouter la séance</PrimaryBtn>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
