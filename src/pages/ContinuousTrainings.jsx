import { useAdminAuth } from '../context/AdminAuthContext';
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import {
  BookOpen, Plus, Trash2, Edit3, X, Users, CalendarDays, Wallet,
  Search, ChevronDown, ChevronLeft, ChevronRight, Phone, Clock,
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
const PX_PER_HOUR = 80;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

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
  if (normalized.includes('lun')) return { bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.02) 100%)', text: '#4f46e5', border: 'rgba(99, 102, 241, 0.2)' };
  if (normalized.includes('mar')) return { bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)', text: '#059669', border: 'rgba(16, 185, 129, 0.2)' };
  if (normalized.includes('mer')) return { bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)', text: '#d97706', border: 'rgba(245, 158, 11, 0.2)' };
  if (normalized.includes('jeu')) return { bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.02) 100%)', text: '#7c3aed', border: 'rgba(139, 92, 246, 0.2)' };
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

const parseTimeRange = (t = '') => {
  if (!t || !t.includes('-')) return { start: '08:00', end: '10:00' };
  const parts = t.split('-');
  const fmt = s => {
    if (!s) return '00:00';
    const p = s.replace(/h/gi, ':').trim().split(':');
    return `${(p[0] || '00').padStart(2, '0')}:${(p[1] || '00').padStart(2, '0')}`;
  };
  return { start: fmt(parts[0]), end: fmt(parts[1]) };
};

const TRAINING_TYPES = [
  { value: 'langue', label: 'Langue', icon: Languages, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', borderClass: 'border-blue-200', hex: '#2563eb' },
  { value: 'soutien', label: 'Cours de soutien', icon: GraduationCap, colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200', hex: '#059669' },
  { value: 'informatique', label: 'Informatique', icon: Monitor, colorClass: 'text-violet-600', bgClass: 'bg-violet-50', borderClass: 'border-violet-200', hex: '#7c3aed' },
];
const typeConfig = type => TRAINING_TYPES.find(t => t.value === type) || { value: type, label: type || 'Autre', icon: BookOpen, colorClass: 'text-slate-500', bgClass: 'bg-slate-50', borderClass: 'border-slate-200', hex: '#64748b' };
const normalizeTypeName = value => String(value || '').trim();
const getTypeKey = value => normalizeTypeName(value).toLowerCase();
const isSystemTrainingType = type => TRAINING_TYPES.some(item => item.value === type);
const isReservedTrainingTypeName = type =>
  TRAINING_TYPES.some(item => [item.value, item.label].some(value => getTypeKey(value) === getTypeKey(type)));
const getTrainingTypeOptions = (trainings, managedTypes = []) => {
  const seen = new Set();
  const addOption = (value, label = value, id = null) => {
    const normalized = normalizeTypeName(value);
    if (!normalized) return null;
    const key = getTypeKey(normalized);
    if (seen.has(key)) return null;
    seen.add(key);
    return { value: normalized, label: normalizeTypeName(label) || normalized, id };
  };

  return [
    ...TRAINING_TYPES.map(({ value, label }) => addOption(value, label)).filter(Boolean),
    ...managedTypes.map(item => addOption(item.name, item.name, item.id)).filter(Boolean),
    ...trainings.map(item => addOption(item.type, item.type)).filter(Boolean),
  ];
};

const SUPPORT_SUBJECTS_BY_CYCLE = {
  Primaire: ['Arabe', 'Français', 'Maths'],
  Collège: ['Français', 'SVT', 'MATHS', 'Physique'],
  Lycée: ['Français', 'SVT', 'MATHS', 'Physique'],
};
const getSubjectsForCycle = (cycle) => {
  return SUPPORT_SUBJECTS_BY_CYCLE[cycle] || SUPPORT_SUBJECTS_BY_CYCLE['Collège'];
};
const SUPPORT_SUBJECTS = ['Arabe', 'Français', 'MATHS', 'SVT', 'Physique'];
const SUPPORT_CYCLES = ['Primaire', 'Collège', 'Lycée'];
const SUPPORT_LEVELS_BY_CYCLE = {
  Primaire: ['1ère année primaire', '2ème année primaire', '3ème année primaire', '4ème année primaire', '5ème année primaire', '6ème année primaire'],
  Collège: ['1ère année collège', '2ème année collège', '3ème année collège'],
  Lycée: ['Tronc commun', '1BAC', '2BAC'],
};
const LANGUAGE_OPTIONS = ['FRANÇAIS', 'ANGLAIS', 'ESPAGNOL', 'ALLEMAND', 'ITALIEN'];
const LANGUAGE_AUDIENCES = ['KIDS', 'ADO', 'ADULTES'];
const LANGUAGE_ADULT_LEVELS = ['A1', 'A2', 'B1', 'B2'];
const PAYMENT_METHODS = [
  { value: 'espece', label: 'Espèce' },
  { value: 'virement', label: 'Virement' },
];

const toMoney = value => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const getTrainingGrossTotal = training => toMoney(training?.pricePerStudent);

const getStudentFees = student =>
  toMoney(student?.registrationFee) + toMoney(student?.certificateFee);

const getStudentGrossTotal = (student, training) =>
  getTrainingGrossTotal(training) + getStudentFees(student);

const getStudentDiscount = (student, training) =>
  Math.min(toMoney(student?.discountAmount), getStudentGrossTotal(student, training));

const getStudentTotalDue = (student, training) =>
  Math.max(0, getStudentGrossTotal(student, training) - getStudentDiscount(student, training));

const getTrainingPaymentSummary = (students, training) => ({
  basePerStudent: getTrainingGrossTotal(training),
  totalFees: students.reduce((sum, student) => sum + getStudentFees(student), 0),
  totalDiscount: students.reduce((sum, student) => sum + getStudentDiscount(student, training), 0),
  totalDue: students.reduce((sum, student) => sum + getStudentTotalDue(student, training), 0),
});

const getTeacherCompensationUnit = training => training?.teacherCompensationUnit === 'dh' ? 'dh' : 'percent';

const getTeacherCompensationLabel = training => {
  const value = toMoney(training?.teacherPct);
  return getTeacherCompensationUnit(training) === 'dh'
    ? `${value.toLocaleString()} DH`
    : `${value}%`;
};

const getTeacherSalary = (training, totalEncaisse) => {
  const value = toMoney(training?.teacherPct);
  return getTeacherCompensationUnit(training) === 'dh'
    ? Math.round(value)
    : Math.round(totalEncaisse * value / 100);
};

const getPaymentMethodLabel = method =>
  PAYMENT_METHODS.find(item => item.value === method)?.label || PAYMENT_METHODS[0].label;

const getDefaultSupportLevel = cycle => SUPPORT_LEVELS_BY_CYCLE[cycle]?.[0] || '';

const getTrainingLevelLabel = training => {
  if (training?.type === 'langue') {
    if (training.languageAudience === 'ADULTES' && training.languageAdultLevel) {
      return `${training.languageAudience} - ${training.languageAdultLevel}`;
    }
    return training?.languageAudience || '';
  }
  if (training?.type === 'soutien') return training?.level || '';
  return training?.level || '';
};

const getTrainingMetaTags = training => {
  if (training?.type === 'langue') {
    return [
      training.language,
      getTrainingLevelLabel(training),
    ].filter(Boolean);
  }
  if (training?.type === 'soutien') {
    return [
      training.cycle,
      training.level,
      training.subject,
    ].filter(Boolean);
  }
  return [];
};

const getTrainingPropertyRows = training => {
  if (training?.type === 'langue') {
    return [
      { label: 'Langue', value: training.language },
      { label: 'Public', value: training.languageAudience },
      ...(training.languageAudience === 'ADULTES'
        ? [{ label: 'Niveau', value: training.languageAdultLevel }]
        : []),
    ].filter(item => item.value);
  }
  if (training?.type === 'soutien') {
    return [
      { label: 'Cycle', value: training.cycle },
      { label: 'Niveau', value: training.level },
      ...(training.subject ? [{ label: 'Matière', value: training.subject }] : []),
    ].filter(item => item.value);
  }
  return [];
};

const TABS = [
  { id: 'formations', label: 'Formations', icon: BookOpen, color: 'text-violet-600', activeBg: 'bg-violet-50' },
  { id: 'types', label: 'Types', icon: Filter, color: 'text-slate-600', activeBg: 'bg-slate-50' },
  { id: 'etudiants', label: 'Étudiants', icon: Users, color: 'text-blue-600', activeBg: 'bg-blue-50' },
  { id: 'planning', label: 'Planning', icon: CalendarDays, color: 'text-amber-500', activeBg: 'bg-amber-50' },
  { id: 'salaires', label: 'Salaires', icon: Wallet, color: 'text-green-600', activeBg: 'bg-green-50' },
];
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;

/* ── Reusable primitives ─────────────────────────────────────── */

function Label({ children }) {
  return (
    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
      {children}
    </label>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-2.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NativeSelect({ className, ...props }) {
  return (
    <select
      className={cn(
        'flex h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800',
        'focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400',
        'disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        className,
      )}
      {...props}
    />
  );
}

/* Colored action icon buttons */
function ActionBtn({ onClick, title, variant = 'ghost', className, children, disabled = false }) {
  const { hasPermission } = useAdminAuth();
  disabled = disabled || (['edit', 'danger'].includes(variant) && !hasPermission('continuous', 'edit'));
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 active:scale-95',
        variant === 'ghost'    && 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700',
        variant === 'edit'     && 'bg-amber-50 text-amber-500 hover:bg-amber-100 hover:text-amber-600',
        variant === 'danger'   && 'bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600',
        variant === 'info'     && 'bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-700',
        variant === 'success'  && 'bg-green-50 text-green-500 hover:bg-green-100 hover:text-green-700',
        variant === 'expand'   && 'bg-violet-50 text-violet-500 hover:bg-violet-100 hover:text-violet-700',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-slate-100 hover:text-slate-500 active:scale-100',
        className,
      )}
    >
      {children}
    </button>
  );
}

/* Gradient primary CTA buttons */
function PrimaryBtn({ onClick, children, className, icon: Icon }) {
  const { hasPermission } = useAdminAuth();
  return (
    <button disabled={!hasPermission('continuous', 'edit')}
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

function usePaginatedItems(items, initialPageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, totalItems);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, pageSize, safePage]);

  useEffect(() => {
    setPage(1);
  }, [items, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return {
    items: pageItems,
    page: safePage,
    pageSize,
    setPage,
    setPageSize: value => setPageSize(Number(value) || DEFAULT_PAGE_SIZE),
    totalItems,
    totalPages,
    startIndex,
    endIndex,
  };
}

function PaginationControls({ pagination, label = 'éléments' }) {
  if (!pagination || pagination.totalItems === 0) return null;

  return (
    <div className="continuous-pagination flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm">
      <div>
        {pagination.startIndex}-{pagination.endIndex} sur {pagination.totalItems} {label}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-400">Par page</span>
        <NativeSelect
          value={pagination.pageSize}
          onChange={e => pagination.setPageSize(e.target.value)}
          className="h-8 w-[76px] py-1"
        >
          {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
        </NativeSelect>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => pagination.setPage(Math.max(1, pagination.page - 1))}
            disabled={pagination.page <= 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            title="Page précédente"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[76px] text-center text-slate-600">
            Page {pagination.page}/{pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => pagination.setPage(Math.min(pagination.totalPages, pagination.page + 1))}
            disabled={pagination.page >= pagination.totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            title="Page suivante"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Formations tab ──────────────────────────────────────────── */

function FormationsTab({ trainings, trainingTypes = [], ctStudents, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const typeOptions = useMemo(() => getTrainingTypeOptions(trainings, trainingTypes), [trainings, trainingTypes]);
  const filtered = useMemo(() => trainings.filter(t => {
    if (typeFilter && typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const metadata = getTrainingMetaTags(t).join(' ').toLowerCase();
      return t.name?.toLowerCase().includes(q) || t.teacherName?.toLowerCase().includes(q) || metadata.includes(q);
    }
    return true;
  }), [trainings, search, typeFilter]);
  const pagination = usePaginatedItems(filtered);
  const pageTrainings = pagination.items;

  return (
    <div className="space-y-5">
      <div className="continuous-premium-toolbar flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400 pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" className="pl-9 border-slate-200 focus:border-violet-400" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 border-slate-200 bg-white">
            <Filter size={13} className="text-slate-400 mr-1" />
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Tous les types</SelectItem>
            {typeOptions.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {[
            { mode: 'table', label: 'Tableau', Icon: List },
            { mode: 'cards', label: 'Cartes', Icon: LayoutGrid },
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
        <PrimaryBtn onClick={onAdd} icon={Plus}>Nouvelle formation</PrimaryBtn>
      </div>

      {filtered.length === 0 ? (
        <EmptyPlaceholder icon={BookOpen} text="Aucune formation continue" subtext="Créez votre première formation pour commencer" />
      ) : viewMode === 'table' ? (
        <div className="continuous-table-shell rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <TableHead cols={['Formation', 'Type', 'Propriétés', 'Tarifs', 'Formateur', 'Étudiants', 'Encaissement', 'Actions']} />
            <tbody className="divide-y divide-slate-50">
              {pageTrainings.map(tr => {
                const cfg = typeConfig(tr.type);
                const properties = getTrainingPropertyRows(tr);
                const trainingStudents = ctStudents.filter(s => s.trainingId === tr.id);
                const studentCount = trainingStudents.length;
                const totalPaid = trainingStudents.reduce((sum, s) => sum + (s.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0), 0);
                const { basePerStudent, totalFees, totalDiscount, totalDue } = getTrainingPaymentSummary(trainingStudents, tr);
                const paidPct = totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0;

                return (
                  <tr key={tr.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 min-w-[220px]">
                      <div className="flex items-center gap-2.5">
                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', cfg.bgClass, cfg.colorClass)}>
                          <cfg.icon size={15} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 leading-tight">{tr.name}</p>
                          {tr.description && <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{tr.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><TypeBadge cfg={cfg} /></td>
                    <td className="px-4 py-3 min-w-[190px]">
                      {properties.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {properties.map(item => (
                            <span key={`${item.label}-${item.value}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                              <span className="text-slate-400">{item.label}:</span> {item.value}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5 text-xs">
                        <div className="font-black text-green-600">{basePerStudent.toLocaleString()} DH</div>
                        <div className="text-slate-400 font-semibold">Base {toMoney(tr.pricePerStudent).toLocaleString()} DH</div>
                        {(totalFees > 0 || totalDiscount > 0) && (
                          <div className="text-[10px] text-slate-400">
                            {[
                              totalFees > 0 ? `+${totalFees.toLocaleString()} DH frais stagiaires` : '',
                              totalDiscount > 0 ? `-${totalDiscount.toLocaleString()} DH remises stagiaires` : '',
                            ].filter(Boolean).join(' | ')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-600">
                          <User size={11} className="text-violet-400" />{tr.teacherName || '—'}
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-amber-500">
                          <Percent size={11} />{getTeacherCompensationLabel(tr)}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-600 border border-blue-100">
                        <Users size={11} />{studentCount}
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-[150px]">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-bold text-green-600">{totalPaid.toLocaleString()} DH</span>
                        <span className="text-slate-400">{paidPct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${paidPct}%` }} />
                      </div>
                      {totalDue > 0 && <div className="text-[10px] text-slate-400 mt-1">{totalDue.toLocaleString()} DH attendu</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <ActionBtn onClick={() => onEdit(tr)} title="Modifier" variant="edit"><Edit3 size={13} /></ActionBtn>
                        <ActionBtn onClick={() => onDelete(tr)} title="Supprimer" variant="danger"><Trash2 size={13} /></ActionBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pageTrainings.map(tr => {
            const cfg = typeConfig(tr.type);
            const metaTags = getTrainingMetaTags(tr);
            const trainingStudents = ctStudents.filter(s => s.trainingId === tr.id);
            const studentCount = trainingStudents.length;
            const totalPaid = trainingStudents.reduce((sum, s) => sum + (s.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0), 0);
            const { basePerStudent, totalDue } = getTrainingPaymentSummary(trainingStudents, tr);
            const paidPct = totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0;
            const soldéCount = trainingStudents.filter(s => {
              const paid = (s.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0);
              const studentDue = getStudentTotalDue(s, tr);
              return studentDue <= 0 || paid >= studentDue;
            }).length;
            const barColor = paidPct === 100 ? 'bg-green-500' : paidPct >= 50 ? 'bg-amber-400' : 'bg-red-400';

            return (
              <Card key={tr.id} className="continuous-training-card group transition-all duration-200 hover:-translate-y-1">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm', cfg.bgClass, cfg.colorClass)}>
                        <cfg.icon size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 leading-tight">{tr.name}</p>
                        <div className="mt-1"><TypeBadge cfg={cfg} /></div>
                        {metaTags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {metaTags.map(tag => (
                              <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
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
                      {basePerStudent.toLocaleString()} DH / étudiant
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Percent size={11} className="text-amber-400 shrink-0" />
                      <span className="font-semibold">{getTeacherCompensationLabel(tr)} formateur</span>
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
                        transition={{ duration: 0.24, ease: 'easeOut' }}
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
      {filtered.length > 0 && <PaginationControls pagination={pagination} label="formations" />}
    </div>
  );
}

/* ── Étudiants tab ───────────────────────────────────────────── */

function TypesTab({ trainings, trainingTypes = [], onAdd, onEdit, onDelete }) {
  const rows = useMemo(() => {
    const usageByType = trainings.reduce((acc, training) => {
      const key = getTypeKey(training.type);
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const managedByKey = new Map(trainingTypes.map(type => [getTypeKey(type.name), type]));
    const seen = new Set();
    const addRow = ({ value, label, id = null, source }) => {
      const normalized = normalizeTypeName(value);
      if (!normalized) return null;
      const key = getTypeKey(normalized);
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id,
        value: normalized,
        label: normalizeTypeName(label) || normalized,
        source,
        isSystem: source === 'system',
        usageCount: usageByType[key] || 0,
      };
    };

    return [
      ...TRAINING_TYPES.map(type => addRow({ value: type.value, label: type.label, source: 'system' })).filter(Boolean),
      ...trainingTypes.map(type => addRow({ value: type.name, label: type.name, id: type.id, source: 'managed' })).filter(Boolean),
      ...trainings
        .filter(training => !isSystemTrainingType(training.type) && !managedByKey.has(getTypeKey(training.type)))
        .map(training => addRow({ value: training.type, label: training.type, source: 'training' }))
        .filter(Boolean),
    ];
  }, [trainings, trainingTypes]);
  const pagination = usePaginatedItems(rows);
  const pageRows = pagination.items;

  return (
    <div className="space-y-5">
      <div className="continuous-premium-toolbar flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-800">Types de formation</h2>
          <p className="text-xs font-semibold text-slate-400">Les types système sont protégés, les types personnalisés sont modifiables.</p>
        </div>
        <PrimaryBtn onClick={onAdd} icon={Plus}>Nouveau type</PrimaryBtn>
      </div>

      <div className="continuous-table-shell rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <TableHead cols={['Type', 'Statut', 'Formations', 'Actions']} />
          <tbody className="divide-y divide-slate-50">
            {pageRows.map(row => {
              const cfg = typeConfig(row.value);
              const statusLabel = row.isSystem ? 'Système' : row.id ? 'Personnalisé' : 'Depuis formations';
              const canEdit = !row.isSystem;
              const canDelete = !row.isSystem && row.id && row.usageCount === 0;

              return (
                <tr key={row.value} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', cfg.bgClass, cfg.colorClass)}>
                        <cfg.icon size={15} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 leading-tight">{row.label}</p>
                        {!row.isSystem && <p className="text-[11px] font-semibold text-slate-400">{row.value}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold',
                      row.isSystem ? 'border-blue-100 bg-blue-50 text-blue-600' : 'border-violet-100 bg-violet-50 text-violet-600',
                    )}>
                      {statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      <BookOpen size={11} /> {row.usageCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <ActionBtn onClick={() => onEdit(row)} title={canEdit ? 'Modifier' : 'Type système protégé'} variant="edit" disabled={!canEdit}>
                        <Edit3 size={13} />
                      </ActionBtn>
                      <ActionBtn
                        onClick={() => onDelete(row)}
                        title={canDelete ? 'Supprimer' : row.usageCount > 0 ? 'Type utilisé par des formations' : 'Type système protégé'}
                        variant="danger"
                        disabled={!canDelete}
                      >
                        <Trash2 size={13} />
                      </ActionBtn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationControls pagination={pagination} label="types" />
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
  const pagination = usePaginatedItems(filtered);
  const pageStudents = pagination.items;

  useEffect(() => {
    setExpandedId(null);
  }, [pagination.page, pagination.pageSize]);

  return (
    <div className="space-y-5">
      <div className="continuous-premium-toolbar flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400 pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un étudiant…" className="pl-9 border-slate-200" />
        </div>
        <Select value={trainingFilter || 'all'} onValueChange={v => setTrainingFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-56 border-slate-200 bg-white">
            <Filter size={13} className="text-slate-400 mr-1" />
            <SelectValue placeholder="Toutes les formations" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Toutes les formations</SelectItem>
            {trainings.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <PrimaryBtn onClick={() => onAddStudent(trainingFilter)} icon={UserPlus}>Ajouter étudiant</PrimaryBtn>
      </div>

      {filtered.length === 0 ? (
        <EmptyPlaceholder icon={Users} text="Aucun étudiant enregistré" iconClass="text-blue-300" />
      ) : (
        <div className="continuous-table-shell rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <TableHead cols={['Étudiant', 'Formation', 'Contact', 'Paiements', 'Statut', 'Actions']} />
            <tbody className="divide-y divide-slate-50">
              {pageStudents.map(s => {
                const tr = getTraining(s.trainingId);
                const totalDue = getStudentTotalDue(s, tr);
                const totalPaid = (s.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0);
                const remaining = totalDue - totalPaid;
                const isPaid = Boolean(tr) && remaining <= 0;
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
                        {getStudentFees(s) > 0 && <div className="text-[10px] font-semibold text-slate-400 mt-0.5">Frais : {getStudentFees(s).toLocaleString()} DH</div>}
                        {getStudentDiscount(s, tr) > 0 && <div className="text-[10px] font-semibold text-blue-400 mt-0.5">Remise : {getStudentDiscount(s, tr).toLocaleString()} DH</div>}
                        {isPartial && <div className="text-[10px] font-semibold text-red-400 mt-0.5">Reste : {remaining.toLocaleString()} DH</div>}
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
                          {(isPaid || isPartial) && <ActionBtn onClick={() => onGeneratePDF(s, tr)} title="Reçu de paiement" variant="info"><FileDown size={13} /></ActionBtn>}
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
                                        <span className="text-slate-400 font-semibold">{getPaymentMethodLabel(p.method)}</span>
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
      {filtered.length > 0 && <PaginationControls pagination={pagination} label="étudiants" />}
    </div>
  );
}

/* ── Planning tab ────────────────────────────────────────────── */

function PlanningTab({ sessions, trainings, trainingTypes = [], onAddSession, onEditSession, onDeleteSession }) {
  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission('continuous', 'edit');
  const [viewMode, setViewMode] = useState('grid');
  const [trainingFilter, setTrainingFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [cycleFilter, setCycleFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [languageAudienceFilter, setLanguageAudienceFilter] = useState('all');
  const typeOptions = useMemo(() => getTrainingTypeOptions(trainings, trainingTypes), [trainings, trainingTypes]);
  const getTraining = id => trainings.find(t => t.id === id);
  const today = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const effectiveCycleFilter = typeFilter === 'soutien' ? cycleFilter : 'all';
  const effectiveSubjectFilter = typeFilter === 'soutien' ? subjectFilter : 'all';
  const effectiveLanguageFilter = typeFilter === 'langue' ? languageFilter : 'all';
  const effectiveLanguageAudienceFilter = typeFilter === 'langue' ? languageAudienceFilter : 'all';
  const levelOptions = useMemo(() => {
    if (typeFilter === 'soutien') {
      const cycleLevels = effectiveCycleFilter === 'all'
        ? Object.values(SUPPORT_LEVELS_BY_CYCLE).flat()
        : SUPPORT_LEVELS_BY_CYCLE[effectiveCycleFilter] || [];
      const actualLevels = trainings
        .filter(t => t.type === 'soutien')
        .filter(t => effectiveCycleFilter === 'all' || t.cycle === effectiveCycleFilter)
        .map(getTrainingLevelLabel)
        .filter(Boolean);
      return Array.from(new Set([...cycleLevels, ...actualLevels]));
    }
    if (typeFilter === 'langue') {
      if (effectiveLanguageAudienceFilter !== 'all' && effectiveLanguageAudienceFilter !== 'ADULTES') return [];
      const actualLevels = trainings
        .filter(t => t.type === 'langue')
        .filter(t => effectiveLanguageFilter === 'all' || t.language === effectiveLanguageFilter)
        .filter(t => effectiveLanguageAudienceFilter === 'all' || t.languageAudience === effectiveLanguageAudienceFilter)
        .map(t => t.languageAdultLevel)
        .filter(Boolean);
      return Array.from(new Set([...LANGUAGE_ADULT_LEVELS, ...actualLevels]));
    }
    const actualLevels = trainings
      .filter(t => typeFilter === 'all' || t.type === typeFilter)
      .filter(t => effectiveSubjectFilter === 'all' || t.subject === effectiveSubjectFilter)
      .map(getTrainingLevelLabel)
      .filter(Boolean);
    return Array.from(new Set(actualLevels));
  }, [trainings, typeFilter, effectiveCycleFilter, effectiveSubjectFilter, effectiveLanguageFilter, effectiveLanguageAudienceFilter]);
  const effectiveLevelFilter = levelFilter !== 'all' && levelOptions.includes(levelFilter) ? levelFilter : 'all';
  const languageOptions = useMemo(() => {
    const existing = trainings
      .filter(t => t.type === 'langue')
      .map(t => t.language)
      .filter(Boolean);
    return Array.from(new Set([...LANGUAGE_OPTIONS, ...existing]));
  }, [trainings]);
  const languageAudienceOptions = useMemo(() => {
    const existing = trainings
      .filter(t => t.type === 'langue')
      .filter(t => effectiveLanguageFilter === 'all' || t.language === effectiveLanguageFilter)
      .map(t => t.languageAudience)
      .filter(Boolean);
    return Array.from(new Set([...LANGUAGE_AUDIENCES, ...existing]));
  }, [trainings, effectiveLanguageFilter]);
  const subjectOptions = useMemo(() => {
    const cycleSubjects = effectiveCycleFilter === 'all'
      ? SUPPORT_SUBJECTS
      : getSubjectsForCycle(effectiveCycleFilter);
    const existing = trainings
      .filter(t => t.type === 'soutien')
      .filter(t => effectiveCycleFilter === 'all' || t.cycle === effectiveCycleFilter)
      .filter(t => effectiveLevelFilter === 'all' || t.level === effectiveLevelFilter)
      .map(t => t.subject)
      .filter(Boolean);
    return Array.from(new Set([...cycleSubjects, ...existing]));
  }, [trainings, effectiveCycleFilter, effectiveLevelFilter]);
  const filteredTrainings = useMemo(() => trainings.filter(training => {
    if (typeFilter !== 'all' && training.type !== typeFilter) return false;
    if (typeFilter === 'soutien' && effectiveCycleFilter !== 'all' && training.cycle !== effectiveCycleFilter) return false;
    if (effectiveSubjectFilter !== 'all' && training.subject !== effectiveSubjectFilter) return false;
    if (typeFilter === 'langue' && effectiveLanguageFilter !== 'all' && training.language !== effectiveLanguageFilter) return false;
    if (typeFilter === 'langue' && effectiveLanguageAudienceFilter !== 'all' && training.languageAudience !== effectiveLanguageAudienceFilter) return false;
    if (effectiveLevelFilter !== 'all') {
      if (training.type === 'langue') return training.languageAdultLevel === effectiveLevelFilter;
      return getTrainingLevelLabel(training) === effectiveLevelFilter;
    }
    return true;
  }), [trainings, typeFilter, effectiveCycleFilter, effectiveSubjectFilter, effectiveLanguageFilter, effectiveLanguageAudienceFilter, effectiveLevelFilter]);
  const filteredTrainingIds = useMemo(() => new Set(filteredTrainings.map(t => t.id)), [filteredTrainings]);
  const effectiveTrainingFilter = trainingFilter !== 'all' && filteredTrainingIds.has(trainingFilter) ? trainingFilter : 'all';
  const filtered = useMemo(() => sessions.filter(s => {
    if (effectiveTrainingFilter !== 'all' && s.trainingId !== effectiveTrainingFilter) return false;
    return filteredTrainingIds.has(s.trainingId);
  }), [sessions, effectiveTrainingFilter, filteredTrainingIds]);
  const pagination = usePaginatedItems(filtered);
  const pageSessions = pagination.items;
  const activeDays = useMemo(() => DAYS.filter(d => pageSessions.some(s => s.day === d)), [pageSessions]);

  return (
    <div className="space-y-5">
      <div className="continuous-premium-toolbar flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={value => { setTypeFilter(value); setCycleFilter('all'); setSubjectFilter('all'); setLevelFilter('all'); setLanguageFilter('all'); setLanguageAudienceFilter('all'); setTrainingFilter('all'); }}>
          <SelectTrigger className="w-48 border-slate-200 bg-white">
            <Filter size={13} className="text-slate-400 mr-1" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Tous les types</SelectItem>
            {typeOptions.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {typeFilter === 'langue' && (
          <Select value={effectiveLanguageFilter} onValueChange={value => { setLanguageFilter(value); setLanguageAudienceFilter('all'); setLevelFilter('all'); setTrainingFilter('all'); }}>
            <SelectTrigger className="w-44 border-slate-200 bg-white">
              <SelectValue placeholder="Langue" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Toutes les langues</SelectItem>
              {languageOptions.map(language => <SelectItem key={language} value={language}>{language}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {typeFilter === 'langue' && (
          <Select value={effectiveLanguageAudienceFilter} onValueChange={value => { setLanguageAudienceFilter(value); setLevelFilter('all'); setTrainingFilter('all'); }}>
            <SelectTrigger className="w-44 border-slate-200 bg-white">
              <SelectValue placeholder="Public" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Tous les publics</SelectItem>
              {languageAudienceOptions.map(audience => <SelectItem key={audience} value={audience}>{audience}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {typeFilter === 'soutien' && (
          <Select value={effectiveCycleFilter} onValueChange={value => { setCycleFilter(value); setLevelFilter('all'); setSubjectFilter('all'); setTrainingFilter('all'); }}>
            <SelectTrigger className="w-44 border-slate-200 bg-white">
              <SelectValue placeholder="Cycle" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Tous les cycles</SelectItem>
              {SUPPORT_CYCLES.map(cycle => <SelectItem key={cycle} value={cycle}>{cycle}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {levelOptions.length > 0 && typeFilter !== 'all' && (
          <Select value={effectiveLevelFilter} onValueChange={value => { setLevelFilter(value); setSubjectFilter('all'); setTrainingFilter('all'); }}>
            <SelectTrigger className="w-52 border-slate-200 bg-white">
              <SelectValue placeholder="Niveau" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Tous les niveaux</SelectItem>
              {levelOptions.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {typeFilter === 'soutien' && (
          <Select value={effectiveSubjectFilter} onValueChange={value => { setSubjectFilter(value); setTrainingFilter('all'); }}>
            <SelectTrigger className="w-44 border-slate-200 bg-white">
              <SelectValue placeholder="Matière" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Toutes les matières</SelectItem>
              {subjectOptions.map(subject => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={effectiveTrainingFilter} onValueChange={setTrainingFilter}>
          <SelectTrigger className="w-56 border-slate-200 bg-white">
            <Filter size={13} className="text-slate-400 mr-1" />
            <SelectValue placeholder="Choisir une formation" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Toutes les formations</SelectItem>
            {filteredTrainings.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
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
          <div className="continuous-table-shell rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <TableHead cols={['Jour', 'Horaire', 'Formation', 'Formateur', 'Salle', '']} />
              <tbody className="divide-y divide-slate-50">
                {pageSessions.map(s => {
                  const tr = getTraining(s.trainingId);
                  const cfg = typeConfig(tr?.type);
                  const metaTags = getTrainingMetaTags(tr);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">{s.day}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <Clock size={11} className="text-amber-400" />{s.time}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <TypeBadge cfg={cfg} />
                          <div className="text-xs font-semibold text-slate-700">{tr?.name || 'Formation non définie'}</div>
                          {metaTags.length > 0 && <div className="text-[10px] text-slate-400 font-semibold">{metaTags.join(' · ')}</div>}
                        </div>
                      </td>
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
                        <div className="flex items-center gap-1">
                          <ActionBtn onClick={() => onEditSession(s)} title="Modifier" variant="edit">
                            <Edit3 size={13} />
                          </ActionBtn>
                          <ActionBtn onClick={() => onDeleteSession(s)} title="Supprimer" variant="danger">
                            <Trash2 size={13} />
                          </ActionBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="continuous-schedule-shell glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {activeDays.length === 0 ? (
            <div className="p-10">
              <EmptyPlaceholder icon={CalendarDays} text="Aucune séance à afficher" iconClass="text-amber-300" />
            </div>
          ) : (
            <div style={{ overflowX: 'auto', overflowY: 'auto' }}>
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
                  {activeDays.map(day => {
                    const daySessions = pageSessions.filter(s => s.day === day);
                    const colors = getDayColors(day);
                    
                    return (
                      <div key={day} className="home-schedule-day-row" style={{ height: '96px' }}>
                        {/* Day label */}
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
                          {HOURS.map(hour => (
                            <div key={hour} className="home-schedule-hour-vertical-line" style={{ left: `${(hour - START_HOUR) * PX_PER_HOUR}px` }} />
                          ))}
                          {HOURS.map(hour => (
                            <div key={`h-${hour}`} className="home-schedule-half-vertical-line" style={{ left: `${(hour - START_HOUR) * PX_PER_HOUR + PX_PER_HOUR / 2}px` }} />
                          ))}

                          {daySessions.map(session => {
                            const { start, end } = parseTimeRange(session.time);
                            const left = timeToPixels(start);
                            const width = Math.max(timeToPixels(end) - left, PX_PER_HOUR * 0.7);
                            const tr = getTraining(session.trainingId);
                            const eventStyles = getDeterministicEventStyles(tr?.name);

                            return (
                              <motion.div
                                key={session.id}
                                layout
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`home-schedule-event home-schedule-event-course ${day === today ? 'home-schedule-event-today' : ''}`}
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
                                    disabled={!canEdit} onClick={(e) => { e.stopPropagation(); onEditSession(session); }}
                                    className="schedule-action-btn edit"
                                    title="Modifier"
                                  >
                                    <Edit3 size={10} />
                                  </button>
                                  <button
                                    disabled={!canEdit} onClick={(e) => { e.stopPropagation(); onDeleteSession(session); }}
                                    className="schedule-action-btn delete"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>

                                <div className="home-schedule-event-time">
                                  <Clock size={8} />
                                  <span>{session.time}</span>
                                </div>
                                <div className="home-schedule-event-title">
                                  {tr?.name || 'Formation non définie'}
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                  {session.room && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%' }}>
                                      <MapPin size={9} style={{ color: 'var(--event-color)', opacity: 0.7, flexShrink: 0 }} />
                                      <span style={{ fontSize: '8.5px', fontWeight: '700', fontFamily: 'Inter, sans-serif', color: 'var(--event-text)', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {session.room}
                                      </span>
                                    </div>
                                  )}
                                  {tr?.teacherName && (
                                    <div className="home-schedule-event-teacher" style={{ width: '100%' }}>
                                      <User size={8} />
                                      <span>{tr.teacherName}</span>
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
          )}
        </div>
      )}
      {filtered.length > 0 && <PaginationControls pagination={pagination} label="séances" />}
    </div>
  );
}

/* ── Salaires tab ────────────────────────────────────────────── */

const KPI_CONFIGS = [
  { label: 'Revenu total',  key: 'revenue',  tone: 'ct-revenue',  unit: 'DH', icon: Wallet },
  { label: 'Total salaires', key: 'salaries', tone: 'ct-salaries', unit: 'DH', icon: User },
  { label: 'Marge nette',   key: 'margin',   tone: 'ct-margin',   unit: 'DH', icon: BarChart3 },
  { label: 'Formations',    key: 'count',    tone: 'ct-count',    unit: '',   icon: BookOpen },
];

function SalairesTab({ trainings, ctStudents }) {
  const rows = useMemo(() => trainings.map(tr => {
    const students = ctStudents.filter(s => s.trainingId === tr.id);
    const totalEncaisse = students.reduce((sum, s) => sum + (s.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0), 0);
    const salary = getTeacherSalary(tr, totalEncaisse);
    return { tr, students, totalEncaisse, teacherLabel: getTeacherCompensationLabel(tr), salary, cfg: typeConfig(tr.type) };
  }), [trainings, ctStudents]);
  const pagination = usePaginatedItems(rows);
  const pageRows = pagination.items;

  const totalRevenue = rows.reduce((a, r) => a + r.totalEncaisse, 0);
  const totalSalaries = rows.reduce((a, r) => a + r.salary, 0);
  const kpiValues = {
    revenue:  totalRevenue,
    salaries: totalSalaries,
    margin:   totalRevenue - totalSalaries,
    count:    trainings.length,
  };

  return (
    <div className="space-y-6">
      <div className="continuous-salary-kpi-grid">
        {KPI_CONFIGS.map(k => (
          <motion.div
            key={k.label}
            className={`finance-net-card finance-net-card-${k.tone} continuous-salary-kpi-card`}
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="finance-net-card-shine" aria-hidden="true" />
            <div className="finance-net-card-icon-bg" aria-hidden="true">
              <k.icon size={54} strokeWidth={1.35} />
            </div>
            <div className="finance-net-card-top">
              <span className="finance-net-card-kicker">Formations continues</span>
              <span className="premium-metric-badge"><k.icon size={11} /> Salaires</span>
            </div>
            <div className="finance-net-card-content">
              <h3>{k.label}</h3>
              <p className="finance-net-card-amount">
                {Number(kpiValues[k.key] || 0).toLocaleString()}
                {k.unit && <span>{k.unit}</span>}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyPlaceholder icon={Wallet} text="Aucune formation" iconClass="text-green-300" />
      ) : (
        <div className="continuous-table-shell rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <TableHead cols={['Formation', 'Formateur', 'Étudiants', 'Total encaissé', 'Part formateur', 'Salaire', 'Marge']} />
            <tbody className="divide-y divide-slate-50">
              {pageRows.map(({ tr, students, totalEncaisse, teacherLabel, salary, cfg }) => {
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
                      <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', cfg.bgClass, cfg.colorClass, cfg.borderClass)}>{teacherLabel}</span>
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
      {rows.length > 0 && <PaginationControls pagination={pagination} label="formations" />}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────── */

export default function ContinuousTrainings() {

  const navigate = useNavigate();
  const {
    teachers = [], confirmAction, showToast,
    continuousTrainings = [], loadContinuousData, addContinuousTraining, updateContinuousTraining, deleteContinuousTraining,
    continuousTrainingTypes = [], addContinuousTrainingType, renameContinuousTrainingType, deleteContinuousTrainingType,
    ctStudents = [], addCtStudent, updateCtStudent, deleteCtStudent,
    ctSessions = [], addCtSession, updateCtSession, deleteCtSession,
  } = useApp();
  const [activeTab, setActiveTab] = useState('formations');

  useEffect(() => {
    loadContinuousData?.();
  }, [loadContinuousData]);

  /* Training modal */
  const [trainingModal, setTrainingModal] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const emptyT = {
    name: '',
    type: 'langue',
    description: '',
    teacherId: '',
    pricePerStudent: '',
    teacherPct: '',
    teacherCompensationUnit: 'percent',
    language: LANGUAGE_OPTIONS[0],
    languageAudience: LANGUAGE_AUDIENCES[0],
    languageAdultLevel: '',
    subject: '',
    cycle: SUPPORT_CYCLES[0],
    level: getDefaultSupportLevel(SUPPORT_CYCLES[0]),
  };
  const [tForm, setTForm] = useState(emptyT);
  const trainingTypeOptions = useMemo(
    () => getTrainingTypeOptions(continuousTrainings, continuousTrainingTypes),
    [continuousTrainings, continuousTrainingTypes],
  );
  const openAddTraining = () => { setEditingTraining(null); setTForm(emptyT); setTrainingModal(true); };
  const openEditTraining = tr => {
    const cycle = tr.cycle || SUPPORT_CYCLES[0];
    setEditingTraining(tr);
    setTForm({
      ...emptyT,
      name: tr.name || '',
      type: tr.type || 'langue',
      description: tr.description || '',
      teacherId: tr.teacherId || '',
      pricePerStudent: tr.pricePerStudent ?? '',
      teacherPct: tr.teacherPct ?? '',
      teacherCompensationUnit: getTeacherCompensationUnit(tr),
      language: tr.language || LANGUAGE_OPTIONS[0],
      languageAudience: tr.languageAudience || LANGUAGE_AUDIENCES[0],
      languageAdultLevel: tr.languageAdultLevel || '',
      subject: tr.subject || getSubjectsForCycle(cycle)[0],
      cycle,
      level: tr.level || getDefaultSupportLevel(cycle),
    });
    setTrainingModal(true);
  };
  const updateTrainingType = value => {
    if (value === 'custom') {
      setTForm(prev => ({ ...prev, type: '' }));
      return;
    }
    setTForm(prev => {
      if (value === 'langue') {
        return {
          ...prev,
          type: value,
          language: prev.language || LANGUAGE_OPTIONS[0],
          languageAudience: prev.languageAudience || LANGUAGE_AUDIENCES[0],
          languageAdultLevel: prev.languageAdultLevel || '',
        };
      }
      if (value === 'soutien') {
        const cycle = prev.cycle || SUPPORT_CYCLES[0];
        return {
          ...prev,
          type: value,
          subject: prev.subject || getSubjectsForCycle(cycle)[0],
          cycle,
          level: prev.level || getDefaultSupportLevel(cycle),
        };
      }
      return { ...prev, type: value };
    });
  };
  const saveTraining = async () => {
    try {
    if (!tForm.name.trim()) { showToast('Nom requis', 'error'); return; }
    if (!tForm.type.trim()) { showToast('Type requis', 'error'); return; }
    if (tForm.type === 'langue' && tForm.languageAudience === 'ADULTES' && !tForm.languageAdultLevel) {
      showToast('Sélectionnez le niveau adulte', 'error');
      return;
    }
    const teacher = teachers.find(t => t.id === tForm.teacherId);
    const teacherValue = tForm.teacherCompensationUnit === 'percent'
      ? Math.min(100, toMoney(tForm.teacherPct))
      : toMoney(tForm.teacherPct);
    const data = {
      ...tForm,
      teacherName: teacher?.name || '',
      pricePerStudent: toMoney(tForm.pricePerStudent),
      teacherPct: teacherValue,
      teacherCompensationUnit: tForm.teacherCompensationUnit === 'dh' ? 'dh' : 'percent',
      language: tForm.type === 'langue' ? tForm.language : '',
      languageAudience: tForm.type === 'langue' ? tForm.languageAudience : '',
      languageAdultLevel: tForm.type === 'langue' && tForm.languageAudience === 'ADULTES' ? tForm.languageAdultLevel : '',
      subject: tForm.type === 'soutien' ? tForm.subject : '',
      cycle: tForm.type === 'soutien' ? tForm.cycle : '',
      level: tForm.type === 'soutien' ? tForm.level : '',
    };
    if (editingTraining) await updateContinuousTraining(editingTraining.id, data);
    else await addContinuousTraining(data);
    setTrainingModal(false);

    } catch (error) {
      if (error.code !== 'permission-denied') showToast(error.message || 'Enregistrement impossible. Veuillez réessayer.', 'error');
    }
  };
  const handleDeleteTraining = async tr => {
    try {
    if (await confirmAction({ title: 'Supprimer', message: 'Supprimer cette formation ?', type: 'danger' })) {
      await deleteContinuousTraining(tr.id);
    }

    } catch (error) {
      if (error.code !== 'permission-denied') showToast(error.message || 'Enregistrement impossible. Veuillez réessayer.', 'error');
    }
  };

  /* Type modal */
  const [typeModal, setTypeModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeForm, setTypeForm] = useState({ name: '' });
  const openAddType = () => {
    setEditingType(null);
    setTypeForm({ name: '' });
    setTypeModal(true);
  };
  const openEditType = type => {
    setEditingType(type);
    setTypeForm({ name: type.value });
    setTypeModal(true);
  };
  const saveType = async () => {
    try {
    const name = normalizeTypeName(typeForm.name);
    if (!name) { showToast('Nom du type requis', 'error'); return; }
    if (isReservedTrainingTypeName(name)) { showToast('Ce nom est réservé aux types système', 'error'); return; }

    const duplicate = trainingTypeOptions.some(option =>
      getTypeKey(option.value) === getTypeKey(name) &&
      (!editingType || getTypeKey(option.value) !== getTypeKey(editingType.value))
    );
    if (duplicate) { showToast('Ce type existe déjà', 'error'); return; }

    if (editingType) {
      await renameContinuousTrainingType?.({ id: editingType.id, oldName: editingType.value, name });
    } else {
      await addContinuousTrainingType?.({ name });
    }
    setTypeModal(false);

    } catch (error) {
      if (error.code !== 'permission-denied') showToast(error.message || 'Enregistrement impossible. Veuillez réessayer.', 'error');
    }
  };
  const handleDeleteType = async type => {
    if (type.isSystem) { showToast('Les types système ne peuvent pas être supprimés', 'error'); return; }
    if (type.usageCount > 0) {
      showToast(`Impossible de supprimer : ${type.usageCount} formation(s) utilisent ce type`, 'error');
      return;
    }
    if (!type.id) { showToast('Ce type est généré depuis les formations existantes', 'warning'); return; }
    if (await confirmAction({ title: 'Supprimer', message: `Supprimer le type "${type.label}" ?`, type: 'danger' })) {
      await deleteContinuousTrainingType?.(type.id);
    }
  };

  /* Student modal */
  const [studentModal, setStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const emptyS = { firstName: '', lastName: '', phone: '', trainingId: '', registrationFee: '', certificateFee: '', discountAmount: '', payments: [] };
  const [sForm, setSForm] = useState(emptyS);
  const today = new Date().toISOString().split('T')[0];
  const emptyPayment = { amount: '', date: today, method: 'espece' };
  const [newPayment, setNewPayment] = useState(emptyPayment);
  const openAddStudent = (preId = '') => { setEditingStudent(null); setSForm({ ...emptyS, trainingId: preId }); setNewPayment(emptyPayment); setStudentModal(true); };
  const openEditStudent = s => {
    setEditingStudent(s);
    setSForm({
      ...s,
      registrationFee: s.registrationFee ?? '',
      certificateFee: s.certificateFee ?? '',
      discountAmount: s.discountAmount ?? '',
    });
    setNewPayment(emptyPayment);
    setStudentModal(true);
  };
  const addPaymentEntry = () => {
    if (!sForm.trainingId) { showToast("Sélectionnez une formation d'abord", 'error'); return; }
    if (!newPayment.amount || isNaN(Number(newPayment.amount))) { showToast('Montant invalide', 'error'); return; }
    const tr = continuousTrainings.find(t => t.id === sForm.trainingId);
    const totalDue = getStudentTotalDue(sForm, tr);
    const currentPaid = (sForm.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0);
    const newAmount = Number(newPayment.amount);
    if (currentPaid + newAmount > totalDue) { showToast(`Le total dépasse le prix de la formation (${totalDue} DH)`, 'error'); return; }
    setSForm(prev => ({ ...prev, payments: [...(prev.payments || []), { ...newPayment, amount: newAmount }] }));
    setNewPayment(emptyPayment);
  };
  const removePaymentEntry = idx => setSForm(prev => ({ ...prev, payments: prev.payments.filter((_, i) => i !== idx) }));
  const saveStudent = async () => {
    try {
    if (!sForm.firstName.trim() || !sForm.lastName.trim()) { showToast('Nom et prénom requis', 'error'); return; }
    if (!sForm.trainingId) { showToast('Sélectionnez une formation', 'error'); return; }
    let finalSForm = {
      ...sForm,
      registrationFee: toMoney(sForm.registrationFee),
      certificateFee: toMoney(sForm.certificateFee),
      discountAmount: toMoney(sForm.discountAmount)
    };
    if (newPayment.amount && !isNaN(Number(newPayment.amount))) {
      const tr = continuousTrainings.find(t => t.id === sForm.trainingId);
      const totalDue = getStudentTotalDue(finalSForm, tr);
      const currentPaid = (finalSForm.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0);
      const newAmount = Number(newPayment.amount);
      if (currentPaid + newAmount > totalDue) { showToast(`Le paiement dépasse le prix (${totalDue} DH)`, 'error'); return; }
      finalSForm.payments = [...(finalSForm.payments || []), { ...newPayment, amount: newAmount }];
    }
    if (editingStudent) await updateCtStudent(editingStudent.id, finalSForm);
    else await addCtStudent(finalSForm);
    setStudentModal(false);

    } catch (error) {
      if (error.code !== 'permission-denied') showToast(error.message || 'Enregistrement impossible. Veuillez réessayer.', 'error');
    }
  };
  const handleDeleteStudent = async s => {
    try {
    if (await confirmAction({ title: 'Supprimer', message: 'Supprimer cet étudiant ?', type: 'danger' })) {
      await deleteCtStudent(s.id);
    }

    } catch (error) {
      if (error.code !== 'permission-denied') showToast(error.message || 'Enregistrement impossible. Veuillez réessayer.', 'error');
    }
  };

  /* Session modal */
  const [sessionModal, setSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const emptySes = { trainingId: '', day: 'Lundi', startTime: '08:00', endTime: '10:00', room: '' };
  const [sesForm, setSesForm] = useState(emptySes);
  const openAddSession = () => { setEditingSession(null); setSesForm({ ...emptySes, trainingId: continuousTrainings[0]?.id || '' }); setSessionModal(true); };
  const openEditSession = session => { setEditingSession(session); const { start, end } = parseTimeRange(session.time); setSesForm({ trainingId: session.trainingId, day: session.day, startTime: start, endTime: end, room: session.room || '' }); setSessionModal(true); };
  const saveSession = async () => {
    try {
    if (!sesForm.trainingId) { showToast('Sélectionnez une formation', 'error'); return; }
    const time = `${sesForm.startTime}-${sesForm.endTime}`;
    if (editingSession) await updateCtSession(editingSession.id, { ...sesForm, time });
    else await addCtSession({ ...sesForm, time });
    setSessionModal(false);

    } catch (error) {
      if (error.code !== 'permission-denied') showToast(error.message || 'Enregistrement impossible. Veuillez réessayer.', 'error');
    }
  };
  const handleDeleteSession = async s => {
    try {
    if (await confirmAction({ title: 'Supprimer', message: 'Supprimer cette séance ?', type: 'danger' })) {
      await deleteCtSession(s.id);
    }

    } catch (error) {
      if (error.code !== 'permission-denied') showToast(error.message || 'Enregistrement impossible. Veuillez réessayer.', 'error');
    }
  };

  const generateReceipt = async (student, training) => {
    if (!student || !training) return;
    const payments = student.payments || [];
    if (payments.length === 0) {
      showToast('Aucun paiement trouvé pour ce stagiaire', 'warning');
      return;
    }
    const payment = payments[payments.length - 1]; // Dernier paiement
    
    // Calcul du numéro de reçu FCXXXX
    let ctPaymentsCount = 0;
    let currentPaymentFound = false;
    ctStudents.forEach(st => {
      (st.payments || []).forEach(p => {
        if (!currentPaymentFound) {
          ctPaymentsCount++;
          if (st.id === student.id && p.date === payment.date && p.amount === payment.amount) {
            currentPaymentFound = true;
          }
        }
      });
    });
    
    // Fallback if not found (shouldn't happen)
    if (!currentPaymentFound) ctPaymentsCount++;
    const receiptNumber = `FC${String(ctPaymentsCount).padStart(4, '0')}`;

    const [{ jsPDF }, { loadLogoDataUrl }] = await Promise.all([
      import('jspdf'),
      import('../utils/loadLogoDataUrl'),
    ]);
    const logoBase64 = await loadLogoDataUrl();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
    const w = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const halfPageHeight = pageHeight / 2;
    const margin = 7;
    
    const drawReceiptCopy = (offsetY, copyLabel) => {
      // Larger Logo
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, 'JPEG', margin, offsetY + 2.5, 28, 12);
        } catch {
          // Ignore logo rendering failures so the receipt can still be generated.
        }
      }
      
      // Copy Label
      doc.setFontSize(7); doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'bold');
      doc.text(copyLabel, w - margin, offsetY + 6, { align: 'right' });
      
      // Main Title
      doc.setFontSize(13); doc.setTextColor(35, 35, 35);
      doc.text('RECU DE PAIEMENT', w / 2, offsetY + 14, { align: 'center' });
      doc.setDrawColor(200); doc.line(margin, offsetY + 17.5, w - margin, offsetY + 17.5);

      // Receipt Meta
      doc.setFontSize(8); doc.setTextColor(80, 80, 80); doc.setFont('helvetica', 'normal');
      doc.text(`N Recu: ${receiptNumber}`, margin, offsetY + 22);
      doc.text(`Date: ${payment.date}`, w - margin, offsetY + 22, { align: 'right' });

      // Info Box
      doc.setFillColor(248, 250, 252); doc.rect(margin, offsetY + 26, w - (margin * 2), 22, 'F');
      doc.setDrawColor(226, 232, 240); doc.rect(margin, offsetY + 26, w - (margin * 2), 22, 'S');
      
      doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text('Stagiaire', margin + 3, offsetY + 32);
      doc.text('Formation', w / 2 + 3, offsetY + 32);
      
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.text(doc.splitTextToSize(`${student.firstName || ''} ${student.lastName || ''}`.trim(), 56)[0] || '-', margin + 3, offsetY + 38);
      doc.text(doc.splitTextToSize(`Type: Formation Continue`, 56)[0] || '-', margin + 3, offsetY + 44);
      doc.text(doc.splitTextToSize(training.name || '', 56)[0] || '-', w / 2 + 3, offsetY + 38);

      // Calculations for receipt
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const totalDue = getStudentTotalDue(student, training);
      const remaining = totalDue - totalPaid;
      const receiptLines = [
        ['Versement actuel', `${Number(payment.amount).toLocaleString('fr-FR')} DH`],
        ['Mode de paiement', getPaymentMethodLabel(payment.method)],
        ['Prix formation', `${toMoney(training.pricePerStudent).toLocaleString('fr-FR')} DH`],
      ];
      if (toMoney(student.registrationFee) > 0) receiptLines.push(["Frais d'inscription", `${toMoney(student.registrationFee).toLocaleString('fr-FR')} DH`]);
      if (toMoney(student.certificateFee) > 0) receiptLines.push(["Frais d'attestation", `${toMoney(student.certificateFee).toLocaleString('fr-FR')} DH`]);
      if (toMoney(student.discountAmount) > 0) receiptLines.push(['Remise', `-${toMoney(student.discountAmount).toLocaleString('fr-FR')} DH`]);
      receiptLines.push(['Total à payer', `${totalDue.toLocaleString('fr-FR')} DH`]);
      receiptLines.push(['Total payé', `${totalPaid.toLocaleString('fr-FR')} DH`]);

      // Line Items Table
      let y = offsetY + 52;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text('Designation', margin, y);
      doc.text('Montant', w - margin, y, { align: 'right' });
      y += 2.5;
      doc.setDrawColor(210); doc.line(margin, y, w - margin, y);
      
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      
      receiptLines.forEach(([label, amount]) => {
        y += 3.8;
        doc.text(label, margin, y);
        doc.text(amount, w - margin, y, { align: 'right' });
      });

      // Total
      y += 4;
      doc.setDrawColor(35); doc.line(margin, y, w - margin, y);
      y += 5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text('RESTE A PAYER', margin, y);
      doc.text(`${Math.max(0, remaining).toLocaleString('fr-FR')} DH`, w - margin, y, { align: 'right' });

      // Signature (positioned right after Total)
      y += 8;
      doc.setFontSize(7.5); doc.setFont('helvetica', 'italic');
      doc.text("Signature et Cachet de l'administration", w - margin, y, { align: 'right' });
    };

    drawReceiptCopy(0, 'COPIE STAGIAIRE');
    doc.setDrawColor(130, 130, 130);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(8, halfPageHeight, w - 8, halfPageHeight);
    doc.setLineDashPattern([], 0);
    drawReceiptCopy(halfPageHeight, 'COPIE ADMINISTRATION');

    doc.save(`Recu_${receiptNumber}_${student.lastName}.pdf`);
    showToast('Reçu de paiement généré', 'success');
  };

  const isCustomType = !tForm.type || !trainingTypeOptions.some(option => option.value === tForm.type);

  /* Shared dialog class — fully opaque white */
  const modalCls = 'continuous-premium-dialog bg-white rounded-2xl p-4 gap-3';

  return (
    <div className="continuous-premium-page space-y-6">
      {/* Header */}
      <div className="continuous-premium-header flex items-start gap-3">
        <div className="continuous-premium-header-icon">
          <GraduationCap size={22} />
        </div>
        <div className="continuous-premium-header-copy">
          <span className="continuous-premium-eyebrow">Pôle de formation</span>
          <h1>Formations Continues</h1>
          <p>Langues · Informatique — Inscriptions, plannings et salaires</p>
        </div>
        <div className="continuous-premium-header-orb" aria-hidden="true"><GraduationCap size={112} /></div>
      </div>

      {/* Tabs */}
      <div className="continuous-premium-tabs flex gap-1.5 rounded-2xl p-1.5 w-fit flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'continuous-premium-tab flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
              activeTab === tab.id
                ? cn('active', tab.color)
                : 'text-slate-400 hover:text-slate-600',
            )}
          >
            <tab.icon size={15} className={activeTab === tab.id ? tab.color : ''} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div className="continuous-premium-content" key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
          {activeTab === 'formations' && <FormationsTab trainings={continuousTrainings} trainingTypes={continuousTrainingTypes} ctStudents={ctStudents} onAdd={openAddTraining} onEdit={openEditTraining} onDelete={handleDeleteTraining} />}
          {activeTab === 'types'      && <TypesTab      trainings={continuousTrainings} trainingTypes={continuousTrainingTypes} onAdd={openAddType} onEdit={openEditType} onDelete={handleDeleteType} />}
          {activeTab === 'etudiants'  && <EtudiantsTab  trainings={continuousTrainings} ctStudents={ctStudents} onAddStudent={openAddStudent} onEditStudent={openEditStudent} onDeleteStudent={handleDeleteStudent} onGeneratePDF={generateReceipt} />}
          {activeTab === 'planning'   && <PlanningTab   sessions={ctSessions} trainings={continuousTrainings} trainingTypes={continuousTrainingTypes} onAddSession={openAddSession} onEditSession={openEditSession} onDeleteSession={handleDeleteSession} />}
          {activeTab === 'salaires'   && <SalairesTab   trainings={continuousTrainings} ctStudents={ctStudents} />}
        </motion.div>
      </AnimatePresence>

      {/* ── Modal : Formation ── */}
      <Dialog open={trainingModal} onOpenChange={setTrainingModal}>
        <DialogContent className={cn(modalCls, 'max-w-2xl')}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <span className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <BookOpen size={14} className="text-violet-600" />
              </span>
              {editingTraining ? 'Modifier la formation' : 'Nouvelle formation'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Field label="Nom">
              <Input value={tForm.name} onChange={e => setTForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Anglais des affaires" className="border-slate-200 focus:border-violet-400" />
            </Field>
            <Field label="Type">
              <div className="flex gap-2">
                <NativeSelect
                  className="flex-1"
                  value={isCustomType ? 'custom' : tForm.type}
                  onChange={e => updateTrainingType(e.target.value)}
                >
                  {trainingTypeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  <option value="custom">Nouveau type...</option>
                </NativeSelect>
                {isCustomType && (
                  <Input value={tForm.type} onChange={e => setTForm(p => ({ ...p, type: e.target.value }))} placeholder="Nom du type" className="flex-1 border-slate-200" autoFocus />
                )}
              </div>
            </Field>
            {tForm.type === 'langue' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Field label="Langue">
                  <NativeSelect value={tForm.language} onChange={e => setTForm(p => ({ ...p, language: e.target.value }))}>
                    {LANGUAGE_OPTIONS.map(language => <option key={language} value={language}>{language}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="Public">
                  <NativeSelect
                    value={tForm.languageAudience}
                    onChange={e => setTForm(p => ({ ...p, languageAudience: e.target.value, languageAdultLevel: e.target.value === 'ADULTES' ? p.languageAdultLevel : '' }))}
                  >
                    {LANGUAGE_AUDIENCES.map(level => <option key={level} value={level}>{level}</option>)}
                  </NativeSelect>
                </Field>
                {tForm.languageAudience === 'ADULTES' && (
                  <Field label="Niveau">
                    <NativeSelect value={tForm.languageAdultLevel} onChange={e => setTForm(p => ({ ...p, languageAdultLevel: e.target.value }))}>
                      <option value="">— Choisir —</option>
                      {LANGUAGE_ADULT_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                    </NativeSelect>
                  </Field>
                )}
              </div>
            )}
            {tForm.type === 'soutien' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Field label="Cycle">
                  <NativeSelect
                    value={tForm.cycle}
                    onChange={e => {
                      const cycle = e.target.value;
                      const subjects = getSubjectsForCycle(cycle);
                      setTForm(p => ({
                        ...p,
                        cycle,
                        level: getDefaultSupportLevel(cycle),
                        subject: subjects[0] || '',
                      }));
                    }}
                  >
                    {SUPPORT_CYCLES.map(cycle => <option key={cycle} value={cycle}>{cycle}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="Niveau">
                  <NativeSelect value={tForm.level} onChange={e => setTForm(p => ({ ...p, level: e.target.value }))}>
                    {(SUPPORT_LEVELS_BY_CYCLE[tForm.cycle] || []).map(level => <option key={level} value={level}>{level}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="Matière">
                  <NativeSelect value={tForm.subject} onChange={e => setTForm(p => ({ ...p, subject: e.target.value }))}>
                    {getSubjectsForCycle(tForm.cycle).map(subject => <option key={subject} value={subject}>{subject}</option>)}
                  </NativeSelect>
                </Field>
              </div>
            )}
            <Field label="Description">
              <textarea
                value={tForm.description}
                onChange={e => setTForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
                placeholder="Description courte…"
                className="flex w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 resize-y transition-colors"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field label="Prix / étudiant (DH)">
                <Input type="number" value={tForm.pricePerStudent} onChange={e => setTForm(p => ({ ...p, pricePerStudent: e.target.value }))} placeholder="0" className="border-slate-200" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_112px] gap-2">
              <Field label="Part formateur">
                <Input
                  type="number"
                  value={tForm.teacherPct}
                  onChange={e => setTForm(p => ({ ...p, teacherPct: e.target.value }))}
                  placeholder="0"
                  min="0"
                  max={tForm.teacherCompensationUnit === 'percent' ? '100' : undefined}
                  className="border-slate-200"
                />
              </Field>
              <Field label="Unité">
                <NativeSelect value={tForm.teacherCompensationUnit} onChange={e => setTForm(p => ({ ...p, teacherCompensationUnit: e.target.value }))}>
                  <option value="percent">%</option>
                  <option value="dh">DHS</option>
                </NativeSelect>
              </Field>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600 flex items-center justify-between">
              <span>Prix de base par étudiant</span>
              <span className="text-green-600">{getTrainingGrossTotal(tForm).toLocaleString()} DH</span>
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

      {/* Modal : Type de formation */}
      <Dialog open={typeModal} onOpenChange={setTypeModal}>
        <DialogContent className={cn(modalCls, 'max-w-md')}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                <Filter size={14} className="text-slate-600" />
              </span>
              {editingType ? 'Modifier le type' : 'Nouveau type'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-1">
            <Field label="Nom du type">
              <Input
                value={typeForm.name}
                onChange={e => setTypeForm({ name: e.target.value })}
                placeholder="Ex: Marketing digital"
                className="border-slate-200 focus:border-violet-400"
                autoFocus
              />
            </Field>
            {editingType?.usageCount > 0 && (
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                La modification renommera ce type dans {editingType.usageCount} formation(s).
              </div>
            )}
          </div>
          <DialogFooter>
            <CancelBtn onClick={() => setTypeModal(false)}><X size={14} /> Annuler</CancelBtn>
            <PrimaryBtn onClick={saveType} icon={editingType ? Save : Plus}>
              {editingType ? 'Enregistrer' : 'Créer le type'}
            </PrimaryBtn>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal : Étudiant ── */}
      <Dialog open={studentModal} onOpenChange={setStudentModal}>
        <DialogContent className={cn(modalCls, 'max-w-2xl')}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <span className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users size={14} className="text-blue-600" />
              </span>
              {editingStudent ? "Modifier l'étudiant" : 'Ajouter un étudiant'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2">
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
              <Field label="Frais d'inscription (DH)">
                <Input type="number" value={sForm.registrationFee} onChange={e => setSForm(p => ({ ...p, registrationFee: e.target.value }))} placeholder="Optionnel" className="border-slate-200" />
              </Field>
              <Field label="Frais d'attestation (DH)">
                <Input type="number" value={sForm.certificateFee} onChange={e => setSForm(p => ({ ...p, certificateFee: e.target.value }))} placeholder="Optionnel" className="border-slate-200" />
              </Field>
              <Field label="Remise (DH)">
                <Input type="number" value={sForm.discountAmount} onChange={e => setSForm(p => ({ ...p, discountAmount: e.target.value }))} placeholder="0" className="border-slate-200" />
              </Field>
            </div>

            {sForm.trainingId && (
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600 flex items-center justify-between mt-2">
                <span>Total à payer (frais/remise inclus)</span>
                <span className="text-green-600">
                  {getStudentTotalDue(sForm, continuousTrainings.find(t => t.id === sForm.trainingId)).toLocaleString()} DH
                </span>
              </div>
            )}

            <div className="border-t border-slate-100 pt-2.5 space-y-2">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Wallet size={12} className="text-green-500" /> Paiements
              </p>
              {(sForm.payments || []).length > 0 && (
                <div className="flex flex-col gap-2">
                  {(sForm.payments || []).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-green-50 border border-green-100 rounded-lg">
                      <CheckCircle size={13} className="text-green-500 shrink-0" />
                      <span className="text-xs font-bold text-green-600 flex-1">{Number(p.amount).toLocaleString()} DH</span>
                      <span className="text-xs text-slate-400 flex items-center gap-1"><CalendarDays size={10} className="text-blue-400" />{p.date}</span>
                      <span className="text-xs text-slate-400 font-semibold">{getPaymentMethodLabel(p.method)}</span>
                      <button onClick={() => removePaymentEntry(i)} className="text-red-300 hover:text-red-500 transition-colors p-0.5 rounded-md hover:bg-red-50">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_128px_auto] gap-2 items-end">
                <Field label="Montant (DH)">
                  <Input type="number" value={newPayment.amount} onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))} placeholder="0" className="border-slate-200" />
                </Field>
                <Field label="Date">
                  <Input type="date" value={newPayment.date} onChange={e => setNewPayment(p => ({ ...p, date: e.target.value }))} className="border-slate-200" />
                </Field>
                <Field label="Mode">
                  <NativeSelect value={newPayment.method} onChange={e => setNewPayment(p => ({ ...p, method: e.target.value }))}>
                    {PAYMENT_METHODS.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
                  </NativeSelect>
                </Field>
                <button
                  onClick={addPaymentEntry}
                  className="mb-2.5 h-9 px-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold active:scale-95 transition-all shadow-sm shadow-green-200 whitespace-nowrap flex items-center gap-1.5"
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
        <DialogContent className={modalCls}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <span className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <CalendarDays size={14} className="text-amber-600" />
              </span>
              {editingSession ? 'Modifier la séance' : 'Planifier une séance'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
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
            <div className="grid grid-cols-2 gap-2">
              <Field label="Heure de début">
                <Input type="time" value={sesForm.startTime} onChange={e => setSesForm(p => ({ ...p, startTime: e.target.value }))} className="border-slate-200" />
              </Field>
              <Field label="Heure de fin">
                <Input type="time" value={sesForm.endTime} onChange={e => setSesForm(p => ({ ...p, endTime: e.target.value }))} className="border-slate-200" />
              </Field>
            </div>
            <Field label="Salle (optionnel)">
              <Input value={sesForm.room} onChange={e => setSesForm(p => ({ ...p, room: e.target.value }))} placeholder="Ex: Salle 3" className="border-slate-200" />
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
