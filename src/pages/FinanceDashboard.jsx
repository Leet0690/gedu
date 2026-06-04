import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { jsPDF } from 'jspdf';
import { logoBase64 } from '../utils/logoBase64';
import { TableSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui';
import { FilterSelect } from '../components/ui/FilterSelect';
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
  Calendar,
  CalendarDays,
  Receipt,
  Tag,
  Eye,
  EyeOff,
  AlertTriangle,
  Table2
} from 'lucide-react';

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
      const slotKey = `${teacherId}_${normalizeTimeSlot(session.time)}`;
      const module = getScheduleModule(session);
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

const normalizeStatus = (value = '') =>
  String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const getPaymentStatusKey = (status) => {
  const normalized = normalizeStatus(status || 'payé');
  if (
    normalized.includes('impaye') ||
    normalized.includes('unpaid') ||
    normalized.includes('non paye') ||
    normalized.includes('a payer') ||
    normalized.includes('a regler')
  ) {
    return 'unpaid';
  }
  return 'paid';
};

const getPaymentStatusLabel = (status) =>
  getPaymentStatusKey(status) === 'unpaid' ? 'Impayé' : 'Payé';

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

const FILTER_EMPTY_VALUE = '__empty_filter__';
const normalizeFilterValue = (value) => (String(value ?? '') === '' ? FILTER_EMPTY_VALUE : String(value));

const FinanceFilterSelect = ({ value, onChange, placeholder, options, style }) => (
  <Select value={normalizeFilterValue(value)} onValueChange={(next) => onChange(next === FILTER_EMPTY_VALUE ? '' : next)}>
    <SelectTrigger className="finance-radix-select-trigger" style={style}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent className="finance-radix-select-content">
      {options.map((option) => (
        <SelectItem
          key={normalizeFilterValue(option.value)}
          value={normalizeFilterValue(option.value)}
          className="finance-radix-select-item"
        >
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const FinanceDashboard = () => {
  const { 
    students, teachers, payments, salaries, expenses, loading,
    addPayment, updatePayment, deletePayment, addSalary, deleteSalary, updateTeacher,
    addExpense, deleteExpense,
    teacherAttendance, loadFinancialData, loadTeacherAttendanceForMonth,
    schedules, getActiveScheduleModule,
    isDirectorAuth, loginDirector, logoutDirector, logout, confirmAction
  } = useApp();
  const { showToast } = useToast();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('payments');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [paymentMonthFilter, setPaymentMonthFilter] = useState(getCurrentMonthName);
  const [summaryMonthFilter, setSummaryMonthFilter] = useState(getCurrentMonthName);
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
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

  const months = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];
  const currentMonthName = getCurrentMonthName();

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
    const rows = [['Nom', 'Prénom', 'Filière', 'Mois', 'Montant (DH)', 'Date', 'Statut']];
    filteredPayments.forEach(p => {
      if (p.isVirtualUnpaid) return;
      const student = students.find(s => s.id === p.studentId);
      rows.push([
        student?.lastName || '',
        student?.firstName || '',
        student?.major || '',
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
    setEditingPayment(null);
    setPaymentModalFilter({ diploma: '', major: '', year: '' });
    setPaymentData({
      studentId,
      amount: '',
      examFee: '',
      registrationFee: '',
      supportFee: '',
      month: paymentMonthFilter || currentMonthName,
      date: new Date().toISOString().split('T')[0],
      status: 'payé',
      paymentMethod: 'Espèces'
    });
    setShowPaymentModal(true);
  };

  const generateReceipt = (payment, student) => {
    if (!student) return showToast('Stagiaire introuvable', 'warning');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
    const w = doc.internal.pageSize.getWidth();
    const margin = 10;
    const feeItems = getPaymentFeeItems(payment);
    const lineItems = [
      { label: `Frais de formation - ${payment.month}`, amount: getPaymentBaseAmount(payment) },
      ...feeItems
    ].filter(item => item.amount > 0);
    const total = getPaymentTotal(payment);

    try { doc.addImage(logoBase64, 'JPEG', margin, 8, 34, 15); } catch(e) {}
    doc.setFontSize(14); doc.setTextColor(35, 35, 35); doc.setFont('helvetica', 'bold');
    doc.text('RECU DE PAIEMENT', w / 2, 28, { align: 'center' });
    doc.setDrawColor(200); doc.line(margin, 33, w - margin, 33);

    doc.setFontSize(8); doc.setTextColor(80, 80, 80); doc.setFont('helvetica', 'normal');
    doc.text(`N Recu: ${payment.id.substring(0, 8).toUpperCase()}`, margin, 42);
    doc.text(`Date: ${payment.date}`, w - margin, 42, { align: 'right' });

    doc.setFillColor(248, 250, 252); doc.rect(margin, 48, w - (margin * 2), 34, 'F');
    doc.setDrawColor(226, 232, 240); doc.rect(margin, 48, w - (margin * 2), 34, 'S');
    doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('Stagiaire', margin + 5, 57);
    doc.text('Paiement', 86, 57);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(`${student.firstName || ''} ${student.lastName || ''}`.trim(), margin + 5, 65);
    doc.text(`Filiere: ${student.major || '-'}`, margin + 5, 72);
    doc.text(`Mois: ${payment.month}`, 86, 65);
    doc.text(`Mode: ${payment.paymentMethod || 'Espèces'}`, 86, 72);

    let y = 94;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('Designation', margin, y);
    doc.text('Montant', w - margin, y, { align: 'right' });
    y += 3;
    doc.setDrawColor(210); doc.line(margin, y, w - margin, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);

    lineItems.forEach(item => {
      y += 8;
      doc.text(item.label, margin, y);
      doc.text(`${formatMoney(item.amount)} DH`, w - margin, y, { align: 'right' });
    });

    y += 10;
    doc.setDrawColor(35); doc.line(margin, y, w - margin, y);
    y += 9;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('TOTAL PAYE', margin, y);
    doc.text(`${formatMoney(total)} DH`, w - margin, y, { align: 'right' });

    doc.setFontSize(8); doc.setFont('helvetica', 'italic');
    doc.text('Signature et Cachet IPFP', w - margin - 38, 188);
    doc.save(`Recu_${student.lastName}_${payment.month}.pdf`);
    showToast('Reçu généré', 'success');
  };

  const generateTeacherReceipt = (salary) => {
    const teacher = teachers.find(t => t.id === salary.teacherId);
    const monthIndex = months.indexOf(salary.month);
    const sessionRows = (Array.isArray(salary.sessions) && salary.sessions.length > 0)
      ? salary.sessions
      : getTeacherMonthlySessionRows(teacherAttendance, salary.teacherId, monthIndex, salary.year, schedules, getActiveScheduleModule);
    const totalHours = Math.round((sessionRows.reduce((sum, row) => sum + (parseFloat(row.hours) || 0), 0) || parseFloat(salary.hours) || 0) * 100) / 100;
    const hourlyRate = parseFloat(salary.hourlyRate) || parseFloat(teacher?.hourlyRate) || (totalHours > 0 ? (parseFloat(salary.amount) || 0) / totalHours : 0);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
    const w = doc.internal.pageSize.getWidth();
    const margin = 10;
    let y = 8;

    try { doc.addImage(logoBase64, 'JPEG', margin, y, 34, 15); } catch(e) {}
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(35, 35, 35);
    doc.text('RECU FORMATEUR', w / 2, 28, { align: 'center' });
    doc.setDrawColor(200); doc.line(margin, 33, w - margin, 33);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
    doc.text(`N Recu: ${salary.id.substring(0, 8).toUpperCase()}`, margin, 42);
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
    doc.save(`Recu_Formateur_${(salary.teacherName || 'Formateur').replace(/\s+/g, '_')}_${salary.month}_${salary.year}.pdf`);
    showToast('Reçu formateur généré', 'success');
  };

  const monthlyPaymentRows = useMemo(() => {
    const selectedMonth = paymentMonthFilter || currentMonthName;
    const paymentsForMonth = payments.filter(p =>
      (p.month || '').toLowerCase() === selectedMonth.toLowerCase()
    );
    const paidStudentIds = new Set(paymentsForMonth.map(p => p.studentId).filter(Boolean));
    const monthlyRows = [
      ...paymentsForMonth,
      ...students
        .filter(student => !paidStudentIds.has(student.id))
        .map(student => ({
          id: `unpaid-${student.id}-${selectedMonth}`,
          studentId: student.id,
          month: selectedMonth,
          amount: 0,
          date: '-',
          status: 'impayé',
          isVirtualUnpaid: true
        }))
    ];

    return monthlyRows;
  }, [payments, students, paymentMonthFilter, currentMonthName]);

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

  const filteredPayments = useMemo(() => {
    return monthlyPaymentRows.filter(p => {
      const student = students.find(s => s.id === p.studentId);
      if (!student) return false;
      if (paymentStatusFilter && getPaymentStatusKey(p.status) !== paymentStatusFilter) return false;
      const searchStr = `${student.firstName} ${student.lastName} ${p.month}`.toLowerCase();
      return searchStr.includes(searchTerm.toLowerCase());
    });
  }, [monthlyPaymentRows, students, searchTerm, paymentStatusFilter]);

  const paginatedPayments = useMemo(() => {
    return filteredPayments.slice((paymentsPage - 1) * paymentsPerPage, paymentsPage * paymentsPerPage);
  }, [filteredPayments, paymentsPage, paymentsPerPage]);

  const totalPaymentsPages = Math.ceil(filteredPayments.length / paymentsPerPage);

  React.useEffect(() => {
    setPaymentsPage(prev => Math.min(prev, Math.max(1, totalPaymentsPages)));
  }, [totalPaymentsPages]);

  const modalDiplomas = useMemo(() => [...new Set(students.map(s => s.diploma).filter(Boolean))].sort(), [students]);
  const modalMajors = useMemo(() => {
    const base = paymentModalFilter.diploma ? students.filter(s => s.diploma === paymentModalFilter.diploma) : students;
    return [...new Set(base.map(s => s.major).filter(Boolean))].sort();
  }, [students, paymentModalFilter.diploma]);
  const modalYears = useMemo(() => {
    let base = students;
    if (paymentModalFilter.diploma) base = base.filter(s => s.diploma === paymentModalFilter.diploma);
    if (paymentModalFilter.major) base = base.filter(s => s.major === paymentModalFilter.major);
    return [...new Set(base.map(s => s.year).filter(Boolean))].sort();
  }, [students, paymentModalFilter.diploma, paymentModalFilter.major]);
  const modalStudents = useMemo(() => {
    return students.filter(s => {
      if (paymentModalFilter.diploma && s.diploma !== paymentModalFilter.diploma) return false;
      if (paymentModalFilter.major && s.major !== paymentModalFilter.major) return false;
      if (paymentModalFilter.year && s.year !== paymentModalFilter.year) return false;
      return true;
    });
  }, [students, paymentModalFilter]);

  const calculatedSalaries = useMemo(() => {
    return teachers.map(t => {
      const hours = getTeacherMonthlyHours(teacherAttendance, t.id, salaryFilter.month, salaryFilter.year, schedules, getActiveScheduleModule);
      const hourlyRate = parseFloat(t.hourlyRate) || 0;
      const total = hours * hourlyRate;
      const monthName = months[salaryFilter.month];
      const isPaid = salaries.some(s => s.teacherId === t.id && s.month === monthName && s.year === salaryFilter.year);
      return { ...t, hours, hourlyRate, total, isPaid };
    });
  }, [teachers, teacherAttendance, salaryFilter, salaries, schedules, getActiveScheduleModule]);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearchTerm.trim().toLowerCase();
    return calculatedSalaries.filter(t => {
      if (salaryStatusFilter && (t.isPaid ? 'paid' : 'unpaid') !== salaryStatusFilter) return false;
      if (!q) return true;
      return `${t.name}`.toLowerCase().includes(q);
    });
  }, [calculatedSalaries, teacherSearchTerm, salaryStatusFilter]);

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

  const paginatedSalaries = useMemo(() => {
    return salaries.slice((salariesPage - 1) * itemsPerPage, salariesPage * itemsPerPage);
  }, [salaries, salariesPage, itemsPerPage]);
  
  const totalSalariesPages = Math.ceil(salaries.length / itemsPerPage);

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
    const monthPayments = payments.filter(p => isSelectedMonth(p.month));
    const totalRevenue = monthPayments.reduce((acc, p) => acc + getPaymentTotal(p), 0);
    const totalSalaries = salaries
      .filter(s => isSelectedMonth(s.month))
      .reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
    const totalOtherExpenses = (expenses || [])
      .filter(e => isSelectedMonth(e.month))
      .reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
    const totalExpenses = totalSalaries + totalOtherExpenses;
    const paidStudentIds = new Set(monthPayments.map(p => p.studentId).filter(Boolean));
    const totalStudents = students.length;
    const tauxRecouvrement = totalStudents > 0 ? Math.round((paidStudentIds.size / totalStudents) * 100) : 0;
    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      salariesTotal: totalSalaries,
      otherExpenses: totalOtherExpenses,
      balance: totalRevenue - totalExpenses,
      pendingSalaries: calculatedSalaries.filter(s => !s.isPaid).reduce((acc, s) => acc + s.total, 0),
      tauxRecouvrement,
      paidStudents: paidStudentIds.size,
      totalStudents
    };
  }, [payments, salaries, expenses, calculatedSalaries, summaryMonthFilter, currentMonthName, students]);

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
    students.forEach(student => {
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

        if (!paidMonthKeys.has(months[mIdx].toLowerCase())) {
          overdue++;
        } else {
          break;
        }
      }
      if (overdue >= 2) result[student.id] = overdue;
    });
    return result;
  }, [students, payments, months]);

  const overdueStudents = useMemo(() => {
    return students
      .filter(s => overdueMap[s.id])
      .sort((a, b) =>
        overdueMap[b.id] - overdueMap[a.id] ||
        `${a.lastName || ''} ${a.firstName || ''}`.localeCompare(`${b.lastName || ''} ${b.firstName || ''}`)
      );
  }, [students, overdueMap]);

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
      <div className="flex-center" style={{ minHeight: 'calc(100vh - 150px)', width: '100%' }}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-premium" style={{ padding: 'var(--space-10)', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', background: 'var(--primary-ultra-light)', borderRadius: 'var(--radius-3xl)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)', color: 'var(--primary)' }}>
            <Lock size={32} />
          </div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: '900', marginBottom: 'var(--space-2)' }}>Espace Direction</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-8)' }}>Accès restreint à la gestion financière de l'IPFP.</p>
          <form onSubmit={handleLogin}>
            <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
              <input type={showPassword ? 'text' : 'password'} className="input-premium" placeholder="Mot de passe confidentiel" style={{ width: '100%', textAlign: 'center', padding: '14px', paddingRight: '48px' }} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex' }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button type="submit" className="btn-modern primary" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
              Déverrouiller <ArrowRight size={18} style={{ marginLeft: '8px' }} />
            </button>
            <button type="button" onClick={logout} className="btn-modern" style={{ width: '100%', justifyContent: 'center', padding: '14px', marginTop: '12px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              Se déconnecter de l'application
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="section-padding">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '900', color: 'var(--text-primary)' }}>Gestion Financière</h1>
          <p style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Tableau de bord des flux et de la trésorerie</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={logoutDirector}
            className="btn-modern"
            style={{
              background: 'rgba(234, 179, 8, 0.14)',
              color: '#a16207',
              border: '1px solid rgba(234, 179, 8, 0.35)'
            }}
            title="Verrouiller l'espace direction"
          >
            <Lock size={16} style={{ marginRight: '8px' }} /> Verrouiller
          </button>
          <button onClick={logout} className="btn-modern" style={{ background: 'var(--danger-ultra-light)', color: 'var(--danger)', border: '1px solid var(--danger-bg)' }}>
            <RotateCcw size={16} style={{ marginRight: '8px' }} /> Déconnexion
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CalendarDays size={18} style={{ color: 'var(--primary)' }} />
          <div>
            <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Indicateurs du mois</p>
            <p style={{ fontSize: '14px', fontWeight: '900', color: 'var(--text-primary)' }}>{summaryMonthFilter}</p>
          </div>
        </div>
        <FilterSelect
          style={{ minWidth: '160px' }}
          value={summaryMonthFilter}
          onChange={(val) => setSummaryMonthFilter(val)}
          options={months.map(m => ({ value: m, label: m }))}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <StatCard title="Revenus Totaux" value={stats.revenue} icon={TrendingUp} color="var(--success)" />
        <StatCard title="Total Charges" value={stats.expenses} icon={TrendingDown} color="var(--danger)" />
        <StatCard title="Bénéfice Net" value={stats.balance} icon={Wallet} color="var(--primary)" />
        <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid #2563eb' }}>
          <p style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={14} style={{ color: '#2563eb' }} /> Taux de recouvrement
          </p>
          <p style={{ fontSize: 'var(--text-3xl)', fontWeight: '900', color: '#2563eb' }}>{stats.tauxRecouvrement}<span style={{ fontSize: '16px' }}>%</span></p>
          <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginTop: '4px' }}>{stats.paidStudents} / {stats.totalStudents} stagiaires · {summaryMonthFilter}</p>
        </div>
      </div>

      <div className="modern-tabs-container" style={{ marginBottom: 'var(--space-6)' }}>
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
                <input
                  type="text"
                  className="input-premium"
                  style={{ width: '100%', paddingLeft: '38px' }}
                  placeholder="Rechercher un stagiaire ou mois..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPaymentsPage(1);
                  }}
                />
              </div>
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
              {(searchTerm || paymentStatusFilter || paymentMonthFilter !== currentMonthName) && (
                <button
                  className="action-btn"
                  title="Réinitialiser les filtres"
                  onClick={() => {
                    setSearchTerm('');
                    setPaymentStatusFilter('');
                    setPaymentMonthFilter(currentMonthName);
                    setPaymentsPage(1);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => openPaymentModal()} className="btn-modern primary">
                <Plus size={16} style={{ marginRight: '8px' }} /> Enregistrer Paiement
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
            <StatusCountCard
              title="Stagiaires payés"
              value={paymentStatusCounts.paid}
              subtitle={paymentMonthFilter}
              icon={Check}
              color="var(--success)"
              bg="var(--success-bg)"
            />
            <StatusCountCard
              title="Stagiaires impayés"
              value={paymentStatusCounts.unpaid}
              subtitle={paymentMonthFilter}
              icon={RotateCcw}
              color="#a16207"
              bg="rgba(234,179,8,0.12)"
            />
          </div>

          <div className="glass-card" style={{ overflow: 'hidden' }}>
            {loading ? <TableSkeleton rows={8} /> : (
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)' }}>
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
                    <tr><td colSpan="6"><EmptyState title="Aucun paiement" message="Aucune transaction trouvée pour cette recherche." icon="search" /></td></tr>
                  ) : paginatedPayments.map(p => {
                    const student = students.find(s => s.id === p.studentId);
                    const paymentStatus = getPaymentStatusKey(p.status);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={tdStyle}>
                          <p style={{ fontWeight: '700', fontSize: 'var(--text-sm)' }}>{student?.firstName} {student?.lastName}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{student?.major}</p>
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
                        </td>
                        <td style={tdStyle}><span style={{ fontWeight: '700' }}>{p.month}</span></td>
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
                                  title="Modifier"
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
                                  title="Reçu PDF"
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
                                  title="Supprimer"
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CalendarDays size={16} style={{ color: 'var(--text-muted)' }} />
              <FilterSelect
                value={salaryFilter.month.toString()}
                placeholder="Mois"
                onChange={(val) => {
                  setSalaryFilter({...salaryFilter, month: parseInt(val)});
                  setTeachersPage(1);
                }}
                options={months.map((m, i) => ({ value: i.toString(), label: m }))}
              />
            </div>
            <FilterSelect
              value={salaryFilter.year.toString()}
              placeholder="Année"
              onChange={(val) => {
                setSalaryFilter({...salaryFilter, year: parseInt(val)});
                setTeachersPage(1);
              }}
              options={availableYears.map(y => ({ value: y.toString(), label: y.toString() }))}
            />
            <FilterSelect
              style={{ minWidth: '150px' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '200px' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-premium"
                style={{ width: '100%' }}
                placeholder="Rechercher un formateur..."
                value={teacherSearchTerm}
                onChange={e => {
                  setTeacherSearchTerm(e.target.value);
                  setTeachersPage(1);
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
            <StatusCountCard
              title="Formateurs réglés"
              value={salaryStatusCounts.paid}
              subtitle={`${months[salaryFilter.month]} ${salaryFilter.year}`}
              icon={Check}
              color="var(--success)"
              bg="var(--success-bg)"
            />
            <StatusCountCard
              title="Formateurs non réglés"
              value={salaryStatusCounts.unpaid}
              subtitle={`${months[salaryFilter.month]} ${salaryFilter.year}`}
              icon={RotateCcw}
              color="#a16207"
              bg="rgba(234,179,8,0.12)"
            />
            {salaryStatusCounts.unpaid > 0 && (
              <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Action rapide</p>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Valider tous les salaires calculés</p>
                </div>
                <button
                  className="btn-modern primary"
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
                          <button className="action-btn" onClick={() => handleSaveRate(s.id)} title="Confirmer">
                            <Check size={14} style={{ color: 'var(--success)' }} />
                          </button>
                          <button className="action-btn" onClick={() => setEditingTeacherId(null)} title="Annuler">
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
                    <th style={thStyle}>Bénéficiaire</th>
                    <th style={thStyle}>Période</th>
                    <th style={thStyle}>Montant</th>
                    <th style={thStyle}>Date Versement</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSalaries.length === 0 ? (
                    <tr><td colSpan="5"><EmptyState title="Aucun historique" message="Aucun versement n'a encore été enregistré." icon="history" /></td></tr>
                  ) : paginatedSalaries.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
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
                          title="Reçu formateur PDF"
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
                          title="Supprimer"
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
              totalItems={salaries.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setSalariesPage}
            />
          </div>
        </motion.div>
      )}

      {activeTab === 'expenses' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <CalendarDays size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <FilterSelect
              style={{ minWidth: '130px' }}
              value={expenseFilter.month}
              placeholder="Tous les mois"
              onChange={val => {
                setExpenseFilter(f => ({ ...f, month: val }));
                setExpensesPage(1);
              }}
              options={[{ value: '', label: 'Tous les mois' }, ...months.map(m => ({ value: m, label: m }))]}
            />
            <FilterSelect
              style={{ minWidth: '90px' }}
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
              style={{ minWidth: '140px' }}
              value={expenseFilter.category}
              placeholder="Toutes catégories"
              onChange={val => {
                setExpenseFilter(f => ({ ...f, category: val }));
                setExpensesPage(1);
              }}
              options={[{ value: '', label: 'Toutes catégories' }, ...EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))]}
            />
            {(expenseFilter.month || expenseFilter.category) && (
              <button className="action-btn" title="Réinitialiser les filtres"
                onClick={() => {
                  setExpenseFilter({ month: '', year: new Date().getFullYear(), category: '' });
                  setExpensesPage(1);
                }}>
                <X size={14} />
              </button>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>
                  {filteredExpenses.length} charge{filteredExpenses.length !== 1 ? 's' : ''}
                  {expenseFilter.month ? ` · ${expenseFilter.month} ${expenseFilter.year}` : ''}
                </p>
                <p style={{ fontSize: '18px', fontWeight: '900', color: '#dc2626', lineHeight: 1.2 }}>
                  {filteredExpensesTotal.toLocaleString()} DH
                </p>
              </div>
              <button onClick={() => setShowExpenseModal(true)} className="btn-modern primary">
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
                          title="Supprimer"
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
          <div className="glass-card" style={{ padding: 'var(--space-6)', gridColumn: '1 / -1', overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CalendarDays size={22} style={{ color: 'var(--danger)' }} />
                <div>
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '900' }}>Statistiques périodiques</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700' }}>Dépenses et charges par date</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ position: 'relative' }}>
                    <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
                    <input
                      type="date"
                      className="input-premium"
                      value={dailyStatsDate}
                      onChange={(e) => {
                        setDailyStatsDate(e.target.value);
                        setDailyStatsPage(1);
                      }}
                      onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                      style={{ width: '170px', paddingLeft: '34px' }}
                      title="Date de début"
                    />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>au</span>
                  <div style={{ position: 'relative' }}>
                    <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
                    <input
                      type="date"
                      className="input-premium"
                      value={dailyStatsEndDate}
                      onChange={(e) => {
                        setDailyStatsEndDate(e.target.value);
                        setDailyStatsPage(1);
                      }}
                      onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                      style={{ width: '170px', paddingLeft: '34px' }}
                      title="Date de fin"
                    />
                  </div>
                </div>
                {(dailyStatsDate || dailyStatsEndDate) && (
                  <button
                    onClick={() => {
                      setDailyStatsDate('');
                      setDailyStatsEndDate('');
                      setDailyStatsPage(1);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0 12px',
                      height: '36px',
                      background: 'var(--bg-subtle)',
                      color: 'var(--text-secondary)',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '12px',
                      fontWeight: '700',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                  >
                    <X size={14} />
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-xl)', background: 'var(--primary-ultra-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Table2 size={22} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: '900' }}>Récapitulatif annuel</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700' }}>Revenus, charges et solde mois par mois</p>
                </div>
              </div>
              <FilterSelect
                style={{ minWidth: '140px' }}
                value={annualYear.toString()}
                placeholder="Année"
                onChange={val => setAnnualYear(parseInt(val))}
                options={availableYears.map(y => ({ value: y.toString(), label: y.toString() }))}
              />
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
                        <td style={{ ...tdStyle, color: row.salaryAmt > 0 ? 'var(--danger)' : 'var(--text-faint)' }}>
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

      <AnimatePresence>
        {showExpenseModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(6px)' }} onClick={() => setShowExpenseModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="glass-premium" style={{ position: 'relative', width: '100%', maxWidth: '520px', padding: '32px', borderRadius: 'var(--radius-3xl)', boxShadow: 'var(--shadow-xl)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-lg)', background: 'rgba(220,38,38,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt size={20} style={{ color: '#dc2626' }} />
                  </div>
                  <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '900' }}>Ajouter une charge</h2>
                </div>
                <button onClick={() => setShowExpenseModal(false)} className="close-button" aria-label="Fermer la fenêtre" title="Fermer"><X size={20} /></button>
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
                    <input type="date" className="input-premium" style={{ width: '100%', marginTop: '6px' }} value={expenseData.date} onChange={(e) => setExpenseData({...expenseData, date: e.target.value})} onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }} />
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

      <AnimatePresence>
        {showPaymentModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(6px)' }} onClick={() => setShowPaymentModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="glass-premium" style={{ position: 'relative', width: '100%', maxWidth: '560px', maxHeight: '98vh', overflowY: 'auto', padding: '16px', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-xl)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '900' }}>{editingPayment ? 'Modifier le paiement' : 'Enregistrer un Paiement'}</h2>
                <button onClick={() => { setShowPaymentModal(false); setEditingPayment(null); }} className="close-button" aria-label="Fermer la fenêtre" title="Fermer"><X size={20} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {!editingPayment && <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
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
                      onChange={val => setPaymentData({...paymentData, studentId: val})}
                      options={[{ value: '', label: 'Sélectionner un stagiaire...' }, ...modalStudents.map(s => ({ value: s.id, label: `${s.lastName} ${s.firstName}` }))]}
                    />
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={lbl}>Montant (DH)</label>
                    <input type="number" className="input-premium" style={{ width: '100%', marginTop: '6px' }} value={paymentData.amount} onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})} />
                  </div>
                  <div>
                    <label style={lbl}>Mois Concerné</label>
                    <FilterSelect 
                      style={{ width: '100%', marginTop: '6px' }}
                      value={paymentData.month}
                      placeholder="Sélectionner un mois..."
                      onChange={val => setPaymentData({...paymentData, month: val})}
                      options={months.map(m => ({ value: m, label: m }))}
                    />
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
                <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
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
                <button className="btn-modern primary" style={{ width: '100%', padding: '14px', justifyContent: 'center' }}
                  onClick={async () => {
                    if (!paymentData.studentId || paymentGrandTotal <= 0) return showToast('Stagiaire et montant requis', 'warning');
                    const fees = PAYMENT_FEE_FIELDS
                      .map(({ key, label }) => ({ key, label, amount: parseFloat(paymentData[key]) || 0 }))
                      .filter(fee => fee.amount > 0);
                    if (editingPayment) {
                      await updatePayment(editingPayment.id, {
                        ...paymentData,
                        tuitionAmount: paymentBaseAmount,
                        amount: paymentGrandTotal,
                        fees
                      });
                      setEditingPayment(null);
                    } else {
                      await addPayment({
                        ...paymentData,
                        tuitionAmount: paymentBaseAmount,
                        amount: paymentGrandTotal,
                        fees
                      });
                    }
                    setShowPaymentModal(false);
                    setPaymentData({ studentId: '', amount: '', examFee: '', registrationFee: '', supportFee: '', month: currentMonthName, date: new Date().toISOString().split('T')[0], status: 'payé' });
                    setPaymentModalFilter({ diploma: '', major: '', year: '' });
                  }}><CreditCard size={18} style={{ marginRight: '8px' }} /> {editingPayment ? 'Enregistrer les modifications' : "Valider l'encaissement"}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="glass-card" style={{ padding: '24px', borderLeft: `4px solid ${color}` }}>
    <p style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <Icon size={14} style={{ color }} /> {title}
    </p>
    <p style={{ fontSize: 'var(--text-3xl)', fontWeight: '900', color }}>{value.toLocaleString()} <span style={{ fontSize: '16px' }}>DH</span></p>
  </div>
);

const StatusCountCard = ({ title, value, subtitle, icon: Icon, color, bg }) => (
  <div className="glass-card" style={{ padding: '20px', borderLeft: `4px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
    <div>
      <p style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Icon size={14} style={{ color }} /> {title}
      </p>
      <p style={{ fontSize: 'var(--text-3xl)', fontWeight: '900', color }}>{value.toLocaleString()}</p>
      <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginTop: '4px' }}>{subtitle}</p>
    </div>
    <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-xl)', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
      <Icon size={22} />
    </div>
  </div>
);

const thStyle = { padding: '16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle = { padding: '16px', fontSize: 'var(--text-sm)' };
const lbl = { fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };

export default FinanceDashboard;
