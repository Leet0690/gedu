import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/cn';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useDebounce } from '../utils/useDebounce';

import { TableSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { DatePicker } from '../components/ui';
import { FilterSelect } from '../components/ui/FilterSelect';
import {
  getPaymentStatusKey,
  getPaymentStatusLabel,
  hasDuplicateMonthlyPayment,
} from '../utils/paymentUtils';
import {
  getAvailableAcademicYears,
  getDefaultAcademicYearTransition,
  getPaymentAcademicYear,
  getStudentAcademicSnapshot,
  getStudentCurrentAcademicYear,
  getStudentPayableMonths,
  getStudentPreviousYearBalance,
  getStudentStudyCycleRange,
  isActiveStudent,
  isStudentVacationMonth,
} from '../utils/studentStatus';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { 
  Lock, 
  ArrowRight, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  DoorOpen, 
  Search, 
  Plus, 
  FileDown,
  Trash2, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw,
  BarChart3,
  PieChart,
  Edit3,
  X,
  CreditCard,
  History,
  CalendarDays,
  Receipt,
  Tag,
  Eye,
  EyeOff,
  AlertTriangle,
  Table2
} from 'lucide-react';

const FinanceModalPortal = ({ children }) => (
  typeof document === 'undefined' ? null : createPortal(children, document.body)
);

const calcDuration = (timeStr) => {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2})[h:]?(\d{2})?\s*[-–—]\s*(\d{1,2})[h:]?(\d{2})?/i);
  if (!match) return 0;
  try {
    const h1 = parseInt(match[1] || 0, 10), m1 = parseInt(match[2] || 0, 10);
    const h2 = parseInt(match[3] || 0, 10), m2 = parseInt(match[4] || 0, 10);
    return Math.max(0, Math.round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 60 * 100) / 100);
  } catch { return 0; }
};

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const normalizeTimeSlot = (value = '') => (value || '').replace(/[^0-9]/g, '') || 'x';
const safeModuleKey = (value = '') => (value || 'global').replace(/[^a-zA-Z0-9]/g, '_');
const makeAttendanceDocId = (teacherId, moduleId, timeSlot, date) =>
  `${teacherId}_${safeModuleKey(moduleId)}_${normalizeTimeSlot(timeSlot)}_${date}`;

const getRecordTimestamp = (record) => {
  if (!record?.timestamp) return 0;
  if (typeof record.timestamp.toMillis === 'function') return record.timestamp.toMillis();
  if (typeof record.timestamp.seconds === 'number') return record.timestamp.seconds * 1000;
  return 0;
};

const getDayNameFromDate = (dateStr) => {
  const [year, month, day] = (dateStr || '').split('-').map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date(dateStr);
  return DAY_NAMES[date.getDay()];
};

const getMonthDates = (month, year) => {
  const pad = (n) => String(n).padStart(2, '0');
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`);
};

const getScheduledRowsForDate = ({ schedules = [], teacherId, date, getScheduleModule = (session) => session.module || '' }) => {
  const dayName = getDayNameFromDate(date);
  const slotsMap = new Map();

  schedules
    .filter(session => session.teacherId === teacherId && session.day === dayName)
    .forEach(session => {
      const module = getScheduleModule(session);
      if (!module) return;
      const slotKey = `${teacherId}_${normalizeTimeSlot(session.time)}`;
      if (slotsMap.has(slotKey)) return;
      slotsMap.set(slotKey, {
        date,
        duration: calcDuration(session.time),
        docId: makeAttendanceDocId(teacherId, module, session.time, date),
        module,
        timeSlot: session.time
      });
    });

  return Array.from(slotsMap.values()).sort((a, b) =>
    (a.date || '').localeCompare(b.date || '') ||
    (a.timeSlot || '').localeCompare(b.timeSlot || '')
  );
};

const getRecordForScheduledRow = (records = [], teacherId, row) => {
  const rowSlot = normalizeTimeSlot(row.timeSlot);
  const candidates = records.filter(record =>
    record.teacherId === teacherId &&
    record.date === row.date &&
    normalizeTimeSlot(record.timeSlot) === rowSlot
  );

  if (!candidates.length) return null;
  const exact = candidates.find(record => record.id === row.docId);
  if (exact) return exact;
  return candidates.reduce((latest, record) =>
    getRecordTimestamp(record) >= getRecordTimestamp(latest) ? record : latest
  , candidates[0]);
};

const formatMoney = (value) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })
    .format(parseFloat(value) || 0)
    .replace(/[\u00A0\u202F]/g, ' ');

const getCurrentMonthName = () => {
  const month = new Date().toLocaleString('fr-FR', { month: 'long' });
  return month.charAt(0).toUpperCase() + month.slice(1);
};

const PAYMENT_FEE_FIELDS = [
  { key: 'examFee', label: "Frais d'examen" },
  { key: 'registrationFee', label: "Frais d'inscription" },
  { key: 'supportFee', label: 'Support' }
];

const getPaymentFeeItems = (payment) => {
  const legacyFees = Array.isArray(payment?.fees) ? payment.fees : [];
  const normalizedLegacyFees = legacyFees
    .map(fee => ({ label: fee.label, amount: parseFloat(fee.amount) || 0 }))
    .filter(fee => fee.amount > 0);

  const keyedFees = PAYMENT_FEE_FIELDS
    .map(({ key, label }) => ({ label, amount: parseFloat(payment?.[key]) || 0 }))
    .filter(fee => fee.amount > 0);

  return normalizedLegacyFees.length ? normalizedLegacyFees : keyedFees;
};

const getPaymentTotal = (payment) => parseFloat(payment?.amount) || 0;

const toMoney = value => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const getContinuousTeacherSalary = (training, revenue) => {
  const value = toMoney(training?.teacherPct);
  return training?.teacherCompensationUnit === 'dh'
    ? Math.round(value)
    : Math.round(revenue * value / 100);
};

const formatDisplayDate = (date) => {
  if (!date) return 'Sans date';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getPaymentBaseAmount = (payment) => {
  if (payment?.tuitionAmount !== undefined) return parseFloat(payment.tuitionAmount) || 0;
  const feesTotal = getPaymentFeeItems(payment).reduce((sum, fee) => sum + fee.amount, 0);
  return Math.max(0, getPaymentTotal(payment) - feesTotal);
};

const STUDENT_RECEIPT_PREFIX = 'FD';

const getCreatedAtValue = (record = {}) => {
  if (typeof record.createdAt?.toMillis === 'function') return record.createdAt.toMillis();
  if (typeof record.createdAt?.seconds === 'number') return record.createdAt.seconds * 1000;
  return 0;
};

const getLegacyReceiptNumber = (record, records, prefix, getPrefix = () => prefix) => {
  const orderedRecords = records
    .filter(item => getPrefix(item) === prefix)
    .sort((a, b) => getCreatedAtValue(a) - getCreatedAtValue(b) || String(a.id).localeCompare(String(b.id)));
  const index = orderedRecords.findIndex(item => item.id === record.id);
  return `${prefix}${String(Math.max(index + 1, 1)).padStart(4, '0')}`;
};

const getTeacherMonthlySessionRows = (attendance, teacherId, month, year, schedules = [], getScheduleModule) => {
  const rows = [];
  getMonthDates(month, year).forEach(date => {
    getScheduledRowsForDate({ schedules, teacherId, date, getScheduleModule }).forEach(row => {
      const record = getRecordForScheduledRow(attendance, teacherId, row);
      if (record?.status !== 'present') return;

      const h = Number(record.hours);
      rows.push({
        date: row.date,
        module: row.module || record.moduleId || 'Seance',
        timeSlot: row.timeSlot || record.timeSlot || '-',
        hours: h > 0 ? h : (calcDuration(row.timeSlot || record.timeSlot) || 4)
      });
    });
  });

  return rows;
};

const getTeacherMonthlyHours = (attendance, teacherId, month, year, schedules = [], getScheduleModule) => {
  return getTeacherMonthlySessionRows(attendance, teacherId, month, year, schedules, getScheduleModule)
    .reduce((sum, row) => sum + (Number(row.hours) || 0), 0);
};

const EXPENSE_CATEGORIES = ['Loyer', 'Matériel', 'Fournitures', 'Services', 'Entretien', 'Communication', 'Transport', 'Autre'];

const GlobalStatCard = ({ title, amount, tone, icon: Icon, month, helper, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 18, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    whileHover={{ y: -6, scale: 1.025 }}
    transition={{ duration: 0.32, delay, ease: [0.22, 1, 0.36, 1] }}
    className={`finance-net-card finance-net-card-${tone}`}
  >
    <div className="finance-net-card-shine" aria-hidden="true" />
    <div className="finance-net-card-icon-bg" aria-hidden="true">
      <Icon size={54} strokeWidth={1.35} />
    </div>
    <div className="finance-net-card-top">
      <span className="finance-net-card-kicker">Résultat net</span>
      <span className="finance-net-month-badge"><CalendarDays size={12} />{month}</span>
    </div>
    <div className="finance-net-card-content">
      <h3>{title}</h3>
      <p className="finance-net-card-amount">{formatMoney(amount)}<span>DH</span></p>
      <p className="finance-net-card-helper">{helper}</p>
    </div>
  </motion.div>
);

const FinanceDashboard = () => {
  const { 
    students, teachers, payments, salaries, expenses, loading,
    continuousTrainings = [], ctStudents = [],
    addPayment, updatePayment, deletePayment, addSalary, deleteSalary, updateTeacher,
    addExpense, deleteExpense,
    teacherAttendance, loadFinancialData, loadTeacherAttendanceForMonth,
    schedules, getActiveScheduleModule,
    isDirectorAuth, loginDirector, logoutDirector, logout, confirmAction
  } = useApp();
  const { showToast } = useToast();
  const activeStudents = useMemo(() => (students || []).filter(isActiveStudent), [students]);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('payments');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const defaultAcademicYear = useMemo(
    () => getDefaultAcademicYearTransition().fromAcademicYear,
    []
  );
  const [paymentAcademicYearFilter, setPaymentAcademicYearFilter] = useState(
    () => defaultAcademicYear
  );
  const [paymentMonthFilter, setPaymentMonthFilter] = useState(getCurrentMonthName);
  const availableAcademicYears = useMemo(() => getAvailableAcademicYears(students, payments), [students, payments]);
  const previousYearArrearsMap = useMemo(() => {
    const map = {};
    (students || []).forEach(student => {
      const bal = getStudentPreviousYearBalance(student, payments);
      if (bal.hasUnpaid) {
        map[student.id] = bal;
      }
    });
    return map;
  }, [students, payments]);
  const resolvePaymentStudent = (payment = {}) => {
    if (payment.studentSnapshot) return { id: payment.studentId, ...payment.studentSnapshot };
    const currentStudent = students.find(student => student.id === payment.studentId);
    if (!currentStudent) return null;
    const paymentAcademicYear = getPaymentAcademicYear(payment);
    return getStudentAcademicSnapshot(currentStudent, paymentAcademicYear) || currentStudent;
  };
  const [summaryMonthFilter, setSummaryMonthFilter] = useState(getCurrentMonthName);
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const debouncedTeacherSearch = useDebounce(teacherSearchTerm, 300);
  const [salaryStatusFilter, setSalaryStatusFilter] = useState('');
  const [dailyStatsDate, setDailyStatsDate] = useState('');
  const [dailyStatsEndDate, setDailyStatsEndDate] = useState('');
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [salariesPage, setSalariesPage] = useState(1);
  const [teachersPage, setTeachersPage] = useState(1);
  const [expensesPage, setExpensesPage] = useState(1);
  const [dailyStatsPage, setDailyStatsPage] = useState(1);
  const [overduePage, setOverduePage] = useState(1);
  const paymentsPerPage = 6;
  const itemsPerPage = 10;
  const teachersPerPage = 5;
  const expensesPerPage = 10;
  const dailyStatsPerPage = 7;
  const overduePerPage = 8;
  
  const [expenseFilter, setExpenseFilter] = useState({
    month: '',
    year: new Date().getFullYear(),
    category: ''
  });

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseData, setExpenseData] = useState({
    label: '',
    amount: '',
    category: 'Autre',
    date: new Date().toISOString().split('T')[0],
    month: getCurrentMonthName(),
    year: new Date().getFullYear()
  });

  const [annualYear, setAnnualYear] = useState(new Date().getFullYear());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentData, setPaymentData] = useState({
    studentId: '',
    academicYear: defaultAcademicYear,
    amount: '',
    examFee: '',
    registrationFee: '',
    supportFee: '',
    month: getCurrentMonthName(),
    date: new Date().toISOString().split('T')[0],
    status: 'payé',
    paymentMethod: 'Espèces'
  });
  const [paymentModalFilter, setPaymentModalFilter] = useState({ diploma: '', major: '', year: '' });

  const [salaryFilter, setSalaryFilter] = useState({
    teacherId: '',
    month: new Date().getMonth(),
    year: new Date().getFullYear()
  });

  const paymentBaseAmount = parseFloat(paymentData.amount) || 0;
  const paymentExtraTotal = PAYMENT_FEE_FIELDS.reduce((sum, { key }) => sum + (parseFloat(paymentData[key]) || 0), 0);
  const paymentGrandTotal = paymentBaseAmount + paymentExtraTotal;

  const months = useMemo(() => [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ], []);
  const currentMonthName = useMemo(() => getCurrentMonthName(), []);
  const currentMonthIndex = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const getDefaultPaymentMonth = (student, preferredMonth = currentMonthName) => {
    if (!student || !isStudentVacationMonth(student, preferredMonth)) return preferredMonth;
    const payableMonths = new Set(getStudentPayableMonths(student, months));
    const preferredIndex = months.indexOf(preferredMonth);
    for (let offset = 1; offset <= months.length; offset += 1) {
      const candidate = months[(Math.max(preferredIndex, 0) + offset) % months.length];
      if (payableMonths.has(candidate)) return candidate;
    }
    return '';
  };

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 4 }, (_, i) => currentYear + 1 - i);
  }, []);

  const openEditPaymentModal = (payment) => {
    const feeItems = getPaymentFeeItems(payment);
    const findFee = (label) => feeItems.find(f => f.label === label)?.amount || '';
    setEditingPayment(payment);
    setPaymentModalFilter({ diploma: '', major: '', year: '' });
    setPaymentData({
      studentId: payment.studentId || '',
      academicYear: getPaymentAcademicYear(payment) || defaultAcademicYear,
      amount: String(getPaymentBaseAmount(payment) || ''),
      examFee: String(findFee("Frais d'examen") || parseFloat(payment.examFee) || ''),
      registrationFee: String(findFee("Frais d'inscription") || parseFloat(payment.registrationFee) || ''),
      supportFee: String(findFee('Support') || parseFloat(payment.supportFee) || ''),
      month: payment.month || currentMonthName,
      date: payment.date || new Date().toISOString().split('T')[0],
      status: payment.status || 'payé',
      paymentMethod: payment.paymentMethod || 'Espèces'
    });
    setShowPaymentModal(true);
  };

  const exportPaymentsCSV = () => {
    const selectedMonth = paymentMonthFilter || currentMonthName;
    const rows = [['Nom', 'Prénom', 'Filière', 'Année académique', 'Mois', 'Montant (DH)', 'Date', 'Statut']];
    filteredPayments.forEach(p => {
      if (p.isVirtualUnpaid) return;
      const student = resolvePaymentStudent(p);
      rows.push([
        student?.lastName || '',
        student?.firstName || '',
        student?.major || '',
        getPaymentAcademicYear(p),
        p.month,
        getPaymentTotal(p),
        p.date || '',
        getPaymentStatusLabel(p.status)
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `paiements_${selectedMonth}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast('Export CSV généré', 'success');
  };

  React.useEffect(() => {
    if (isDirectorAuth) {
      loadFinancialData();
    }
  }, [isDirectorAuth, loadFinancialData]);

  React.useEffect(() => {
    if (isDirectorAuth) {
      loadTeacherAttendanceForMonth(salaryFilter.month, salaryFilter.year);
    }
  }, [isDirectorAuth, salaryFilter.month, salaryFilter.year, loadTeacherAttendanceForMonth]);

  const handleLogin = (e) => {
    e.preventDefault();
    loginDirector(password);
  };

  const handleSaveRate = async (teacherId) => {
    const newVal = document.getElementById(`rate-${teacherId}`).value;
    const rate = parseFloat(newVal);
    if (!isNaN(rate)) {
      await updateTeacher(teacherId, { hourlyRate: rate });
      showToast('Tarif mis à jour', 'success');
      setEditingTeacherId(null);
    }
  };

  const openPaymentModal = (studentId = '') => {
    const selectedStudent = students.find(student => student.id === studentId);
    const academicYear = paymentAcademicYearFilter ||
      (selectedStudent ? getStudentCurrentAcademicYear(selectedStudent) : '') ||
      defaultAcademicYear;
    const academicStudent = selectedStudent
      ? (getStudentAcademicSnapshot(selectedStudent, academicYear) || selectedStudent)
      : null;
    const preferredMonth = paymentMonthFilter || currentMonthName;
    setEditingPayment(null);
    setPaymentModalFilter({ diploma: '', major: '', year: '' });
    setPaymentData({
      studentId,
      academicYear,
      amount: '',
      examFee: '',
      registrationFee: '',
      supportFee: '',
      month: getDefaultPaymentMonth(academicStudent, preferredMonth),
      date: new Date().toISOString().split('T')[0],
      status: 'payé',
      paymentMethod: 'Espèces'
    });
    setShowPaymentModal(true);
  };

  const resolvePaymentReceiptNumber = (payment) =>
    /^FD\d+$/.test(payment.receiptNumber || '')
      ? payment.receiptNumber
      : getLegacyReceiptNumber(payment, payments, STUDENT_RECEIPT_PREFIX);

  const resolveSalaryReceiptNumber = (salary) =>
    salary.receiptNumber || getLegacyReceiptNumber(salary, salaries, 'F');

  const generateReceipt = async (payment, student) => {
    if (!student) return showToast('Stagiaire introuvable', 'warning');

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
    const feeItems = getPaymentFeeItems(payment);
    const rawLineItems = [
      { label: `Frais de formation - ${payment.month}`, amount: getPaymentBaseAmount(payment) },
      ...feeItems
    ].filter(item => item.amount > 0);
    const lineItems = rawLineItems.length > 8
      ? [
          ...rawLineItems.slice(0, 7),
          {
            label: `Autres frais (${rawLineItems.length - 7})`,
            amount: rawLineItems.slice(7).reduce((sum, item) => sum + item.amount, 0)
          }
        ]
      : rawLineItems;
    const total = getPaymentTotal(payment);
    const receiptNumber = resolvePaymentReceiptNumber(payment, student);

    const drawReceiptCopy = (offsetY, copyLabel) => {
      try {
        doc.addImage(logoBase64, 'JPEG', margin, offsetY + 2.5, 20, 8.5);
      } catch {
        // The receipt remains usable when the optional logo cannot be decoded.
      }
      doc.setFontSize(5.5); doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'bold');
      doc.text(copyLabel, w - margin, offsetY + 5.5, { align: 'right' });
      doc.setFontSize(9.5); doc.setTextColor(35, 35, 35);
      doc.text('RECU DE PAIEMENT', w / 2, offsetY + 11.5, { align: 'center' });
      doc.setDrawColor(200); doc.line(margin, offsetY + 14.5, w - margin, offsetY + 14.5);

      doc.setFontSize(6); doc.setTextColor(80, 80, 80); doc.setFont('helvetica', 'normal');
      doc.text(`N Recu: ${receiptNumber}`, margin, offsetY + 19);
      doc.text(`Date: ${payment.date}`, w - margin, offsetY + 19, { align: 'right' });

      doc.setFillColor(248, 250, 252); doc.rect(margin, offsetY + 22, w - (margin * 2), 18, 'F');
      doc.setDrawColor(226, 232, 240); doc.rect(margin, offsetY + 22, w - (margin * 2), 18, 'S');
      doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
      doc.text('Stagiaire', margin + 3, offsetY + 27);
      doc.text('Paiement', w / 2 + 3, offsetY + 27);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5);
      doc.text(doc.splitTextToSize(`${student.firstName || ''} ${student.lastName || ''}`.trim(), 56)[0] || '-', margin + 3, offsetY + 32);
      doc.text(doc.splitTextToSize(`Filiere: ${student.major || '-'}`, 56)[0] || '-', margin + 3, offsetY + 37);
      doc.text(`Mois: ${payment.month}`, w / 2 + 3, offsetY + 32);
      doc.text(`Annee: ${getPaymentAcademicYear(payment) || '-'} - ${payment.paymentMethod || 'Espèces'}`, w / 2 + 3, offsetY + 37);

      let y = offsetY + 47;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
      doc.text('Designation', margin, y);
      doc.text('Montant', w - margin, y, { align: 'right' });
      y += 2;
      doc.setDrawColor(210); doc.line(margin, y, w - margin, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5);

      lineItems.forEach(item => {
        y += 4;
        doc.text(doc.splitTextToSize(item.label, w - (margin * 2) - 30)[0] || '-', margin, y);
        doc.text(`${formatMoney(item.amount)} DH`, w - margin, y, { align: 'right' });
      });

      y += 4;
      doc.setDrawColor(35); doc.line(margin, y, w - margin, y);
      y += 5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.text('TOTAL PAYE', margin, y);
      doc.text(`${formatMoney(total)} DH`, w - margin, y, { align: 'right' });

      doc.setFontSize(5.5); doc.setFont('helvetica', 'italic');
      doc.text('Signature et Cachet IPFP', w - margin, offsetY + 99, { align: 'right' });
    };

    drawReceiptCopy(0, 'COPIE STAGIAIRE');
    doc.setDrawColor(130, 130, 130);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(8, halfPageHeight, w - 8, halfPageHeight);
    doc.setLineDashPattern([], 0);
    drawReceiptCopy(halfPageHeight, 'COPIE ADMINISTRATION');

    doc.save(`Recu_${receiptNumber}_${student.lastName}_${payment.month}.pdf`);
    showToast('Reçu généré', 'success');
  };

  const generateTeacherReceipt = async (salary) => {
    const teacher = teachers.find(t => t.id === salary.teacherId);
    const monthIndex = months.indexOf(salary.month);
    const sessionRows = (Array.isArray(salary.sessions) && salary.sessions.length > 0)
      ? salary.sessions
      : getTeacherMonthlySessionRows(teacherAttendance, salary.teacherId, monthIndex, salary.year, schedules, getActiveScheduleModule);
    const totalHours = Math.round((sessionRows.reduce((sum, row) => sum + (parseFloat(row.hours) || 0), 0) || parseFloat(salary.hours) || 0) * 100) / 100;
    const hourlyRate = parseFloat(salary.hourlyRate) || parseFloat(teacher?.hourlyRate) || (totalHours > 0 ? (parseFloat(salary.amount) || 0) / totalHours : 0);

    const [{ jsPDF }, { loadLogoDataUrl }] = await Promise.all([
      import('jspdf'),
      import('../utils/loadLogoDataUrl'),
    ]);
    const logoBase64 = await loadLogoDataUrl();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
    const w = doc.internal.pageSize.getWidth();
    const margin = 10;
    let y = 8;

    try {
      doc.addImage(logoBase64, 'JPEG', margin, y, 34, 15);
    } catch {
      // The receipt remains usable when the optional logo cannot be decoded.
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(35, 35, 35);
    doc.text('RECU FORMATEUR', w / 2, 28, { align: 'center' });
    doc.setDrawColor(200); doc.line(margin, 33, w - margin, 33);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
    const salaryReceiptNumber = resolveSalaryReceiptNumber(salary);
    doc.text(`N Recu: ${salaryReceiptNumber}`, margin, 42);
    doc.text(`Date: ${salary.date || new Date().toISOString().split('T')[0]}`, w - margin, 42, { align: 'right' });
    doc.text(`Formateur: ${salary.teacherName || teacher?.name || '-'}`, margin, 50);
    doc.text(`Periode: ${salary.month} ${salary.year}`, margin, 57);
    doc.text(`Tarif: ${formatMoney(hourlyRate)} DH/h`, w - margin, 57, { align: 'right' });

    y = 70;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.setFillColor(248, 250, 252); doc.rect(margin, y - 6, w - (margin * 2), 8, 'F');
    doc.text('Date', margin + 2, y);
    doc.text('Module', margin + 25, y);
    doc.text('Horaire', w - 42, y, { align: 'right' });
    doc.text('H', w - margin - 2, y, { align: 'right' });
    doc.setDrawColor(226, 232, 240); doc.line(margin, y + 3, w - margin, y + 3);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);

    if (sessionRows.length === 0) {
      y += 12;
      doc.text('Aucune seance detaillee disponible pour cette periode.', margin + 2, y);
    } else {
      sessionRows.forEach((row, index) => {
        if (y > 166) {
          doc.addPage('a5', 'portrait');
          y = 18;
        }
        y += 8;
        if (index % 2 === 0) {
          doc.setFillColor(252, 252, 252);
          doc.rect(margin, y - 5, w - (margin * 2), 7, 'F');
        }
        const moduleText = doc.splitTextToSize(row.module || '-', 58)[0] || '-';
        doc.text(row.date || '-', margin + 2, y);
        doc.text(moduleText, margin + 25, y);
        doc.text(row.timeSlot || '-', w - 42, y, { align: 'right' });
        doc.text(`${parseFloat(row.hours) || 0}`, w - margin - 2, y, { align: 'right' });
      });
    }

    y = Math.min(y + 16, 178);
    doc.setDrawColor(35); doc.line(margin, y, w - margin, y);
    y += 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('Total heures travaillees', margin, y);
    doc.text(`${totalHours} h`, w - margin, y, { align: 'right' });
    y += 8;
    doc.text('Net a payer', margin, y);
    doc.text(`${formatMoney(salary.amount)} DH`, w - margin, y, { align: 'right' });

    doc.setFontSize(8); doc.setFont('helvetica', 'italic');
    doc.text('Signature formateur', margin, 196);
    doc.text('Signature et Cachet IPFP', w - margin - 38, 196);
    doc.save(`Recu_${salaryReceiptNumber}_Formateur_${(salary.teacherName || 'Formateur').replace(/\s+/g, '_')}_${salary.month}_${salary.year}.pdf`);
    showToast('Reçu formateur généré', 'success');
  };

  const monthlyPaymentRows = useMemo(() => {
    const selectedMonth = paymentMonthFilter || currentMonthName;

    // Filter real payments by month and optional academic year filter
    const paymentsForMonth = payments.filter(p => {
      const isMonthMatch = !selectedMonth || (p.month || '').toLowerCase() === selectedMonth.toLowerCase();
      if (!isMonthMatch) return false;
      if (paymentAcademicYearFilter) {
        const pYear = getPaymentAcademicYear(p);
        if (pYear !== paymentAcademicYearFilter) return false;
      }
      return true;
    });

    const paidStudentIds = new Set(paymentsForMonth.map(p => p.studentId).filter(Boolean));

    // Target students for virtual unpaid calculation
    let candidateStudents = activeStudents;
    if (paymentAcademicYearFilter) {
      candidateStudents = (students || [])
        .map(student => getStudentAcademicSnapshot(student, paymentAcademicYearFilter))
        .filter(Boolean);
    }

    const monthlyRows = [
      ...paymentsForMonth,
      ...candidateStudents
        .filter(student => !isStudentVacationMonth(student, selectedMonth))
        .filter(student => !paidStudentIds.has(student.id))
        .map(student => ({
          id: `unpaid-${student.id}-${selectedMonth}`,
          studentId: student.id,
          month: selectedMonth,
          amount: 0,
          date: '-',
          status: 'impayé',
          isVirtualUnpaid: true,
          academicYear: paymentAcademicYearFilter || student.academicYear || '',
          studentSnapshot: {
            firstName: student.firstName || '',
            lastName: student.lastName || '',
            regNo: student.regNo || '',
            diploma: student.diploma || '',
            major: student.major || '',
            year: student.year || '',
          },
        }))
    ];

    return monthlyRows;
  }, [payments, activeStudents, students, paymentMonthFilter, paymentAcademicYearFilter, currentMonthName]);

  const paymentStatusCounts = useMemo(() => {
    const paidStudentIds = new Set();
    let unpaid = 0;
    monthlyPaymentRows.forEach(row => {
      if (row.isVirtualUnpaid) {
        unpaid += 1;
        return;
      }
      if (row.studentId) paidStudentIds.add(row.studentId);
    });

    return {
      paid: paidStudentIds.size,
      unpaid
    };
  }, [monthlyPaymentRows]);

  const filteredPayments = monthlyPaymentRows.filter(p => {
    const student = resolvePaymentStudent(p);
    if (!student) return false;
    if (paymentStatusFilter && getPaymentStatusKey(p.status) !== paymentStatusFilter) return false;
    if (paymentAcademicYearFilter) {
      const pYear = p.isVirtualUnpaid ? (p.academicYear || student.academicYear) : getPaymentAcademicYear(p);
      if (pYear && pYear !== paymentAcademicYearFilter) return false;
    }
    const pYear = getPaymentAcademicYear(p);
    const searchStr = `${student.firstName} ${student.lastName} ${p.month} ${pYear} ${p.receiptNumber || ''}`.toLowerCase();
    return searchStr.includes(debouncedSearch.toLowerCase());
  });

  const paginatedPayments = filteredPayments.slice((paymentsPage - 1) * paymentsPerPage, paymentsPage * paymentsPerPage);

  const totalPaymentsPages = Math.ceil(filteredPayments.length / paymentsPerPage);

  React.useEffect(() => {
    setPaymentsPage(prev => Math.min(prev, Math.max(1, totalPaymentsPages)));
  }, [totalPaymentsPages]);

  const paymentAcademicStudents = useMemo(() => {
    const targetAcademicYear = paymentData.academicYear || defaultAcademicYear;
    return (students || [])
      .map(student => getStudentAcademicSnapshot(student, targetAcademicYear))
      .filter(Boolean);
  }, [students, paymentData.academicYear, defaultAcademicYear]);

  const modalDiplomas = useMemo(() => [...new Set(paymentAcademicStudents.map(s => s.diploma).filter(Boolean))].sort(), [paymentAcademicStudents]);
  const modalMajors = useMemo(() => {
    const base = paymentModalFilter.diploma ? paymentAcademicStudents.filter(s => s.diploma === paymentModalFilter.diploma) : paymentAcademicStudents;
    return [...new Set(base.map(s => s.major).filter(Boolean))].sort();
  }, [paymentAcademicStudents, paymentModalFilter.diploma]);
  const modalYears = useMemo(() => {
    let base = paymentAcademicStudents;
    if (paymentModalFilter.diploma) base = base.filter(s => s.diploma === paymentModalFilter.diploma);
    if (paymentModalFilter.major) base = base.filter(s => s.major === paymentModalFilter.major);
    return [...new Set(base.map(s => s.year).filter(Boolean))].sort();
  }, [paymentAcademicStudents, paymentModalFilter.diploma, paymentModalFilter.major]);
  const modalStudents = useMemo(() => {
    return paymentAcademicStudents.filter(s => {
      if (paymentModalFilter.diploma && s.diploma !== paymentModalFilter.diploma) return false;
      if (paymentModalFilter.major && s.major !== paymentModalFilter.major) return false;
      if (paymentModalFilter.year && s.year !== paymentModalFilter.year) return false;
      return true;
    });
  }, [paymentAcademicStudents, paymentModalFilter]);
  const selectedPaymentStudent = useMemo(
    () => paymentAcademicStudents.find(student => student.id === paymentData.studentId) || null,
    [paymentAcademicStudents, paymentData.studentId]
  );
  const paymentMonthOptions = useMemo(() => months.map(month => {
    const isVacation = !!selectedPaymentStudent && isStudentVacationMonth(selectedPaymentStudent, month);
    return {
      value: month,
      label: isVacation ? `${month} · Vacances (non payable)` : month,
      disabled: isVacation,
    };
  }), [months, selectedPaymentStudent]);
  const selectedMonthIsVacation = !!selectedPaymentStudent &&
    isStudentVacationMonth(selectedPaymentStudent, paymentData.month);

  const calculatedSalaries = useMemo(() => {
    return teachers.map(t => {
      const hours = getTeacherMonthlyHours(teacherAttendance, t.id, salaryFilter.month, salaryFilter.year, schedules, getActiveScheduleModule);
      const hourlyRate = parseFloat(t.hourlyRate) || 0;
      const total = hours * hourlyRate;
      const monthName = months[salaryFilter.month];
      const isPaid = salaries.some(s => s.teacherId === t.id && s.month === monthName && s.year === salaryFilter.year);
      return { ...t, hours, hourlyRate, total, isPaid };
    });
  }, [teachers, teacherAttendance, salaryFilter, salaries, schedules, getActiveScheduleModule, months]);

  const filteredTeachers = useMemo(() => {
    const q = debouncedTeacherSearch.trim().toLowerCase();
    return calculatedSalaries.filter(t => {
      if (salaryStatusFilter && (t.isPaid ? 'paid' : 'unpaid') !== salaryStatusFilter) return false;
      if (!q) return true;
      return `${t.name}`.toLowerCase().includes(q);
    });
  }, [calculatedSalaries, debouncedTeacherSearch, salaryStatusFilter]);

  const salaryStatusCounts = useMemo(() => {
    return calculatedSalaries.reduce((acc, teacher) => {
      if (teacher.isPaid) {
        acc.paid += 1;
      } else {
        acc.unpaid += 1;
      }
      return acc;
    }, { paid: 0, unpaid: 0 });
  }, [calculatedSalaries]);

  const paginatedTeachers = useMemo(() => {
    return filteredTeachers.slice((teachersPage - 1) * teachersPerPage, teachersPage * teachersPerPage);
  }, [filteredTeachers, teachersPage, teachersPerPage]);

  const totalTeachersPages = Math.ceil(filteredTeachers.length / teachersPerPage);

  React.useEffect(() => {
    setTeachersPage(prev => Math.min(prev, Math.max(1, totalTeachersPages)));
  }, [totalTeachersPages]);

  const filteredSalaries = useMemo(() => {
    const targetMonth = months[salaryFilter.month];
    const targetYear = salaryFilter.year.toString();
    return (salaries || []).filter(s => {
      const sMonth = s.month;
      const sYear = s.year ? s.year.toString() : '';
      return sMonth === targetMonth && sYear === targetYear;
    });
  }, [salaries, salaryFilter, months]);

  const paginatedSalaries = useMemo(() => {
    return filteredSalaries.slice((salariesPage - 1) * itemsPerPage, salariesPage * itemsPerPage);
  }, [filteredSalaries, salariesPage, itemsPerPage]);
  
  const totalSalariesPages = Math.ceil(filteredSalaries.length / itemsPerPage);

  React.useEffect(() => {
    setSalariesPage(prev => Math.min(prev, Math.max(1, totalSalariesPages)));
  }, [totalSalariesPages]);

  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(e => {
      if (expenseFilter.month && e.month !== expenseFilter.month) return false;
      if (expenseFilter.year && e.year !== expenseFilter.year) return false;
      if (expenseFilter.category && e.category !== expenseFilter.category) return false;
      return true;
    });
  }, [expenses, expenseFilter]);

  const filteredExpensesTotal = useMemo(() =>
    filteredExpenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0),
    [filteredExpenses]
  );

  const paginatedExpenses = useMemo(() => {
    return filteredExpenses.slice((expensesPage - 1) * expensesPerPage, expensesPage * expensesPerPage);
  }, [filteredExpenses, expensesPage, expensesPerPage]);

  const totalExpensesPages = Math.ceil(filteredExpenses.length / expensesPerPage);

  React.useEffect(() => {
    setExpensesPage(prev => Math.min(prev, Math.max(1, totalExpensesPages)));
  }, [totalExpensesPages]);

  const stats = useMemo(() => {
    const selectedMonth = summaryMonthFilter || currentMonthName;
    const isSelectedMonth = (month) => (month || '').toLowerCase() === selectedMonth.toLowerCase();
    const getMonthFromDate = (date) => {
      const monthIndex = Number(String(date || '').split('-')[1]) - 1;
      return months[monthIndex] || '';
    };
    const monthPayments = payments.filter(p => isSelectedMonth(p.month));
    const totalRevenue = monthPayments.reduce((acc, p) => acc + getPaymentTotal(p), 0);
    const totalSalaries = salaries
      .filter(s => isSelectedMonth(s.month))
      .reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
    const totalOtherExpenses = (expenses || [])
      .filter(e => isSelectedMonth(e.month))
      .reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
    const totalExpenses = totalSalaries + totalOtherExpenses;
    const payableStudents = activeStudents.filter(student => !isStudentVacationMonth(student, selectedMonth));
    const activeStudentIds = new Set(payableStudents.map(student => student.id));
    const paidStudentIds = new Set(monthPayments.map(p => p.studentId).filter(id => activeStudentIds.has(id)));
    const totalStudents = payableStudents.length;
    const tauxRecouvrement = totalStudents > 0 ? Math.round((paidStudentIds.size / totalStudents) * 100) : 0;
    const continuousTotals = continuousTrainings.reduce((totals, training) => {
      const trainingRevenue = ctStudents
        .filter(student => student?.trainingId === training?.id)
        .reduce((sum, student) => {
          const monthlyPayments = (student?.payments || []).filter(payment =>
            isSelectedMonth(payment?.month || getMonthFromDate(payment?.date))
          );
          return sum + monthlyPayments.reduce((paymentSum, payment) => paymentSum + Number(payment?.amount || 0), 0);
        }, 0);
      const teacherShare = getContinuousTeacherSalary(training, trainingRevenue);
      return {
        revenue: totals.revenue + trainingRevenue,
        salaries: totals.salaries + teacherShare
      };
    }, { revenue: 0, salaries: 0 });
    const globalCtNet = continuousTotals.revenue - continuousTotals.salaries;
    const globalDipNet = totalRevenue - totalExpenses;
    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      salariesTotal: totalSalaries,
      otherExpenses: totalOtherExpenses,
      balance: totalRevenue - totalExpenses,
      pendingSalaries: calculatedSalaries.filter(s => !s.isPaid).reduce((acc, s) => acc + s.total, 0),
      tauxRecouvrement,
      paidStudents: paidStudentIds.size,
      totalStudents,
      globalCtNet,
      globalDipNet,
      globalTotalNet: globalCtNet + globalDipNet
    };
  }, [
    payments, salaries, expenses, calculatedSalaries, summaryMonthFilter, currentMonthName,
    activeStudents, continuousTrainings, ctStudents, months
  ]);

  const monthlyTrendData = useMemo(() => {
    return months.map(month => {
      const isM = (m) => (m || '').toLowerCase() === month.toLowerCase();
      const revenue = payments.filter(p => isM(p.month)).reduce((acc, p) => acc + getPaymentTotal(p), 0);
      const salariesAmt = salaries.filter(s => isM(s.month)).reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
      const otherExp = (expenses || []).filter(e => isM(e.month)).reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
      return {
        name: month.substring(0, 3),
        Revenus: revenue,
        Charges: salariesAmt + otherExp
      };
    }).filter(d => d.Revenus > 0 || d.Charges > 0);
  }, [payments, salaries, expenses, months]);

  const overdueMap = useMemo(() => {
    const currentMonthIdx = new Date().getMonth();
    const result = {};
    activeStudents.forEach(student => {
      const paidMonthKeys = new Set(
        payments
          .filter(p => p.studentId === student.id && getPaymentStatusKey(p.status) === 'paid')
          .map(p => (p.month || '').toLowerCase())
      );
      let overdue = 0;
      for (let i = 0; i < 6; i++) {
        const mIdx = (currentMonthIdx - i + 12) % 12;

        // L'application a commencé en Mai (index 4). On ignore les mois précédents.
        if (mIdx < 4) {
          break;
        }

        if (isStudentVacationMonth(student, months[mIdx])) {
          continue;
        }

        if (!paidMonthKeys.has(months[mIdx].toLowerCase())) {
          overdue++;
        } else {
          break;
        }
      }
      if (overdue >= 2) result[student.id] = overdue;
    });
    return result;
  }, [activeStudents, payments, months]);

  const overdueStudents = useMemo(() => {
    return activeStudents
      .filter(s => overdueMap[s.id])
      .sort((a, b) =>
        overdueMap[b.id] - overdueMap[a.id] ||
        `${a.lastName || ''} ${a.firstName || ''}`.localeCompare(`${b.lastName || ''} ${b.firstName || ''}`)
      );
  }, [activeStudents, overdueMap]);

  const paginatedOverdueStudents = useMemo(() => {
    return overdueStudents.slice((overduePage - 1) * overduePerPage, overduePage * overduePerPage);
  }, [overdueStudents, overduePage, overduePerPage]);

  const totalOverduePages = Math.ceil(overdueStudents.length / overduePerPage);

  React.useEffect(() => {
    setOverduePage(prev => Math.min(prev, Math.max(1, totalOverduePages)));
  }, [totalOverduePages]);

  const annualSummary = useMemo(() => {
    const getYear = (item) => {
      if (item.date && String(item.date).length >= 4) return parseInt(String(item.date).substring(0, 4));
      if (item.year) return parseInt(item.year);
      return new Date().getFullYear();
    };
    let cumBalance = 0;
    return months.map((month) => {
      const isM = (m) => (m || '').toLowerCase() === month.toLowerCase();
      const revenue = payments.filter(p => isM(p.month) && getYear(p) === annualYear).reduce((acc, p) => acc + getPaymentTotal(p), 0);
      const salaryAmt = salaries.filter(s => isM(s.month) && parseInt(s.year) === annualYear).reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
      const expenseAmt = (expenses || []).filter(e => isM(e.month) && parseInt(e.year) === annualYear).reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
      const charges = salaryAmt + expenseAmt;
      const balance = revenue - charges;
      cumBalance += balance;
      return { month, revenue, salaryAmt, expenseAmt, charges, balance, cumBalance };
    });
  }, [payments, salaries, expenses, months, annualYear]);

  const allDailyExpenseStats = useMemo(() => {
    const days = new Map();
    const addDailyAmount = (date, key, amount) => {
      const day = date || 'Sans date';
      const current = days.get(day) || { date: day, salaries: 0, otherExpenses: 0, payments: 0 };
      current[key] += amount;
      days.set(day, current);
    };

    salaries.forEach(s => addDailyAmount(s.date, 'salaries', parseFloat(s.amount) || 0));
    (expenses || []).forEach(e => addDailyAmount(e.date, 'otherExpenses', parseFloat(e.amount) || 0));
    payments.forEach(p => addDailyAmount(p.date, 'payments', getPaymentTotal(p)));

    return Array.from(days.values())
      .map(day => {
        day.charges = day.salaries + day.otherExpenses;
        day.bilan = day.payments - day.charges;
        return day;
      })
      .sort((a, b) => {
        if (a.date === 'Sans date') return 1;
        if (b.date === 'Sans date') return -1;
        return b.date.localeCompare(a.date);
      });
  }, [salaries, expenses, payments]);

  const dailyExpenseStats = useMemo(() => {
    let filtered = allDailyExpenseStats;
    if (dailyStatsDate) {
      filtered = filtered.filter(day => day.date >= dailyStatsDate);
    }
    if (dailyStatsEndDate) {
      filtered = filtered.filter(day => day.date <= dailyStatsEndDate);
    }
    return filtered;
  }, [allDailyExpenseStats, dailyStatsDate, dailyStatsEndDate]);

  const paginatedDailyExpenseStats = useMemo(() => {
    return dailyExpenseStats.slice((dailyStatsPage - 1) * dailyStatsPerPage, dailyStatsPage * dailyStatsPerPage);
  }, [dailyExpenseStats, dailyStatsPage, dailyStatsPerPage]);

  const totalDailyStatsPages = Math.ceil(dailyExpenseStats.length / dailyStatsPerPage);

  React.useEffect(() => {
    setDailyStatsPage(prev => Math.min(prev, Math.max(1, totalDailyStatsPages)));
  }, [totalDailyStatsPages]);

  const maxDailyExpense = useMemo(() =>
    Math.max(...dailyExpenseStats.map(day => day.total), 0),
    [dailyExpenseStats]
  );

  if (!isDirectorAuth) {
    return (
      <div className="finance-admin-page finance-access-premium-page" style={{
        minHeight: 'calc(100vh - 150px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', position: 'relative', overflow: 'hidden', background: 'var(--bg-page)', borderRadius: '24px'
      }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%', background: 'rgba(176, 104, 185, 0.04)', filter: 'blur(100px)', borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40%', height: '40%', background: 'rgba(254, 205, 8, 0.03)', filter: 'blur(100px)', borderRadius: '50%' }}></div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="finance-access-premium-shell" style={{ width: '100%', maxWidth: '380px', position: 'relative', zIndex: 10 }}>
          
          <div className="finance-access-premium-heading" style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ 
                width: '56px', height: '56px', 
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(234, 179, 8, 0.15) 100%)', 
                border: '1px solid rgba(139, 92, 246, 0.25)',
                borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                color: '#8b5cf6'
              }}>
                <Lock size={24} />
              </div>
            </div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '4px' }}>
              ESPACE DIRECTION
            </h1>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: '400' }}>
              Accès restreint à la gestion financière de l'IPFP
            </p>
          </div>

          <div className="glass-premium finance-access-premium-card" style={{ padding: '28px', borderRadius: '24px' }}>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '2px' }}>
                  Mot de passe
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                    className="input-premium" style={{ width: '100%', paddingLeft: '42px', paddingRight: '44px', paddingTop: '12px', paddingBottom: '12px' }}
                    placeholder="••••••••" required autoFocus />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex' }}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-modern primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', fontWeight: '700', letterSpacing: '0.02em' }}>
                Déverrouiller <ArrowRight size={16} style={{ marginLeft: '6px' }} />
              </button>
            </form>
          </div>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <button type="button" onClick={logout} 
              style={{ 
                background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', 
                fontWeight: '600', cursor: 'pointer', textDecoration: 'underline', transition: 'color 0.2s' 
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              Se déconnecter de l'application
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="section-padding finance-admin-page">
      <div className="finance-premium-header">
        <div className="finance-premium-header-icon">
          <Wallet size={24} />
        </div>
        <div className="finance-premium-header-copy">
          <span className="finance-premium-eyebrow">Pilotage financier</span>
          <h1>Gestion Financière</h1>
          <p>Tableau de bord des flux, charges et résultats nets</p>
        </div>
        <div className="finance-header-actions">
          <div className="finance-month-compact" data-tooltip="Indicateurs du mois" aria-label="Indicateurs du mois">
            <CalendarDays size={15} />
            <FilterSelect
              className="finance-month-compact-select"
              value={summaryMonthFilter}
              onChange={(val) => setSummaryMonthFilter(val)}
              options={months.map(m => ({ value: m, label: m }))}
            />
          </div>
          <button
            onClick={logoutDirector}
            className="btn-modern"
            style={{
              background: 'rgba(234, 179, 8, 0.14)',
              color: '#a16207',
              border: '1px solid rgba(234, 179, 8, 0.35)'
            }}
            data-tooltip="Verrouiller l'espace direction"
            aria-label="Verrouiller l'espace direction"
          >
            <Lock size={16} style={{ marginRight: '8px' }} /> Verrouiller
          </button>
        </div>
        <div className="finance-premium-header-orb" aria-hidden="true">
          <BarChart3 size={112} />
        </div>
      </div>

      <div className="finance-net-grid" aria-label={`Gains nets pour ${summaryMonthFilter}`}>
        <GlobalStatCard
          title="Formation continue"
          amount={stats.globalCtNet}
          icon={Receipt}
          tone="continuous"
          month={summaryMonthFilter}
          helper="Encaissements moins part formateurs"
        />
        <GlobalStatCard
          title="Formations diplômantes"
          amount={stats.globalDipNet}
          icon={BarChart3}
          tone="diploma"
          month={summaryMonthFilter}
          helper="Encaissements moins salaires et charges"
          delay={0.04}
        />
        <GlobalStatCard
          title="Bénéfice total"
          amount={stats.globalTotalNet}
          icon={TrendingUp}
          tone="total"
          month={summaryMonthFilter}
          helper="Formation continue + diplômante"
          delay={0.08}
        />
      </div>

      <div className="finance-section-divider">
        <span>Gestion financière des formations diplômantes</span>
      </div>

      <div className="finance-summary-grid">
        <StatCard title="Revenus Totaux" value={stats.revenue} icon={TrendingUp} tone="revenue" month={summaryMonthFilter} helper="Encaissements du mois" />
        <StatCard title="Total Charges" value={stats.expenses} icon={TrendingDown} tone="expense" month={summaryMonthFilter} helper="Salaires et autres charges" />
        <StatCard title="Bénéfice Net" value={stats.balance} icon={Wallet} tone="balance" month={summaryMonthFilter} helper={stats.balance >= 0 ? 'Solde positif' : 'Solde à surveiller'} />
        <RecoveryCard
          value={stats.tauxRecouvrement}
          paid={stats.paidStudents}
          total={stats.totalStudents}
          month={summaryMonthFilter}
        />
      </div>

      <div className="modern-tabs-container finance-premium-tabs" style={{ marginBottom: 'var(--space-6)' }}>
        <button onClick={() => setActiveTab('payments')} className={`modern-tab ${activeTab === 'payments' ? 'active' : ''}`}>
          Paiements
          {overdueStudents.length > 0 && (
            <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '900', background: 'rgba(220,38,38,0.12)', color: '#dc2626', borderRadius: '999px', padding: '1px 7px' }}>
              {overdueStudents.length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('salaries')} className={`modern-tab ${activeTab === 'salaries' ? 'active' : ''}`}>Salaires</button>
        <button onClick={() => setActiveTab('expenses')} className={`modern-tab ${activeTab === 'expenses' ? 'active' : ''}`}>
          Autres Charges
          {(expenses || []).length > 0 && (
            <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '900', background: 'rgba(220,38,38,0.12)', color: '#dc2626', borderRadius: '999px', padding: '1px 7px' }}>
              {(expenses || []).length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('stats')} className={`modern-tab ${activeTab === 'stats' ? 'active' : ''}`}>Analyses</button>
        <button onClick={() => setActiveTab('annual')} className={`modern-tab ${activeTab === 'annual' ? 'active' : ''}`}>
          <Table2 size={14} style={{ marginRight: '5px' }} />Récap. Annuel
        </button>
      </div>

      {activeTab === 'payments' && (
        <motion.div className="finance-tab-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="finance-payment-filter-toolbar">
          <div className="glass-card finance-filter-card">
            <div className="finance-filter-row finance-filter-row-primary">
              <div className="finance-filter-search finance-filter-search-wide">
                <Search size={16} className="finance-filter-search-icon" />
                <input
                  type="text"
                  className="input-premium"
                  placeholder="Rechercher un stagiaire ou mois..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPaymentsPage(1);
                  }}
                />
              </div>
              <FilterSelect
                value={paymentAcademicYearFilter}
                placeholder="Année académique"
                options={[
                  { value: '', label: 'Toutes les années académiques' },
                  ...availableAcademicYears.map(y => ({ value: y, label: `Année ${y}` }))
                ]}
                onChange={(value) => {
                  setPaymentAcademicYearFilter(value);
                  setPaymentsPage(1);
                }}
              />
              <FilterSelect
                value={paymentStatusFilter}
                placeholder="Tous les statuts"
                options={[
                  { value: '', label: 'Tous les statuts' },
                  { value: 'paid', label: 'Payé' },
                  { value: 'unpaid', label: 'Impayé' }
                ]}
                onChange={(value) => {
                  setPaymentStatusFilter(value);
                  setPaymentsPage(1);
                }}
              />
              <FilterSelect
                value={paymentMonthFilter}
                placeholder="Mois"
                options={months.map(m => ({ value: m, label: m }))}
                onChange={(value) => {
                  setPaymentMonthFilter(value);
                  setPaymentsPage(1);
                }}
              />
              {(searchTerm || paymentStatusFilter || paymentAcademicYearFilter !== defaultAcademicYear || paymentMonthFilter !== currentMonthName) && (
                <button
                  className="action-btn finance-filter-reset"
                  aria-label="Réinitialiser les filtres"
                  onClick={() => {
                    setSearchTerm('');
                    setPaymentStatusFilter('');
                    setPaymentAcademicYearFilter(defaultAcademicYear);
                    setPaymentMonthFilter(currentMonthName);
                    setPaymentsPage(1);
                  }}
                >
                  <RotateCcw size={15} />
                </button>
              )}
            </div>
          </div>
          <div className="finance-payment-actions-group">
            <div className="finance-payment-status-inline">
              <div
                className="finance-payment-status-card finance-payment-status-paid"
                data-tooltip={`Stagiaires payés · ${paymentMonthFilter}`}
                aria-label={`Stagiaires payés: ${paymentStatusCounts.paid}`}
              >
                <Check size={15} />
                <span className="finance-payment-status-text">Payés</span>
                <span className="finance-payment-status-value">{paymentStatusCounts.paid.toLocaleString()}</span>
              </div>
              <div
                className="finance-payment-status-card finance-payment-status-unpaid"
                data-tooltip={`Stagiaires impayés · ${paymentMonthFilter}`}
                aria-label={`Stagiaires impayés: ${paymentStatusCounts.unpaid}`}
              >
                <RotateCcw size={14} />
                <span className="finance-payment-status-text">Impayés</span>
                <span className="finance-payment-status-value">{paymentStatusCounts.unpaid.toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={() => openPaymentModal()}
              className="btn-modern primary finance-payment-add-button"
            >
              <Plus size={16} style={{ marginRight: '8px' }} /> Enregistrer Paiement
            </button>
          </div>
          </div>

          <div className="glass-card" style={{ overflow: 'hidden' }}>
            {loading ? <TableSkeleton rows={8} /> : (
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)' }}>
                    <th style={thStyle}>N° Reçu</th>
                    <th style={thStyle}>Stagiaire</th>
                    <th style={thStyle}>Période</th>
                    <th style={thStyle}>Montant</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Statut</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 ? (
                    <tr><td colSpan="7"><EmptyState title="Aucun paiement" message="Aucune transaction trouvée pour cette recherche." icon="search" /></td></tr>
                  ) : paginatedPayments.map(p => {
                    const student = resolvePaymentStudent(p);
                    const paymentStatus = getPaymentStatusKey(p.status);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '900', color: 'var(--primary)' }}>
                            {p.isVirtualUnpaid ? '—' : resolvePaymentReceiptNumber(p, student)}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <p style={{ fontWeight: '700', fontSize: 'var(--text-sm)' }}>{student?.firstName} {student?.lastName}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {student?.major} {student && <span style={{ fontWeight: '600', color: 'var(--primary)', marginLeft: '6px' }}>· Cycle {getStudentStudyCycleRange(student)}</span>}
                          </p>
                          {overdueMap[student?.id] && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px',
                              fontSize: '10px', fontWeight: '800', color: '#dc2626',
                              background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
                              borderRadius: '999px', padding: '2px 8px'
                            }}>
                              <AlertTriangle size={10} /> En retard · {overdueMap[student.id]} mois
                            </span>
                          )}
                          {previousYearArrearsMap[student?.id] && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', marginLeft: '4px',
                              fontSize: '10px', fontWeight: '800', color: '#b45309',
                              background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)',
                              borderRadius: '999px', padding: '2px 8px'
                            }}>
                              <AlertTriangle size={10} /> Arriérés 1ère année ({previousYearArrearsMap[student.id].unpaidCount} mois)
                            </span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: '700' }}>{p.month}</span>
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: '600' }}>
                            {p.isVirtualUnpaid ? (p.academicYear || student?.academicYear || '') : (getPaymentAcademicYear(p) || '')}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: '900', color: p.isVirtualUnpaid ? '#a16207' : 'var(--success)' }}>{formatMoney(getPaymentTotal(p))} DH</span>
                          {!p.isVirtualUnpaid && getPaymentFeeItems(p).length > 0 && (
                            <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-faint)', marginTop: '3px' }}>
                              Frais inclus
                            </p>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.date}</p>
                          {!p.isVirtualUnpaid && (
                            <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', marginTop: '3px' }}>
                              {p.paymentMethod || 'Espèces'}
                            </p>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span className={`badge-status ${paymentStatus === 'paid' ? 'success' : 'pending'}`}>
                            {getPaymentStatusLabel(p.status)}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            {p.isVirtualUnpaid ? (
                              <button
                                onClick={() => openPaymentModal(p.studentId)}
                                className="btn-modern"
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  background: 'rgba(234,179,8,0.10)',
                                  border: '1px solid rgba(234,179,8,0.25)',
                                  color: '#a16207'
                                }}
                              >
                                <CreditCard size={14} style={{ marginRight: '6px' }} /> Encaisser
                              </button>
                            ) : (
                              <>
                                <motion.button
                                  whileHover={{ scale: 1.08, translateY: -1 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => openEditPaymentModal(p)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)',
                                    color: '#2563eb', cursor: 'pointer', transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#fff'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.08)'; e.currentTarget.style.color = '#2563eb'; }}
                                  aria-label="Modifier"
                                >
                                  <Edit3 size={15} />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.08, translateY: -1 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => generateReceipt(p, student)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: 'rgba(176, 104, 185, 0.08)', border: '1px solid rgba(176, 104, 185, 0.15)',
                                    color: 'var(--primary)', cursor: 'pointer', transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = '#ffffff'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(176, 104, 185, 0.08)'; e.currentTarget.style.color = 'var(--primary)'; }}
                                  aria-label="Reçu PDF"
                                >
                                  <FileDown size={16} />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.08, translateY: -1 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={async () => {
                                    if (await confirmAction({ title: "Supprimer paiement ?", message: "Voulez-vous supprimer ce reçu de paiement ?", type: "danger" })) {
                                      deletePayment(p.id);
                                    }
                                  }}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)',
                                    color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#ffffff'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.color = '#ef4444'; }}
                                  aria-label="Supprimer"
                                >
                                  <Trash2 size={16} />
                                </motion.button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <Pagination
            currentPage={paymentsPage}
            totalPages={totalPaymentsPages}
            totalItems={filteredPayments.length}
            itemsPerPage={paymentsPerPage}
            onPageChange={setPaymentsPage}
          />
        </motion.div>
      )}

      {activeTab === 'salaries' && (
        <motion.div className="finance-tab-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card finance-filter-card">
            <div className="finance-filter-row finance-filter-row-primary">
              <CalendarDays size={16} className="finance-filter-leading-icon" />
              <FilterSelect
                value={salaryFilter.month.toString()}
                placeholder="Mois"
                onChange={(val) => {
                  setSalaryFilter({...salaryFilter, month: parseInt(val)});
                  setTeachersPage(1);
                  setSalariesPage(1);
                }}
                options={months.map((m, i) => ({ value: i.toString(), label: m }))}
              />
            <FilterSelect
              value={salaryFilter.year.toString()}
              placeholder="Année"
              onChange={(val) => {
                setSalaryFilter({...salaryFilter, year: parseInt(val)});
                setTeachersPage(1);
                setSalariesPage(1);
              }}
              options={availableYears.map(y => ({ value: y.toString(), label: y.toString() }))}
            />
            <FilterSelect
              value={salaryStatusFilter}
              placeholder="Tous les statuts"
              onChange={(val) => {
                setSalaryStatusFilter(val);
                setTeachersPage(1);
              }}
              options={[
                { value: '', label: 'Tous les statuts' },
                { value: 'paid', label: 'Réglé' },
                { value: 'unpaid', label: 'Non réglé' }
              ]}
            />
            <div className="finance-filter-search finance-filter-search-fluid">
              <Search size={16} className="finance-filter-search-icon" />
              <input
                type="text"
                className="input-premium"
                placeholder="Rechercher un formateur..."
                value={teacherSearchTerm}
                onChange={e => {
                  setTeacherSearchTerm(e.target.value);
                  setTeachersPage(1);
                }}
              />
            </div>
            {(teacherSearchTerm || salaryStatusFilter || salaryFilter.month !== currentMonthIndex || salaryFilter.year !== currentYear) && (
              <button
                className="action-btn finance-filter-reset"
                aria-label="Réinitialiser les filtres"
                onClick={() => {
                  setTeacherSearchTerm('');
                  setSalaryStatusFilter('');
                  setSalaryFilter({ teacherId: '', month: currentMonthIndex, year: currentYear });
                  setTeachersPage(1);
                }}
              >
                <RotateCcw size={15} />
              </button>
            )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
            <StatusCountCard
              title="Formateurs réglés"
              value={salaryStatusCounts.paid}
              subtitle={`${months[salaryFilter.month]} ${salaryFilter.year}`}
              icon={Check}
              colorClass="text-green-600"
              bgClass="bg-green-50 border-green-200"
            />
            <StatusCountCard
              title="Formateurs non réglés"
              value={salaryStatusCounts.unpaid}
              subtitle={`${months[salaryFilter.month]} ${salaryFilter.year}`}
              icon={RotateCcw}
              colorClass="text-amber-600"
              bgClass="bg-amber-50 border-amber-200"
            />
            {salaryStatusCounts.unpaid > 0 && (
              <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Action rapide</p>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Valider tous les salaires calculés</p>
                </div>
                <button
                  className="btn-modern primary finance-settle-all-button"
                  style={{ whiteSpace: 'nowrap', fontSize: '12px', padding: '8px 14px' }}
                  onClick={async () => {
                    const unpaid = filteredTeachers.filter(t => !t.isPaid && t.total > 0);
                    if (unpaid.length === 0) return showToast('Aucun salaire à régler', 'warning');
                    if (!await confirmAction({ title: `Régler ${unpaid.length} formateur(s) ?`, message: `Valider ${unpaid.reduce((a, t) => a + t.total, 0).toLocaleString()} DH de salaires pour ${months[salaryFilter.month]} ${salaryFilter.year} ?`, type: 'warning' })) return;
                    for (const t of unpaid) {
                      await addSalary({
                        teacherId: t.id, teacherName: t.name, amount: t.total, hours: t.hours, hourlyRate: t.hourlyRate,
                        sessions: getTeacherMonthlySessionRows(teacherAttendance, t.id, salaryFilter.month, salaryFilter.year, schedules, getActiveScheduleModule),
                        month: months[salaryFilter.month], year: salaryFilter.year, date: new Date().toISOString().split('T')[0]
                      });
                    }
                    showToast(`${unpaid.length} salaires validés`, 'success');
                  }}
                >
                  <Check size={14} style={{ marginRight: '6px' }} /> Régler tous
                </button>
              </div>
            )}
          </div>

          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th style={thStyle}>Formateur</th>
                  <th style={thStyle}>Volume H.</th>
                  <th style={thStyle}>Tarif (DH/h)</th>
                  <th style={thStyle}>Net à payer</th>
                  <th style={thStyle}>Statut Paiement</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTeachers.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={tdStyle}><p style={{ fontWeight: '700' }}>{s.name}</p></td>
                    <td style={tdStyle}><span style={{ fontWeight: '800' }}>{s.hours} h</span></td>
                    <td style={tdStyle}>
                      {editingTeacherId === s.id ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input type="number" className="input-premium" style={{ width: '80px', padding: '6px' }} defaultValue={s.hourlyRate} id={`rate-${s.id}`} autoFocus />
                          <button className="action-btn" onClick={() => handleSaveRate(s.id)} aria-label="Confirmer">
                            <Check size={14} style={{ color: 'var(--success)' }} />
                          </button>
                          <button className="action-btn" onClick={() => setEditingTeacherId(null)} aria-label="Annuler">
                            <X size={14} style={{ color: 'var(--danger)' }} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '800', fontSize: '14px' }}>{s.hourlyRate} DH</span>
                          <button onClick={() => setEditingTeacherId(s.id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', fontSize: '10px', fontWeight: '700', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-ultra-light)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-subtle)'; }}>
                            <Edit3 size={10} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}><span style={{ fontWeight: '900', color: 'var(--primary)' }}>{s.total.toLocaleString()} DH</span></td>
                    <td style={tdStyle}>
                      <button
                        disabled={s.total === 0}
                        onClick={async () => {
                          if (s.isPaid) {
                            if (await confirmAction({ title: "Annuler le paiement ?", message: `Marquer le salaire de ${s.name} comme non réglé ?`, type: "danger" })) {
                              const sal = salaries.find(sal => sal.teacherId === s.id && sal.month === months[salaryFilter.month] && sal.year === salaryFilter.year);
                              if (sal) await deleteSalary(sal.id);
                            }
                          } else {
                            if (await confirmAction({ title: "Confirmer paiement ?", message: `Valider le salaire de ${s.total.toLocaleString()} DH pour ${s.name} ?`, type: "warning" })) {
                              await addSalary({
                                teacherId: s.id,
                                teacherName: s.name,
                                amount: s.total,
                                hours: s.hours,
                                hourlyRate: s.hourlyRate,
                                sessions: getTeacherMonthlySessionRows(teacherAttendance, s.id, salaryFilter.month, salaryFilter.year, schedules, getActiveScheduleModule),
                                month: months[salaryFilter.month],
                                year: salaryFilter.year,
                                date: new Date().toISOString().split('T')[0]
                              });
                            }
                          }
                        }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '5px 14px', fontSize: '11px', fontWeight: '800',
                          borderRadius: 'var(--radius-pill)', cursor: s.total === 0 ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s', border: '1.5px solid',
                          opacity: s.total === 0 ? 0.45 : 1,
                          background: s.isPaid ? 'rgba(22,163,74,0.10)' : 'rgba(234,179,8,0.10)',
                          borderColor: s.isPaid ? '#16a34a' : '#ca8a04',
                          color: s.isPaid ? '#16a34a' : '#a16207',
                        }}>
                        {s.isPaid ? <><Check size={12} /> Règlé</> : <><RotateCcw size={11} /> À régler</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={teachersPage}
            totalPages={totalTeachersPages}
            totalItems={filteredTeachers.length}
            itemsPerPage={teachersPerPage}
            onPageChange={setTeachersPage}
          />

          <div style={{ marginTop: 'var(--space-10)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '900', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={20} /> Historique des règlements
            </h3>
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)' }}>
                    <th style={thStyle}>N° Reçu</th>
                    <th style={thStyle}>Bénéficiaire</th>
                    <th style={thStyle}>Période</th>
                    <th style={thStyle}>Montant</th>
                    <th style={thStyle}>Date Versement</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSalaries.length === 0 ? (
                    <tr><td colSpan="6"><EmptyState title="Aucun historique" message="Aucun versement n'a encore été enregistré." icon="history" /></td></tr>
                  ) : paginatedSalaries.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '900', color: 'var(--primary)' }}>
                          {resolveSalaryReceiptNumber(s)}
                        </span>
                      </td>
                      <td style={tdStyle}><span style={{ fontWeight: '700' }}>{s.teacherName}</span></td>
                      <td style={tdStyle}>{s.month} {s.year}</td>
                      <td style={tdStyle}><span style={{ fontWeight: '800' }}>{s.amount.toLocaleString()} DH</span></td>
                      <td style={tdStyle}>{s.date}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <motion.button
                          whileHover={{ scale: 1.08, translateY: -1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => generateTeacherReceipt(s)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'rgba(176, 104, 185, 0.08)',
                            border: '1px solid rgba(176, 104, 185, 0.15)',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            marginRight: '8px'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--primary)';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(176, 104, 185, 0.08)';
                            e.currentTarget.style.color = 'var(--primary)';
                          }}
                          aria-label="Reçu formateur PDF"
                        >
                          <FileDown size={16} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.08, translateY: -1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={async () => {
                            if (await confirmAction({ title: "Supprimer ?", message: "Voulez-vous supprimer cet historique ?", type: "danger" })) {
                              deleteSalary(s.id);
                            }
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = '#ef4444';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                            e.currentTarget.style.color = '#ef4444';
                          }}
                          aria-label="Supprimer"
                        >
                          <Trash2 size={16} />
                        </motion.button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={salariesPage}
              totalPages={totalSalariesPages}
              totalItems={filteredSalaries.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setSalariesPage}
            />
          </div>
        </motion.div>
      )}

      {activeTab === 'expenses' && (
        <motion.div className="finance-tab-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="finance-expense-filter-toolbar">
          <div className="glass-card finance-filter-card">
            <div className="finance-filter-row finance-filter-row-primary">
            <CalendarDays size={16} className="finance-filter-leading-icon" />
            <FilterSelect
              value={expenseFilter.month}
              placeholder="Tous les mois"
              onChange={val => {
                setExpenseFilter(f => ({ ...f, month: val }));
                setExpensesPage(1);
              }}
              options={[{ value: '', label: 'Tous les mois' }, ...months.map(m => ({ value: m, label: m }))]}
            />
            <FilterSelect
              value={expenseFilter.year.toString()}
              placeholder="Année"
              onChange={val => {
                setExpenseFilter(f => ({ ...f, year: parseInt(val) }));
                setExpensesPage(1);
              }}
              options={[
                { value: '2026', label: '2026' },
                { value: '2025', label: '2025' },
                { value: '2024', label: '2024' }
              ]}
            />
            <FilterSelect
              value={expenseFilter.category}
              placeholder="Toutes catégories"
              onChange={val => {
                setExpenseFilter(f => ({ ...f, category: val }));
                setExpensesPage(1);
              }}
              options={[{ value: '', label: 'Toutes catégories' }, ...EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))]}
            />
            {(expenseFilter.month || expenseFilter.category || expenseFilter.year !== currentYear) && (
              <button className="action-btn finance-filter-reset" aria-label="Réinitialiser les filtres"
                onClick={() => {
                  setExpenseFilter({ month: '', year: currentYear, category: '' });
                  setExpensesPage(1);
                }}>
                <RotateCcw size={15} />
              </button>
            )}
            </div>
          </div>
            <div className="finance-filter-actions finance-expense-summary">
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>
                  {filteredExpenses.length} charge{filteredExpenses.length !== 1 ? 's' : ''}
                  {expenseFilter.month ? ` · ${expenseFilter.month} ${expenseFilter.year}` : ''}
                </p>
                <p style={{ fontSize: '18px', fontWeight: '900', color: '#dc2626', lineHeight: 1.2 }}>
                  {filteredExpensesTotal.toLocaleString()} DH
                </p>
              </div>
              <button onClick={() => setShowExpenseModal(true)} className="btn-modern primary finance-expense-add-button">
                <Plus size={16} style={{ marginRight: '8px' }} /> Ajouter
              </button>
            </div>
          </div>

          <div className="glass-card" style={{ overflow: 'hidden' }}>
            {loading ? <TableSkeleton rows={6} /> : (
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)' }}>
                    <th style={thStyle}>Libellé</th>
                    <th style={thStyle}>Catégorie</th>
                    <th style={thStyle}>Période</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Montant</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr><td colSpan="6"><EmptyState title="Aucune charge" message={expenseFilter.month || expenseFilter.category ? "Aucune charge pour ces filtres." : "Aucune autre charge enregistrée."} icon="file" /></td></tr>
                  ) : paginatedExpenses.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-lg)', background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Receipt size={14} style={{ color: '#dc2626' }} />
                          </div>
                          <span style={{ fontWeight: '700', fontSize: 'var(--text-sm)' }}>{e.label}</span>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', background: 'var(--bg-subtle)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-pill)', padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Tag size={10} /> {e.category}
                        </span>
                      </td>
                      <td style={tdStyle}><span style={{ fontWeight: '700' }}>{e.month} {e.year}</span></td>
                      <td style={tdStyle}><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{e.date}</span></td>
                      <td style={tdStyle}><span style={{ fontWeight: '900', color: 'var(--danger)' }}>{parseFloat(e.amount).toLocaleString()} DH</span></td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <motion.button
                          whileHover={{ scale: 1.08, translateY: -1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={async () => {
                            if (await confirmAction({ title: "Supprimer la charge ?", message: `Voulez-vous supprimer "${e.label}" ?`, type: "danger" })) {
                              deleteExpense(e.id);
                            }
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = '#ef4444';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                            e.currentTarget.style.color = '#ef4444';
                          }}
                          aria-label="Supprimer"
                        >
                          <Trash2 size={16} />
                        </motion.button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Pagination
            currentPage={expensesPage}
            totalPages={totalExpensesPages}
            totalItems={filteredExpenses.length}
            itemsPerPage={expensesPerPage}
            onPageChange={setExpensesPage}
          />
        </motion.div>
      )}

      {activeTab === 'stats' && (
        <motion.div className="finance-tab-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
          <div className="glass-card" style={{ padding: 'var(--space-6)', gridColumn: '1 / -1', overflowX: 'auto' }}>
            <div className="finance-section-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CalendarDays size={22} style={{ color: 'var(--danger)' }} />
                <div>
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '900' }}>Statistiques périodiques</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700' }}>Dépenses et charges par date</p>
                </div>
              </div>
              <div className="finance-filter-row finance-filter-row-compact">
                <div className="finance-period-date-range finance-filter-date-range">
                  <DatePicker
                    id="daily-stats-start-date"
                    label="Début"
                    value={dailyStatsDate}
                    max={dailyStatsEndDate || undefined}
                    onChange={(newDate) => {
                      setDailyStatsDate(newDate);
                      if (dailyStatsEndDate && newDate && newDate > dailyStatsEndDate) {
                        setDailyStatsEndDate(newDate);
                      }
                      setDailyStatsPage(1);
                    }}
                    title="Date de début"
                  />
                  <span className="finance-period-separator">au</span>
                  <DatePicker
                    id="daily-stats-end-date"
                    label="Fin"
                    value={dailyStatsEndDate}
                    min={dailyStatsDate || undefined}
                    onChange={(newEndDate) => {
                      setDailyStatsEndDate(newEndDate);
                      if (dailyStatsDate && newEndDate && newEndDate < dailyStatsDate) {
                        setDailyStatsDate(newEndDate);
                      }
                      setDailyStatsPage(1);
                    }}
                    title="Date de fin"
                  />
                </div>
                {(dailyStatsDate || dailyStatsEndDate) && (
                  <button
                    className="action-btn finance-filter-reset"
                    aria-label="Réinitialiser les filtres"
                    onClick={() => {
                      setDailyStatsDate('');
                      setDailyStatsEndDate('');
                      setDailyStatsPage(1);
                    }}
                  >
                    <RotateCcw size={15} />
                  </button>
                )}
                <span className="badge-status pending">
                  {dailyExpenseStats.length} jour{dailyExpenseStats.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {dailyExpenseStats.length === 0 ? (
              <EmptyState title="Aucune opération" message={(dailyStatsDate || dailyStatsEndDate) ? "Aucune opération (revenu ou charge) pour cette période." : "Aucune opération à analyser."} icon="file" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 1.2fr) repeat(4, minmax(80px, 1fr))', gap: '8px', paddingBottom: '10px', borderBottom: '1px solid var(--border-light)', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span>Date</span>
                  <span>Revenus</span>
                  <span>Salaires</span>
                  <span>Charges</span>
                  <span>Bilan</span>
                </div>
                {paginatedDailyExpenseStats.map(day => (
                  <div key={day.date} style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 1.2fr) repeat(4, minmax(80px, 1fr))', gap: '8px', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>{formatDisplayDate(day.date)}</span>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--success)' }}>{day.payments.toLocaleString()} DH</span>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--danger)' }}>{day.salaries.toLocaleString()} DH</span>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#ea580c' }}>{day.otherExpenses.toLocaleString()} DH</span>
                    <span style={{ fontSize: '13px', fontWeight: '900', color: day.bilan >= 0 ? 'var(--success)' : 'var(--danger)' }}>{day.bilan > 0 ? '+' : ''}{day.bilan.toLocaleString()} DH</span>
                  </div>
                ))}
              </div>
            )}
            <Pagination
              currentPage={dailyStatsPage}
              totalPages={totalDailyStatsPages}
              totalItems={dailyExpenseStats.length}
              itemsPerPage={dailyStatsPerPage}
              onPageChange={setDailyStatsPage}
            />
          </div>
          <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-6)' }}>
              <BarChart3 size={22} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '900' }}>Tendance Annuelle</h3>
            </div>
            {monthlyTrendData.length === 0 ? (
              <EmptyState title="Pas encore de données" message="Les graphiques apparaîtront dès les premiers paiements enregistrés." icon="chart" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyTrendData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip formatter={(value) => [`${value.toLocaleString()} DH`]} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', fontSize: 12, fontWeight: 700 }} />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                  <Bar dataKey="Revenus" fill="#16a34a" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Charges" fill="#dc2626" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-5)' }}>
                <PieChart size={18} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '900' }}>Structure — {summaryMonthFilter}</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', fontWeight: '700' }}>
                    <span>Revenus</span>
                    <span style={{ color: 'var(--success)' }}>+{stats.revenue.toLocaleString()} DH</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-subtle)', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: 'var(--success)', borderRadius: '5px' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', fontWeight: '700' }}>
                    <span>Charges salariales</span>
                    <span style={{ color: 'var(--danger)' }}>-{stats.salariesTotal.toLocaleString()} DH</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-subtle)', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min((stats.salariesTotal / (stats.revenue || 1)) * 100, 100)}%`, height: '100%', background: 'var(--danger)', borderRadius: '5px' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', fontWeight: '700' }}>
                    <span>Autres charges</span>
                    <span style={{ color: '#ea580c' }}>-{stats.otherExpenses.toLocaleString()} DH</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-subtle)', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min((stats.otherExpenses / (stats.revenue || 1)) * 100, 100)}%`, height: '100%', background: '#ea580c', borderRadius: '5px' }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="glass-card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
              <BarChart3 size={28} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
              <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Passif Circulant</p>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '12px' }}>Salaires calculés non validés</p>
              <div style={{ padding: '12px 20px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xl)', border: '2px dashed var(--accent)' }}>
                <span style={{ fontSize: 'var(--text-xl)', fontWeight: '900', color: 'var(--accent)' }}>{stats.pendingSalaries.toLocaleString()} DH</span>
              </div>
            </div>
          </div>
          
        </motion.div>
      )}

      {activeTab === 'annual' && (
        <motion.div className="finance-tab-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
            <div className="finance-section-toolbar finance-annual-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-xl)', background: 'var(--primary-ultra-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Table2 size={22} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: '900' }}>Récapitulatif annuel</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700' }}>Revenus, charges et solde mois par mois</p>
                </div>
              </div>
              <div className="finance-filter-row finance-filter-row-compact">
                <FilterSelect
                  value={annualYear.toString()}
                  placeholder="Année"
                  onChange={val => setAnnualYear(parseInt(val))}
                  options={availableYears.map(y => ({ value: y.toString(), label: y.toString() }))}
                />
                {annualYear !== currentYear && (
                  <button
                    className="action-btn finance-filter-reset"
                    aria-label="Réinitialiser les filtres"
                    onClick={() => setAnnualYear(currentYear)}
                  >
                    <RotateCcw size={15} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)' }}>
                    {['Mois', 'Revenus', 'Salaires', 'Autres charges', 'Total charges', 'Solde mensuel', 'Solde cumulé'].map(h => (
                      <th key={h} style={{ ...thStyle, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {annualSummary.map((row, idx) => {
                    const hasData = row.revenue > 0 || row.charges > 0;
                    return (
                      <tr key={row.month} style={{
                        borderBottom: '1px solid var(--border-light)',
                        background: !hasData ? 'transparent' : undefined,
                        opacity: !hasData ? 0.55 : 1
                      }}>
                        <td style={{ ...tdStyle, fontWeight: '800', fontSize: '13px' }}>{row.month}</td>
                        <td style={{ ...tdStyle, fontWeight: '800', color: row.revenue > 0 ? 'var(--success)' : 'var(--text-faint)' }}>
                          {row.revenue > 0 ? `+${row.revenue.toLocaleString()} DH` : '—'}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: '800', color: row.salaryAmt > 0 ? 'var(--danger)' : 'var(--text-faint)' }}>
                          {row.salaryAmt > 0 ? `${row.salaryAmt.toLocaleString()} DH` : '—'}
                        </td>
                        <td style={{ ...tdStyle, color: row.expenseAmt > 0 ? '#ea580c' : 'var(--text-faint)' }}>
                          {row.expenseAmt > 0 ? `${row.expenseAmt.toLocaleString()} DH` : '—'}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: '800', color: row.charges > 0 ? 'var(--text-primary)' : 'var(--text-faint)' }}>
                          {row.charges > 0 ? `${row.charges.toLocaleString()} DH` : '—'}
                        </td>
                        <td style={tdStyle}>
                          {hasData ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              fontWeight: '900', fontSize: '13px',
                              color: row.balance >= 0 ? 'var(--success)' : 'var(--danger)'
                            }}>
                              {row.balance >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                              {row.balance >= 0 ? '+' : ''}{row.balance.toLocaleString()} DH
                            </span>
                          ) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                        </td>
                        <td style={tdStyle}>
                          {hasData ? (
                            <span style={{
                              fontWeight: '900', fontSize: '13px',
                              color: row.cumBalance >= 0 ? '#2563eb' : 'var(--danger)'
                            }}>
                              {row.cumBalance >= 0 ? '+' : ''}{row.cumBalance.toLocaleString()} DH
                            </span>
                          ) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    const totalRevenue = annualSummary.reduce((a, r) => a + r.revenue, 0);
                    const totalSalaries = annualSummary.reduce((a, r) => a + r.salaryAmt, 0);
                    const totalExpenses = annualSummary.reduce((a, r) => a + r.expenseAmt, 0);
                    const totalCharges = annualSummary.reduce((a, r) => a + r.charges, 0);
                    const totalBalance = totalRevenue - totalCharges;
                    return (
                      <tr style={{ background: 'var(--bg-subtle)', borderTop: '2px solid var(--border)' }}>
                        <td style={{ ...tdStyle, fontWeight: '900', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total {annualYear}</td>
                        <td style={{ ...tdStyle, fontWeight: '900', color: 'var(--success)' }}>{totalRevenue > 0 ? `+${totalRevenue.toLocaleString()} DH` : '—'}</td>
                        <td style={{ ...tdStyle, fontWeight: '900', color: 'var(--danger)' }}>{totalSalaries > 0 ? `${totalSalaries.toLocaleString()} DH` : '—'}</td>
                        <td style={{ ...tdStyle, fontWeight: '900', color: '#ea580c' }}>{totalExpenses > 0 ? `${totalExpenses.toLocaleString()} DH` : '—'}</td>
                        <td style={{ ...tdStyle, fontWeight: '900' }}>{totalCharges > 0 ? `${totalCharges.toLocaleString()} DH` : '—'}</td>
                        <td style={{ ...tdStyle }}>
                          <span style={{ fontWeight: '900', fontSize: '14px', color: totalBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {totalBalance >= 0 ? '+' : ''}{totalBalance.toLocaleString()} DH
                          </span>
                        </td>
                        <td />
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
          </div>

          {overdueStudents.length > 0 && (
            <div className="glass-card" style={{ padding: 'var(--space-6)', border: '1px solid rgba(220,38,38,0.2)', borderLeft: '4px solid #dc2626' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-5)' }}>
                <AlertTriangle size={20} style={{ color: '#dc2626' }} />
                <div>
                  <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '900', color: '#dc2626' }}>
                    Alertes — {overdueStudents.length} stagiaire{overdueStudents.length > 1 ? 's' : ''} en retard de paiement
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700' }}>Stagiaires sans paiement enregistré depuis au moins 2 mois consécutifs</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {paginatedOverdueStudents.map(student => (
                    <div key={student.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', background: 'rgba(220,38,38,0.04)',
                      borderRadius: 'var(--radius-xl)', border: '1px solid rgba(220,38,38,0.12)',
                      flexWrap: 'wrap', gap: '10px'
                    }}>
                      <div>
                        <p style={{ fontWeight: '800', fontSize: '13px' }}>{student.firstName} {student.lastName}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{student.major}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '800',
                          color: '#dc2626', background: 'rgba(220,38,38,0.1)', borderRadius: '999px', padding: '4px 12px'
                        }}>
                          <AlertTriangle size={11} /> En retard · {overdueMap[student.id]} mois
                        </span>
                        <button
                          className="btn-modern"
                          style={{ fontSize: '11px', padding: '6px 12px', background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }}
                          onClick={() => { setActiveTab('payments'); openPaymentModal(student.id); }}
                        >
                          <CreditCard size={12} style={{ marginRight: '5px' }} /> Encaisser
                        </button>
                      </div>
                    </div>
                ))}
              </div>
              <Pagination
                currentPage={overduePage}
                totalPages={totalOverduePages}
                totalItems={overdueStudents.length}
                itemsPerPage={overduePerPage}
                onPageChange={setOverduePage}
              />
            </div>
          )}
        </motion.div>
      )}

      <FinanceModalPortal>
      <AnimatePresence>
        {showExpenseModal && (
          <div className="finance-payment-modal-overlay finance-admin-page finance-modal-portal-scope app-modal-overlay">
            <motion.div className="app-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(6px)' }} onClick={() => setShowExpenseModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="glass-premium finance-expense-modal app-modal-surface" style={{ position: 'relative', width: '100%', maxWidth: '520px', padding: '32px', borderRadius: 'var(--radius-3xl)', boxShadow: 'var(--shadow-xl)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-lg)', background: 'rgba(220,38,38,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt size={20} style={{ color: '#dc2626' }} />
                  </div>
                  <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '900' }}>Ajouter une charge</h2>
                </div>
                <button onClick={() => setShowExpenseModal(false)} className="close-button" aria-label="Fermer la fenêtre"><X size={20} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={lbl}>Libellé de la charge</label>
                  <input type="text" className="input-premium" style={{ width: '100%', marginTop: '6px' }} placeholder="Ex : Loyer local, Achat fournitures..." value={expenseData.label} onChange={(e) => setExpenseData({...expenseData, label: e.target.value})} autoFocus />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={lbl}>Montant (DH)</label>
                    <input type="number" className="input-premium" style={{ width: '100%', marginTop: '6px' }} placeholder="0" value={expenseData.amount} onChange={(e) => setExpenseData({...expenseData, amount: e.target.value})} />
                  </div>
                  <div>
                    <label style={lbl}>Catégorie</label>
                    <FilterSelect
                      style={{ width: '100%', marginTop: '6px' }}
                      value={expenseData.category}
                      placeholder="Catégorie"
                      onChange={val => setExpenseData({...expenseData, category: val})}
                      options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={lbl}>Mois</label>
                    <FilterSelect
                      style={{ width: '100%', marginTop: '6px' }}
                      value={expenseData.month}
                      placeholder="Mois"
                      onChange={val => setExpenseData({...expenseData, month: val})}
                      options={months.map(m => ({ value: m, label: m }))}
                    />
                  </div>
                  <div>
                    <label style={lbl}>Année</label>
                    <FilterSelect
                      style={{ width: '100%', marginTop: '6px' }}
                      value={expenseData.year.toString()}
                      placeholder="Année"
                      onChange={val => setExpenseData({...expenseData, year: parseInt(val)})}
                      options={availableYears.map(y => ({ value: y.toString(), label: y.toString() }))}
                    />
                  </div>
                  <div>
                    <label style={lbl}>Date</label>
                    <DatePicker
                      className="finance-modal-date-picker"
                      value={expenseData.date}
                      onChange={(date) => setExpenseData({ ...expenseData, date })}
                      placeholder="Choisir une date"
                    />
                  </div>
                </div>
                <button className="btn-modern primary" style={{ width: '100%', padding: '14px', justifyContent: 'center', marginTop: '4px', background: '#dc2626' }}
                  onClick={async () => {
                    if (!expenseData.label || !expenseData.amount) return showToast('Libellé et montant requis', 'warning');
                    await addExpense(expenseData);
                    setShowExpenseModal(false);
                    setExpenseData({ ...expenseData, label: '', amount: '' });
                  }}>
                  <Receipt size={18} style={{ marginRight: '8px' }} /> Enregistrer la charge
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </FinanceModalPortal>

      <FinanceModalPortal>
      <AnimatePresence>
        {showPaymentModal && (
          <div className="finance-payment-modal-overlay finance-admin-page finance-modal-portal-scope app-modal-overlay">
            <motion.div className="app-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(6px)' }} onClick={() => setShowPaymentModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="glass-premium finance-payment-modal app-modal-surface">
              <div className="finance-payment-modal-header">
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '900' }}>{editingPayment ? 'Modifier le paiement' : 'Enregistrer un Paiement'}</h2>
                <button onClick={() => { setShowPaymentModal(false); setEditingPayment(null); }} className="close-button" aria-label="Fermer la fenêtre"><X size={20} /></button>
              </div>
              <div className="finance-payment-modal-stack">
                <div className="finance-payment-modal-panel">
                  <label style={lbl}>Année académique d'imputation</label>
                  <FilterSelect
                    style={{ width: '100%', marginTop: '6px' }}
                    value={paymentData.academicYear || ''}
                    placeholder="Sélectionner l'année académique..."
                    onChange={value => {
                      setPaymentData(current => ({
                        ...current,
                        academicYear: value,
                        studentId: editingPayment ? current.studentId : '',
                      }));
                      if (!editingPayment) setPaymentModalFilter({ diploma: '', major: '', year: '' });
                    }}
                    options={availableAcademicYears.map(year => ({ value: year, label: year }))}
                  />
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '600' }}>
                    Pour un arriéré, choisissez l'année concernée avant de sélectionner le stagiaire.
                  </p>
                </div>
                {!editingPayment && <div className="finance-payment-modal-panel">
                  
                  <div className="finance-payment-modal-grid finance-payment-modal-grid-three">
                    <div>
                      <label style={{ ...lbl, fontSize: '9px' }}>Niveau</label>
                      <FilterSelect 
                        style={{ width: '100%', marginTop: '4px' }}
                        value={paymentModalFilter.diploma}
                        placeholder="Tous"
                        onChange={val => { setPaymentModalFilter(f => ({ ...f, diploma: val, major: '', year: '' })); setPaymentData(d => ({ ...d, studentId: '' })); }}
                        options={[{ value: '', label: 'Tous' }, ...modalDiplomas.map(d => ({ value: d, label: d }))]}
                      />
                    </div>
                    <div>
                      <label style={{ ...lbl, fontSize: '9px' }}>Filière</label>
                      <FilterSelect 
                        style={{ width: '100%', marginTop: '4px' }}
                        value={paymentModalFilter.major}
                        placeholder="Toutes"
                        onChange={val => { setPaymentModalFilter(f => ({ ...f, major: val, year: '' })); setPaymentData(d => ({ ...d, studentId: '' })); }}
                        options={[{ value: '', label: 'Toutes' }, ...modalMajors.map(m => ({ value: m, label: m }))]}
                      />
                    </div>
                    <div>
                      <label style={{ ...lbl, fontSize: '9px' }}>Année</label>
                      <FilterSelect 
                        style={{ width: '100%', marginTop: '4px' }}
                        value={paymentModalFilter.year}
                        placeholder="Toutes"
                        onChange={val => { setPaymentModalFilter(f => ({ ...f, year: val })); setPaymentData(d => ({ ...d, studentId: '' })); }}
                        options={[{ value: '', label: 'Toutes' }, ...modalYears.map(y => ({ value: y, label: y }))]}
                      />
                    </div>
                  </div>
                </div>}

                <div>
                  <label style={lbl}>
                    Stagiaire Bénéficiaire
                    {!editingPayment && <span style={{ marginLeft: '6px', fontWeight: '600', color: 'var(--primary)', textTransform: 'none', fontSize: '10px' }}>
                      {modalStudents.length} stagiaire{modalStudents.length !== 1 ? 's' : ''}
                    </span>}
                  </label>
                  {editingPayment ? (
                    <p style={{ marginTop: '6px', fontWeight: '700', fontSize: '14px', padding: '10px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                      {students.find(s => s.id === paymentData.studentId)?.lastName} {students.find(s => s.id === paymentData.studentId)?.firstName}
                    </p>
                  ) : (
                    <FilterSelect 
                      style={{ width: '100%', marginTop: '6px' }}
                      value={paymentData.studentId}
                      placeholder="Sélectionner un stagiaire..."
                      onChange={val => {
                        const nextStudent = paymentAcademicStudents.find(student => student.id === val);
                        setPaymentData(current => ({
                          ...current,
                          studentId: val,
                          month: getDefaultPaymentMonth(nextStudent, current.month),
                        }));
                      }}
                      options={[{ value: '', label: 'Sélectionner un stagiaire...' }, ...modalStudents.map(s => ({ value: s.id, label: `${s.lastName} ${s.firstName}` }))]}
                    />
                  )}
                  {paymentData.studentId && previousYearArrearsMap[paymentData.studentId] && (
                    <div style={{
                      background: 'rgba(245,158,11,0.08)',
                      border: '1px solid rgba(245,158,11,0.25)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      marginTop: '10px',
                      color: '#92400e'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', fontSize: '12px' }}>
                        <AlertTriangle size={14} style={{ color: '#d97706' }} />
                        Attention : Arriérés de la 1ère année ({previousYearArrearsMap[paymentData.studentId].details.map(d => d.academicYear).join(', ')})
                      </div>
                      <p style={{ fontSize: '11px', marginTop: '4px', lineHeight: '1.4', fontWeight: '600' }}>
                        Ce stagiaire a {previousYearArrearsMap[paymentData.studentId].unpaidCount} mois non réglés pour la 1ère année :{' '}
                        {previousYearArrearsMap[paymentData.studentId].details.map(d => d.unpaidMonths.join(', ')).join('; ')}.
                      </p>
                    </div>
                  )}
                </div>
                <div className="finance-payment-modal-grid finance-payment-modal-grid-three">
                  <div>
                    <label style={lbl}>Montant (DH)</label>
                    <input
                      type="number"
                      className="input-premium"
                      style={{ width: '100%', marginTop: '6px' }}
                      value={paymentData.amount}
                      onChange={(event) => setPaymentData({ ...paymentData, amount: event.target.value })}
                    />
                  </div>
                  <div>
                    <label style={lbl}>Mois concerné</label>
                    <FilterSelect
                      style={{ width: '100%', marginTop: '6px' }}
                      value={paymentData.month}
                      placeholder="Sélectionner un mois..."
                      onChange={value => setPaymentData({ ...paymentData, month: value })}
                      options={paymentMonthOptions}
                    />
                    {selectedMonthIsVacation && (
                      <p className="finance-payment-vacation-warning">
                        Ce mois est une période de vacances pour ce niveau. Aucun paiement ne peut être enregistré.
                      </p>
                    )}
                  </div>
                  <div>
                    <label style={lbl}>Mode de paiement</label>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      {['Espèces', 'Virement'].map((method) => (
                        <label 
                          key={method} 
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${paymentData.paymentMethod === method ? 'var(--primary)' : 'var(--border-light)'}`,
                            background: paymentData.paymentMethod === method ? 'var(--primary-ultra-light)' : 'var(--bg-page)',
                            color: paymentData.paymentMethod === method ? 'var(--primary)' : 'var(--text-primary)',
                            fontSize: '13px',
                            fontWeight: paymentData.paymentMethod === method ? '700' : '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <input 
                            type="radio" 
                            name="paymentMethod" 
                            value={method} 
                            checked={paymentData.paymentMethod === method}
                            onChange={(e) => setPaymentData({...paymentData, paymentMethod: e.target.value})}
                            style={{ display: 'none' }} 
                          />
                          {method}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="finance-payment-modal-panel">
                  
                  <div className="finance-payment-modal-grid finance-payment-modal-grid-three">
                    {PAYMENT_FEE_FIELDS.map(({ key, label }) => (
                      <div key={key}>
                        <label style={{ ...lbl, fontSize: '9px' }}>{label}</label>
                        <input
                          type="number"
                          min="0"
                          className="input-premium"
                          style={{ width: '100%', marginTop: '4px', fontSize: '12px' }}
                          placeholder="0"
                          value={paymentData[key]}
                          onChange={(e) => setPaymentData({ ...paymentData, [key]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)' }}>Total à encaisser</span>
                    <span style={{ fontSize: '16px', fontWeight: '900', color: 'var(--success)' }}>{formatMoney(paymentGrandTotal)} DH</span>
                  </div>
                </div>
                <button className="btn-modern primary finance-payment-submit-button"
                  disabled={selectedMonthIsVacation}
                  style={{ width: '100%', padding: '14px', justifyContent: 'center', opacity: selectedMonthIsVacation ? 0.55 : 1, cursor: selectedMonthIsVacation ? 'not-allowed' : 'pointer' }}
                  onClick={async () => {
                    if (!paymentData.studentId || paymentGrandTotal <= 0) return showToast('Stagiaire et montant requis', 'warning');
                    if (!paymentData.academicYear) return showToast('Année académique requise', 'warning');
                    if (selectedMonthIsVacation) return showToast('Paiement bloqué : ce mois est une période de vacances pour ce niveau.', 'warning');
                    const fees = PAYMENT_FEE_FIELDS
                      .map(({ key, label }) => ({ key, label, amount: parseFloat(paymentData[key]) || 0 }))
                      .filter(fee => fee.amount > 0);
                    const currentStudent = students.find(student => student.id === paymentData.studentId);
                    const academicStudent = getStudentAcademicSnapshot(currentStudent, paymentData.academicYear) || currentStudent;
                    const studentSnapshot = academicStudent ? {
                      firstName: academicStudent.firstName || '',
                      lastName: academicStudent.lastName || '',
                      regNo: academicStudent.regNo || '',
                      diploma: academicStudent.diploma || '',
                      major: academicStudent.major || '',
                      year: academicStudent.year || '',
                    } : undefined;
                    if (editingPayment) {
                      const alreadyPaidForMonth = hasDuplicateMonthlyPayment(payments, {
                        studentId: paymentData.studentId,
                        month: paymentData.month,
                        academicYear: paymentData.academicYear,
                        excludePaymentId: editingPayment.id,
                      });
                      if (alreadyPaidForMonth) {
                        return showToast('Ce stagiaire a déjà payé ce mois.', 'warning');
                      }
                      await updatePayment(editingPayment.id, {
                        ...paymentData,
                        tuitionAmount: paymentBaseAmount,
                        amount: paymentGrandTotal,
                        fees,
                        ...(studentSnapshot ? { studentSnapshot } : {}),
                      });
                      setEditingPayment(null);
                    } else {
                      const alreadyPaidForMonth = hasDuplicateMonthlyPayment(payments, {
                        studentId: paymentData.studentId,
                        month: paymentData.month,
                        academicYear: paymentData.academicYear,
                      });
                      if (alreadyPaidForMonth) {
                        return showToast('Ce stagiaire a déjà payé ce mois.', 'warning');
                      }
                      await addPayment({
                        ...paymentData,
                        tuitionAmount: paymentBaseAmount,
                        amount: paymentGrandTotal,
                        fees,
                        ...(studentSnapshot ? { studentSnapshot } : {}),
                      });
                    }
                    setShowPaymentModal(false);
                    setPaymentData({
                      studentId: '',
                      academicYear: paymentAcademicYearFilter || defaultAcademicYear,
                      amount: '',
                      examFee: '',
                      registrationFee: '',
                      supportFee: '',
                      month: currentMonthName,
                      date: new Date().toISOString().split('T')[0],
                      status: 'payé',
                      paymentMethod: 'Espèces',
                    });
                    setPaymentModalFilter({ diploma: '', major: '', year: '' });
                  }}><CreditCard size={18} style={{ marginRight: '8px' }} /> {editingPayment ? 'Enregistrer les modifications' : "Valider l'encaissement"}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </FinanceModalPortal>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, tone, helper, month }) => (
  <motion.div
    className={`finance-net-card finance-net-card-${tone} finance-summary-card`}
    whileHover={{ y: -5, scale: 1.02 }}
    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
  >
    <div className="finance-net-card-shine" aria-hidden="true" />
    <div className="finance-net-card-icon-bg" aria-hidden="true">
      <Icon size={48} strokeWidth={1.35} />
    </div>
    <div className="finance-net-card-top">
      <span className="finance-net-card-kicker">Indicateur</span>
      <span className="finance-net-month-badge"><CalendarDays size={11} />{month}</span>
    </div>
    <div className="finance-net-card-content">
      <h3>{title}</h3>
      <p className="finance-net-card-amount">{formatMoney(value)}<span>DH</span></p>
      <p className="finance-net-card-helper">{helper}</p>
    </div>
  </motion.div>
);

const RecoveryCard = ({ value, paid, total, month }) => (
  <motion.div
    className="finance-net-card finance-net-card-recovery finance-summary-card"
    whileHover={{ y: -5, scale: 1.02 }}
    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
  >
    <div className="finance-net-card-shine" aria-hidden="true" />
    <div className="finance-net-card-icon-bg" aria-hidden="true">
      <TrendingUp size={48} strokeWidth={1.35} />
    </div>
    <div className="finance-net-card-top">
      <span className="finance-net-card-kicker">Indicateur</span>
      <span className="finance-net-month-badge"><CalendarDays size={11} />{month}</span>
    </div>
    <div className="finance-net-card-content">
      <h3>Taux de recouvrement</h3>
      <p className="finance-net-card-amount">{value}<span>%</span></p>
      <div className="finance-summary-progress" aria-hidden="true">
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
      <p className="finance-net-card-helper">{paid} / {total} stagiaires</p>
    </div>
  </motion.div>
);

const StatusCountCard = ({ title, value, subtitle, icon: Icon, colorClass, bgClass }) => (
  <div className={cn('rounded-2xl border p-5 bg-white shadow-sm flex items-center justify-between gap-4', bgClass)}>
    <div>
      <p className={cn('flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider mb-1.5', colorClass)}>
        <Icon size={11} /> {title}
      </p>
      <p className={cn('text-2xl font-black tracking-tight', colorClass)}>{value.toLocaleString()}</p>
      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{subtitle}</p>
    </div>
    <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0', bgClass, colorClass)}>
      <Icon size={18} />
    </div>
  </div>
);

const thStyle = { padding: '16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle = { padding: '16px', fontSize: 'var(--text-sm)' };
const lbl = { fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };

export default FinanceDashboard;
