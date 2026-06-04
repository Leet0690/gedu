import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { TableSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import {
  Activity,
  CalendarDays,
  Clock3,
  Globe2,
  MonitorSmartphone,
  RefreshCw,
  Search,
  ShieldCheck
} from 'lucide-react';

const thStyle = {
  padding: '15px 16px',
  fontSize: 'var(--text-xs)',
  fontWeight: '800',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap'
};

const tdStyle = {
  padding: '16px',
  borderTop: '1px solid var(--border-light)',
  verticalAlign: 'top',
  fontSize: 'var(--text-sm)'
};

const formatDateKey = (date) => {
  if (!date) return '';
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const getLogDate = (log) => {
  if (log?.loggedAt) {
    const date = new Date(log.loggedAt);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (log?.createdAt?.toDate) return log.createdAt.toDate();
  if (log?.date) {
    const date = new Date(`${log.date}T${log.time || '00:00:00'}`);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
};

const getDateText = (log) => {
  const date = getLogDate(log);
  if (date) return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return log?.date || '-';
};

const getTimeText = (log) => {
  if (log?.time) return log.time;
  const date = getLogDate(log);
  if (date) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return '-';
};

const matchesPeriod = (log, period) => {
  if (period === 'all') return true;
  const date = getLogDate(log);
  if (!date) return false;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const logStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (period === 'today') return formatDateKey(logStart) === formatDateKey(todayStart);
  if (period === 'week') {
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - 6);
    return logStart >= weekStart && logStart <= todayStart;
  }
  return true;
};

const StatCard = ({ label, value, icon: Icon, color = 'var(--primary)' }) => (
  <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
    <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-xl)', background: 'var(--primary-ultra-light)', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={19} />
    </div>
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</p>
    </div>
  </div>
);

const AccessLogs = () => {
  const { accessLogs = [], loadAccessLogs } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsRefreshing(true);
    loadAccessLogs?.().finally(() => {
      if (isMounted) setIsRefreshing(false);
    });
    return () => { isMounted = false; };
  }, [loadAccessLogs]);

  const filteredLogs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return (accessLogs || []).filter(log => {
      if (!matchesPeriod(log, period)) return false;
      if (!term) return true;
      return [
        log.ipAddress,
        log.deviceName,
        log.browser,
        log.os,
        log.deviceType,
        log.hostname,
        log.path,
        log.accessType,
        log.date,
        log.time
      ].filter(Boolean).some(value => String(value).toLowerCase().includes(term));
    });
  }, [accessLogs, period, searchTerm]);

  const stats = useMemo(() => {
    const uniqueIps = new Set((accessLogs || []).map(log => log.ipAddress).filter(Boolean));
    const uniqueDevices = new Set((accessLogs || []).map(log => log.deviceName).filter(Boolean));
    const todayKey = formatDateKey(new Date());
    const todayCount = (accessLogs || []).filter(log => {
      const date = getLogDate(log);
      return date && formatDateKey(date) === todayKey;
    }).length;

    return {
      total: accessLogs.length,
      uniqueIps: uniqueIps.size,
      uniqueDevices: uniqueDevices.size,
      today: todayCount
    };
  }, [accessLogs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAccessLogs?.();
    setIsRefreshing(false);
  };

  return (
    <div className="section-padding" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '900', color: 'var(--text-primary)' }}>Journal des accès</h1>
          <p style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Adresses IP, appareils détectés, dates et heures de connexion.</p>
        </div>
        <button onClick={handleRefresh} className="btn-modern" disabled={isRefreshing} style={{ background: 'var(--bg-subtle)' }}>
          <RefreshCw size={16} className={isRefreshing ? 'spinner' : ''} style={{ marginRight: '8px' }} />
          Actualiser
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 'var(--space-4)' }}>
        <StatCard label="Accès enregistrés" value={stats.total} icon={Activity} />
        <StatCard label="Aujourd'hui" value={stats.today} icon={Clock3} color="var(--success)" />
        <StatCard label="IP uniques" value={stats.uniqueIps} icon={Globe2} color="var(--accent)" />
        <StatCard label="Appareils" value={stats.uniqueDevices} icon={MonitorSmartphone} color="var(--warning)" />
      </div>

      <div className="glass-card" style={{ padding: 'var(--space-4)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
          <input
            className="input-premium"
            style={{ width: '100%', paddingLeft: '38px' }}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Rechercher IP, appareil, page..."
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CalendarDays size={16} style={{ color: 'var(--text-muted)' }} />
          <select className="input-premium" value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="all">Tous les accès</option>
            <option value="today">Aujourd'hui</option>
            <option value="week">7 derniers jours</option>
          </select>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ overflow: 'hidden' }}>
        {isRefreshing && accessLogs.length === 0 ? (
          <div style={{ padding: 'var(--space-4)' }}>
            <TableSkeleton rows={8} />
          </div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState title="Aucun accès trouvé" message="Aucun accès ne correspond aux filtres sélectionnés." icon="search" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '880px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th style={thStyle}>Adresse IP</th>
                  <th style={thStyle}>Appareil</th>
                  <th style={thStyle}>Accès</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Heure</th>
                  <th style={thStyle}>Détails</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', fontWeight: '800', color: 'var(--text-primary)' }}>
                        <Globe2 size={15} style={{ color: 'var(--primary)' }} />
                        {log.ipAddress || 'Non disponible'}
                      </div>
                      {log.hostname && <p style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-faint)' }}>{log.hostname}</p>}
                    </td>
                    <td style={tdStyle}>
                      <p style={{ fontWeight: '800', color: 'var(--text-primary)' }}>{log.deviceName || 'Appareil inconnu'}</p>
                      <p style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {[log.os, log.browser, log.deviceType].filter(Boolean).join(' / ') || '-'}
                      </p>
                    </td>
                    <td style={tdStyle}>
                      <span className="badge-status success" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                        <ShieldCheck size={12} />
                        {log.accessType || 'app'}
                      </span>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{log.path || '/'}</p>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: '800', color: 'var(--text-primary)' }}>{getDateText(log)}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: '800', color: 'var(--text-primary)' }}>{getTimeText(log)}</span>
                    </td>
                    <td style={tdStyle}>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{log.screenSize || '-'}</p>
                      <p style={{ marginTop: '4px', maxWidth: '260px', fontSize: '10px', color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.userAgent || ''}>
                        {log.userAgent || '-'}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AccessLogs;
