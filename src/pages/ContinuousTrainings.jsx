import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { jsPDF } from 'jspdf';
import { logoBase64 } from '../utils/logoBase64';
import {
  BookOpen, Plus, Trash2, Edit3, X, Users, CalendarDays, Wallet,
  Search, ChevronDown, Phone, Mail, Clock,
  CheckCircle, FileDown, MapPin, GraduationCap,
  Languages, Monitor, Percent, BarChart3, User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';

const START_HOUR = 8;
const END_HOUR = 19;
const PX_PER_HOUR = 64;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const totalGridHeight = (END_HOUR - START_HOUR + 1) * PX_PER_HOUR;

const parseTimeRange = (t = '') => {
  const parts = t.split('-');
  if (parts.length < 2) return { start: '08:00', end: '10:00' };
  const fmt = s => { const p = s.replace(/h/gi, ':').trim().split(':'); return `${p[0].padStart(2,'0')}:${(p[1]||'00').padStart(2,'0')}`; };
  return { start: fmt(parts[0]), end: fmt(parts[1]) };
};
const timeToPixels = (t = '08:00') => {
  const [h, m] = t.split(':').map(Number);
  return ((h - START_HOUR) * 60 + (m || 0)) * (PX_PER_HOUR / 60);
};

const TRAINING_TYPES = [
  { value: 'langue', label: 'Langue', icon: Languages, color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  { value: 'informatique', label: 'Informatique', icon: Monitor, color: '#b068b9', bg: 'rgba(176,104,185,0.08)' },
];
const typeConfig = type => TRAINING_TYPES.find(t => t.value === type) || { value: type, label: type || 'Autre', icon: BookOpen, color: '#64748b', bg: 'rgba(100,116,139,0.08)' };

const TABS = [
  { id: 'formations', label: 'Formations', icon: BookOpen },
  { id: 'etudiants', label: 'Étudiants', icon: Users },
  { id: 'planning', label: 'Planning', icon: CalendarDays },
  { id: 'salaires', label: 'Salaires', icon: Wallet },
];

const Modal = ({ open, onClose, title, children, width = 560 }) => (
  <AnimatePresence>
    {open && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(6px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px' }}
        onClick={e => e.target === e.currentTarget && onClose()}>
        <motion.div initial={{ opacity:0,scale:0.94,y:16 }} animate={{ opacity:1,scale:1,y:0 }} exit={{ opacity:0,scale:0.94 }}
          style={{ background:'white',borderRadius:'20px',width:'100%',maxWidth:width,maxHeight:'90vh',overflow:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.18)' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 24px',borderBottom:'1px solid #f0f0f0',position:'sticky',top:0,background:'white',zIndex:1 }}>
            <h2 style={{ fontSize:'16px',fontWeight:'800',color:'var(--text-primary)',margin:0 }}>{title}</h2>
            <button onClick={onClose} style={{ width:'32px',height:'32px',borderRadius:'50%',background:'#f5f5f5',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><X size={16}/></button>
          </div>
          <div style={{ padding:'24px' }}>{children}</div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom:'16px' }}>
    <label style={{ display:'block',fontSize:'11px',fontWeight:'700',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px' }}>{label}</label>
    {children}
  </div>
);

const Inp = (props) => <input {...props} className="input-premium" style={{ width:'100%',boxSizing:'border-box',...(props.style||{}) }} />;

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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…" className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {TRAINING_TYPES.map(t=><SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            {Array.from(new Set(trainings.map(t=>t.type))).filter(t=>t&&!TRAINING_TYPES.some(tt=>tt.value===t)).map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={onAdd} className="gap-2">
          <Plus className="h-4 w-4"/> Nouvelle formation
        </Button>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-10 w-10 opacity-30 mx-auto mb-3" />
          <p className="font-semibold text-sm">Aucune formation continue</p>
          <p className="text-xs mt-1">Créez votre première formation pour commencer</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(tr => {
            const cfg = typeConfig(tr.type);
            const Icon = cfg.icon;
            const studentCount = ctStudents.filter(s=>s.trainingId===tr.id).length;
            const totalPaid = ctStudents.filter(s=>s.trainingId===tr.id)
              .reduce((sum,s) => sum+(s.payments||[]).reduce((a,p)=>a+Number(p.amount||0),0), 0);
            return (
              <Card key={tr.id} className="transition-all hover:-translate-y-1 hover:shadow-lg">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold m-0">{tr.name}</p>
                        <Badge variant="secondary" className="text-[10px] px-2 py-0 mt-1" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={()=>onEdit(tr)}><Edit3 size={13}/></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={()=>onDelete(tr)}><Trash2 size={13}/></Button>
                    </div>
                  </div>
                  {tr.description && <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{tr.description}</p>}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground"><User size={11}/><span className="font-semibold">{tr.teacherName||'—'}</span></div>
                    <div className="flex items-center gap-1.5 text-muted-foreground"><Users size={11}/><span className="font-semibold">{studentCount} étudiant{studentCount!==1?'s':''}</span></div>
                    <div className="flex items-center gap-1.5 text-muted-foreground"><span className="font-semibold">{Number(tr.pricePerStudent||0).toLocaleString()} DH</span></div>
                    <div className="flex items-center gap-1.5 text-muted-foreground"><Percent size={11}/><span className="font-semibold">{tr.teacherPct||0}% formateur</span></div>
                  </div>
                  <div className="pt-3 border-t flex justify-between items-center">
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
    if (search) { const q = search.toLowerCase(); return (s.firstName+' '+s.lastName).toLowerCase().includes(q)||(s.phone||'').includes(q); }
    return true;
  }), [ctStudents, trainingFilter, search]);
  const getTraining = id => trainings.find(t=>t.id===id);

  return (
    <div>
      <div style={{ display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px',flexWrap:'wrap' }}>
        <div style={{ position:'relative',flex:1,minWidth:'200px' }}>
          <Search size={14} style={{ position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un étudiant…" className="input-premium" style={{ paddingLeft:'36px',width:'100%',boxSizing:'border-box' }}/>
        </div>
        <select value={trainingFilter} onChange={e=>setTrainingFilter(e.target.value)} className="input-premium" style={{ width:'210px' }}>
          <option value="">Toutes les formations</option>
          {trainings.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button onClick={()=>onAddStudent(trainingFilter)} className="btn-modern" style={{ display:'flex',alignItems:'center',gap:'6px',whiteSpace:'nowrap' }}>
          <Plus size={15}/> Ajouter étudiant
        </button>
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center',padding:'60px 0',color:'var(--text-muted)' }}>
          <Users size={40} style={{ opacity:0.3,display:'block',margin:'0 auto 12px' }}/>
          <p style={{ fontSize:'14px',fontWeight:'600' }}>Aucun étudiant enregistré</p>
        </div>
      ) : (
        <div className="glass-card" style={{ overflow:'hidden' }}>
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--bg-subtle)' }}>
                {['Étudiant','Formation','Contact','Paiements','Statut','Actions'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px',textAlign:'left',fontSize:'11px',fontWeight:'700',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s,i) => {
                const tr = getTraining(s.trainingId);
                const totalDue = Number(tr?.pricePerStudent||0);
                const totalPaid = (s.payments||[]).reduce((a,p)=>a+Number(p.amount||0),0);
                const remaining = totalDue - totalPaid;
                const isPaid = totalDue>0 && remaining<=0;
                const cfg = typeConfig(tr?.type);
                return (
                  <React.Fragment key={s.id}>
                    <tr style={{ borderTop:i>0?'1px solid var(--border-light)':'none',background:expandedId===s.id?'rgba(176,104,185,0.03)':'transparent' }}>
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ display:'flex',alignItems:'center',gap:'10px' }}>
                          <div style={{ width:'32px',height:'32px',borderRadius:'50%',background:'var(--primary-ultra-light)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'800',color:'var(--primary)',flexShrink:0 }}>
                            {(s.firstName?.[0]||'?').toUpperCase()}
                          </div>
                          <p style={{ fontSize:'13px',fontWeight:'700',color:'var(--text-primary)',margin:0 }}>{s.firstName} {s.lastName}</p>
                        </div>
                      </td>
                      <td style={{ padding:'12px 14px' }}><span style={{ fontSize:'11px',fontWeight:'700',color:cfg.color,background:cfg.bg,padding:'3px 8px',borderRadius:'20px' }}>{tr?.name||'—'}</span></td>
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ fontSize:'11px',color:'var(--text-muted)',display:'flex',flexDirection:'column',gap:'2px' }}>
                          {s.phone&&<div style={{ display:'flex',alignItems:'center',gap:'4px' }}><Phone size={10}/>{s.phone}</div>}
                        </div>
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ fontSize:'12px' }}>
                          <span style={{ fontWeight:'800',color:'#16a34a' }}>{totalPaid.toLocaleString()} DH</span>
                          {totalDue>0&&<span style={{ color:'var(--text-muted)' }}> / {totalDue.toLocaleString()}</span>}
                        </div>
                        {remaining>0&&<div style={{ fontSize:'10px',color:'#ef4444',fontWeight:'600' }}>Reste: {remaining.toLocaleString()} DH</div>}
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        <span style={{ fontSize:'11px',fontWeight:'700',padding:'3px 10px',borderRadius:'20px',
                          background:isPaid?'rgba(22,163,74,0.1)':(totalPaid>0?'rgba(245,158,11,0.1)':'rgba(239,68,68,0.08)'),
                          color:isPaid?'#16a34a':(totalPaid>0?'#d97706':'#ef4444') }}>
                          {isPaid?'✓ Soldé':(totalPaid>0?'Partiel':'Non payé')}
                        </span>
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ display:'flex',gap:'4px' }}>
                          <button onClick={()=>setExpandedId(expandedId===s.id?null:s.id)} title="Paiements"
                            style={{ width:'28px',height:'28px',borderRadius:'8px',background:'var(--bg-subtle)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)' }}>
                            <ChevronDown size={13} style={{ transform:expandedId===s.id?'rotate(180deg)':'none',transition:'0.2s' }}/>
                          </button>
                          <button onClick={()=>onGeneratePDF(s,tr)} title="Attestation PDF"
                            style={{ width:'28px',height:'28px',borderRadius:'8px',background:'rgba(37,99,235,0.08)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#2563eb' }}>
                            <FileDown size={13}/>
                          </button>
                          <button onClick={()=>onEditStudent(s)} title="Modifier"
                            style={{ width:'28px',height:'28px',borderRadius:'8px',background:'var(--bg-subtle)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)' }}>
                            <Edit3 size={13}/>
                          </button>
                          <button onClick={()=>onDeleteStudent(s)} title="Supprimer"
                            style={{ width:'28px',height:'28px',borderRadius:'8px',background:'rgba(239,68,68,0.08)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#ef4444' }}>
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expandedId===s.id&&(
                        <tr><td colSpan={6} style={{ padding:0 }}>
                          <motion.div initial={{ height:0,opacity:0 }} animate={{ height:'auto',opacity:1 }} exit={{ height:0,opacity:0 }} style={{ overflow:'hidden' }}>
                            <div style={{ padding:'14px 24px',background:'#fafafa',borderBottom:'1px solid var(--border-light)' }}>
                              <p style={{ fontSize:'12px',fontWeight:'800',color:'var(--text-primary)',marginBottom:'10px' }}>Historique des paiements</p>
                              {(s.payments||[]).length===0
                                ? <p style={{ fontSize:'12px',color:'var(--text-muted)' }}>Aucun paiement enregistré</p>
                                : <div style={{ display:'flex',flexDirection:'column',gap:'6px' }}>
                                    {(s.payments||[]).map((p,pi)=>(
                                      <div key={pi} style={{ display:'flex',alignItems:'center',gap:'10px',fontSize:'12px' }}>
                                        <CheckCircle size={12} style={{ color:'#16a34a' }}/>
                                        <span style={{ fontWeight:'700',color:'#16a34a',minWidth:'80px' }}>{Number(p.amount).toLocaleString()} DH</span>
                                        <span style={{ color:'var(--text-muted)' }}>{p.date}</span>
                                        {p.note&&<span style={{ color:'var(--text-muted)',fontStyle:'italic' }}>{p.note}</span>}
                                      </div>
                                    ))}
                                  </div>
                              }
                            </div>
                          </motion.div>
                        </td></tr>
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
  const filtered = useMemo(()=>sessions.filter(s=>!trainingFilter||s.trainingId===trainingFilter),[sessions,trainingFilter]);
  const activeDays = useMemo(()=>DAYS.filter(d=>filtered.some(s=>s.day===d)),[filtered]);
  const getTraining = id => trainings.find(t=>t.id===id);

  return (
    <div>
      <div style={{ display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px',flexWrap:'wrap' }}>
        <select value={trainingFilter} onChange={e=>setTrainingFilter(e.target.value)} className="input-premium" style={{ width:'220px' }}>
          <option value="">Toutes les formations</option>
          {trainings.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div style={{ display:'flex',gap:'4px',background:'var(--bg-subtle)',borderRadius:'10px',padding:'3px' }}>
          {['list','grid'].map(v=>(
            <button key={v} onClick={()=>setViewMode(v)} style={{ padding:'6px 14px',borderRadius:'8px',border:'none',cursor:'pointer',fontSize:'12px',fontWeight:'700',
              background:viewMode===v?'white':'transparent',color:viewMode===v?'var(--primary)':'var(--text-muted)',
              boxShadow:viewMode===v?'var(--shadow-xs)':'none',transition:'all 0.15s' }}>
              {v==='list'?'Liste':'Grille'}
            </button>
          ))}
        </div>
        <button onClick={onAddSession} className="btn-modern" style={{ display:'flex',alignItems:'center',gap:'6px',marginLeft:'auto',whiteSpace:'nowrap' }}>
          <Plus size={15}/> Ajouter séance
        </button>
      </div>
      {viewMode==='list' ? (
        filtered.length===0
          ? <div style={{ textAlign:'center',padding:'60px 0',color:'var(--text-muted)' }}><CalendarDays size={40} style={{ opacity:0.3,display:'block',margin:'0 auto 12px' }}/><p style={{ fontSize:'14px',fontWeight:'600' }}>Aucune séance planifiée</p></div>
          : <div className="glass-card" style={{ overflow:'hidden' }}>
              <table style={{ width:'100%',borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'var(--bg-subtle)' }}>
                  {['Jour','Horaire','Formation','Formateur','Salle',''].map(h=>(
                    <th key={h} style={{ padding:'10px 14px',textAlign:'left',fontSize:'11px',fontWeight:'700',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((s,i)=>{
                    const tr=getTraining(s.trainingId); const cfg=typeConfig(tr?.type);
                    return (
                      <tr key={s.id} style={{ borderTop:i>0?'1px solid var(--border-light)':'none' }}>
                        <td style={{ padding:'10px 14px',fontSize:'12px',fontWeight:'700',color:'var(--text-primary)' }}>{s.day}</td>
                        <td style={{ padding:'10px 14px' }}><div style={{ display:'flex',alignItems:'center',gap:'5px',fontSize:'12px',fontWeight:'700' }}><Clock size={11} style={{ color:'var(--text-muted)' }}/>{s.time}</div></td>
                        <td style={{ padding:'10px 14px' }}><span style={{ fontSize:'11px',fontWeight:'700',color:cfg.color,background:cfg.bg,padding:'3px 8px',borderRadius:'20px' }}>{tr?.name||'—'}</span></td>
                        <td style={{ padding:'10px 14px',fontSize:'12px',color:'var(--text-muted)' }}>{tr?.teacherName||'—'}</td>
                        <td style={{ padding:'10px 14px' }}>{s.room&&<div style={{ display:'flex',alignItems:'center',gap:'4px',fontSize:'12px',color:'var(--text-muted)' }}><MapPin size={11}/>{s.room}</div>}</td>
                        <td style={{ padding:'10px 14px' }}>
                          <button onClick={()=>onDeleteSession(s)} style={{ width:'28px',height:'28px',borderRadius:'8px',background:'rgba(239,68,68,0.08)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#ef4444' }}><Trash2 size={13}/></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
      ) : (
        <div className="glass-card" style={{ padding:'20px',overflowX:'auto' }}>
          {activeDays.length===0
            ? <div style={{ textAlign:'center',padding:'60px 0',color:'var(--text-muted)' }}><CalendarDays size={40} style={{ opacity:0.3,display:'block',margin:'0 auto 12px' }}/><p style={{ fontSize:'14px',fontWeight:'600' }}>Aucune séance à afficher</p></div>
            : <div style={{ display:'grid',gridTemplateColumns:'56px repeat('+activeDays.length+', minmax(140px, 1fr))',gap:0,minWidth:'400px' }}>
                <div/>
                {activeDays.map(day=>(
                  <div key={day} style={{ padding:'8px 4px',textAlign:'center',fontSize:'11px',fontWeight:'800',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',borderBottom:'2px solid var(--border-light)' }}>{day.slice(0,3)}</div>
                ))}
                <div style={{ borderRight:'1px solid var(--border-light)' }}>
                  {HOURS.map(h=>(
                    <div key={h} style={{ height:PX_PER_HOUR+'px',display:'flex',alignItems:'flex-start',justifyContent:'flex-end',paddingRight:'8px',paddingTop:'6px' }}>
                      <span style={{ fontSize:'10px',fontWeight:'700',color:'var(--text-faint)' }}>{h}:00</span>
                    </div>
                  ))}
                </div>
                {activeDays.map(day=>{
                  const daySessions=filtered.filter(s=>s.day===day);
                  return (
                    <div key={day} style={{ position:'relative',height:totalGridHeight+'px',borderRight:'1px solid var(--border-light)' }}>
                      {HOURS.map(h=>(<div key={h} style={{ position:'absolute',top:((h-START_HOUR)*PX_PER_HOUR)+'px',left:0,right:0,height:PX_PER_HOUR+'px',borderTop:'1px solid var(--border-light)' }}/>))}
                      {daySessions.map(s=>{
                        const {start,end}=parseTimeRange(s.time);
                        const top=timeToPixels(start);
                        const height=Math.max(timeToPixels(end)-top,PX_PER_HOUR*0.75);
                        const tr=getTraining(s.trainingId); const cfg=typeConfig(tr?.type);
                        return (
                          <div key={s.id} style={{ position:'absolute',left:'3px',right:'3px',top:top+'px',height:height+'px',background:cfg.bg,borderLeft:'3px solid '+cfg.color,borderRadius:'6px',padding:'4px 6px',overflow:'hidden' }}>
                            <p style={{ fontSize:'10px',fontWeight:'800',color:cfg.color,margin:'0 0 1px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{tr?.name}</p>
                            <p style={{ fontSize:'9px',color:'var(--text-muted)',margin:0 }}>{s.time}</p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
          }
        </div>
      )}
    </div>
  );
}

function SalairesTab({ trainings, ctStudents }) {
  const rows = useMemo(()=>trainings.map(tr=>{
    const students=ctStudents.filter(s=>s.trainingId===tr.id);
    const totalEncaisse=students.reduce((sum,s)=>sum+(s.payments||[]).reduce((a,p)=>a+Number(p.amount||0),0),0);
    const pct=Number(tr.teacherPct||0);
    const salary=Math.round(totalEncaisse*pct/100);
    return { tr, students, totalEncaisse, pct, salary, cfg:typeConfig(tr.type) };
  }),[trainings,ctStudents]);
  const totalRevenue=rows.reduce((a,r)=>a+r.totalEncaisse,0);
  const totalSalaries=rows.reduce((a,r)=>a+r.salary,0);

  return (
    <div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))',gap:'14px',marginBottom:'24px' }}>
        {[
          { label:'Revenu total',value:totalRevenue.toLocaleString()+' DH',color:'#16a34a',icon:Wallet },
          { label:'Total salaires',value:totalSalaries.toLocaleString()+' DH',color:'#b068b9',icon:User },
          { label:'Marge nette',value:(totalRevenue-totalSalaries).toLocaleString()+' DH',color:'#2563eb',icon:BarChart3 },
          { label:'Formations',value:trainings.length,color:'#f59e0b',icon:BookOpen },
        ].map(k=>(
          <div key={k.label} className="glass-card" style={{ padding:'16px' }}>
            <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px' }}>
              <div style={{ width:'28px',height:'28px',borderRadius:'8px',background:k.color+'15',display:'flex',alignItems:'center',justifyContent:'center' }}><k.icon size={14} style={{ color:k.color }}/></div>
              <span style={{ fontSize:'10px',fontWeight:'700',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em' }}>{k.label}</span>
            </div>
            <p style={{ fontSize:'20px',fontWeight:'900',color:k.color,margin:0 }}>{k.value}</p>
          </div>
        ))}
      </div>
      {rows.length===0
        ? <div style={{ textAlign:'center',padding:'60px 0',color:'var(--text-muted)' }}><Wallet size={40} style={{ opacity:0.3,display:'block',margin:'0 auto 12px' }}/><p style={{ fontSize:'14px',fontWeight:'600' }}>Aucune formation</p></div>
        : <div className="glass-card" style={{ overflow:'hidden' }}>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead><tr style={{ background:'var(--bg-subtle)' }}>
                {['Formation','Formateur','Étudiants','Total encaissé','% Formateur','Salaire','Marge'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px',textAlign:'left',fontSize:'11px',fontWeight:'700',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map(({tr,students,totalEncaisse,pct,salary,cfg},i)=>{
                  const marge=totalEncaisse-salary;
                  return (
                    <tr key={tr.id} style={{ borderTop:i>0?'1px solid var(--border-light)':'none' }}>
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ display:'flex',alignItems:'center',gap:'8px' }}>
                          <div style={{ width:'28px',height:'28px',borderRadius:'8px',background:cfg.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}><cfg.icon size={13} style={{ color:cfg.color }}/></div>
                          <span style={{ fontSize:'13px',fontWeight:'700',color:'var(--text-primary)' }}>{tr.name}</span>
                        </div>
                      </td>
                      <td style={{ padding:'12px 14px',fontSize:'12px',color:'var(--text-muted)' }}>{tr.teacherName||'—'}</td>
                      <td style={{ padding:'12px 14px',fontSize:'13px',fontWeight:'700',color:'var(--text-primary)' }}>{students.length}</td>
                      <td style={{ padding:'12px 14px',fontSize:'13px',fontWeight:'800',color:'#16a34a' }}>{totalEncaisse.toLocaleString()} DH</td>
                      <td style={{ padding:'12px 14px' }}><span style={{ fontSize:'12px',fontWeight:'800',color:cfg.color,background:cfg.bg,padding:'3px 10px',borderRadius:'20px' }}>{pct}%</span></td>
                      <td style={{ padding:'12px 14px',fontSize:'14px',fontWeight:'900',color:'#b068b9' }}>{salary.toLocaleString()} DH</td>
                      <td style={{ padding:'12px 14px',fontSize:'13px',fontWeight:'700',color:marge>=0?'#16a34a':'#ef4444' }}>{marge.toLocaleString()} DH</td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop:'2px solid var(--border-light)',background:'var(--bg-subtle)' }}>
                  <td colSpan={3} style={{ padding:'12px 14px',fontSize:'12px',fontWeight:'800',color:'var(--text-primary)' }}>Total</td>
                  <td style={{ padding:'12px 14px',fontSize:'14px',fontWeight:'900',color:'#16a34a' }}>{totalRevenue.toLocaleString()} DH</td>
                  <td/>
                  <td style={{ padding:'12px 14px',fontSize:'14px',fontWeight:'900',color:'#b068b9' }}>{totalSalaries.toLocaleString()} DH</td>
                  <td style={{ padding:'12px 14px',fontSize:'14px',fontWeight:'900',color:(totalRevenue-totalSalaries)>=0?'#16a34a':'#ef4444' }}>{(totalRevenue-totalSalaries).toLocaleString()} DH</td>
                </tr>
              </tbody>
            </table>
          </div>
      }
    </div>
  );
}

export default function ContinuousTrainings() {
  const navigate = useNavigate();
  const {
    teachers=[], confirmAction,
    continuousTrainings=[], addContinuousTraining, updateContinuousTraining, deleteContinuousTraining,
    ctStudents=[], addCtStudent, updateCtStudent, deleteCtStudent,
    ctSessions=[], addCtSession, deleteCtSession,
  } = useApp();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('formations');

  const [trainingModal, setTrainingModal] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const emptyT = { name:'',type:'langue',description:'',teacherId:'',pricePerStudent:'',teacherPct:'' };
  const [tForm, setTForm] = useState(emptyT);
  const openAddTraining = () => { setEditingTraining(null); setTForm(emptyT); setTrainingModal(true); };
  const openEditTraining = tr => { setEditingTraining(tr); setTForm({ name:tr.name||'',type:tr.type||'langue',description:tr.description||'',teacherId:tr.teacherId||'',pricePerStudent:tr.pricePerStudent||'',teacherPct:tr.teacherPct||'' }); setTrainingModal(true); };
  const saveTraining = async () => {
    if (!tForm.name.trim()) { showToast('Nom requis','error'); return; }
    const teacher=teachers.find(t=>t.id===tForm.teacherId);
    const data={ ...tForm,teacherName:teacher?.name||'',pricePerStudent:Number(tForm.pricePerStudent)||0,teacherPct:Number(tForm.teacherPct)||0 };
    if (editingTraining) { await updateContinuousTraining(editingTraining.id,data); showToast('Formation mise à jour','success'); }
    else { await addContinuousTraining(data); showToast('Formation créée','success'); }
    setTrainingModal(false);
  };
  const handleDeleteTraining = async tr => {
    if (await confirmAction({ title:'Supprimer', message:'Supprimer cette formation ?', type:'danger' })) {
      await deleteContinuousTraining(tr.id);
      showToast('Formation supprimée', 'warning');
    }
  };

  const [studentModal, setStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const emptyS = { firstName:'',lastName:'',phone:'',trainingId:'',payments:[] };
  const [sForm, setSForm] = useState(emptyS);
  const today = new Date().toISOString().split('T')[0];
  const [newPayment, setNewPayment] = useState({ amount:'',date:today });
  const openAddStudent = (preId='') => { setEditingStudent(null); setSForm({...emptyS,trainingId:preId}); setNewPayment({amount:'',date:today}); setStudentModal(true); };
  const openEditStudent = s => { setEditingStudent(s); setSForm({...s}); setNewPayment({amount:'',date:today}); setStudentModal(true); };
  const addPaymentEntry = () => {
    if (!sForm.trainingId) { showToast("Sélectionnez une formation d'abord", 'error'); return; }
    if (!newPayment.amount||isNaN(Number(newPayment.amount))) { showToast('Montant invalide','error'); return; }
    
    const tr = continuousTrainings.find(t => t.id === sForm.trainingId);
    const totalDue = Number(tr?.pricePerStudent || 0);
    const currentPaid = (sForm.payments||[]).reduce((a,p)=>a+Number(p.amount||0), 0);
    const newAmount = Number(newPayment.amount);
    
    if (currentPaid + newAmount > totalDue) {
      showToast(`Le total dépasse le prix de la formation (${totalDue} DH)`, 'error');
      return;
    }

    setSForm(prev=>({...prev,payments:[...(prev.payments||[]),{...newPayment,amount:newAmount}]}));
    setNewPayment({amount:'',date:today});
  };
  const removePaymentEntry = idx => setSForm(prev=>({...prev,payments:prev.payments.filter((_,i)=>i!==idx)}));
  const saveStudent = async () => {
    if (!sForm.firstName.trim()||!sForm.lastName.trim()) { showToast('Nom et prénom requis','error'); return; }
    if (!sForm.trainingId) { showToast('Sélectionnez une formation','error'); return; }
    
    let finalSForm = { ...sForm };
    if (newPayment.amount && !isNaN(Number(newPayment.amount))) {
      const tr = continuousTrainings.find(t => t.id === sForm.trainingId);
      const totalDue = Number(tr?.pricePerStudent || 0);
      const currentPaid = (finalSForm.payments||[]).reduce((a,p)=>a+Number(p.amount||0), 0);
      const newAmount = Number(newPayment.amount);
      
      if (currentPaid + newAmount > totalDue) {
        showToast(`Le paiement en attente dépasse le prix de la formation (${totalDue} DH)`, 'error');
        return;
      }
      finalSForm.payments = [...(finalSForm.payments || []), { ...newPayment, amount: newAmount }];
    }

    if (editingStudent) { await updateCtStudent(editingStudent.id, finalSForm); showToast('Étudiant mis à jour','success'); }
    else { await addCtStudent(finalSForm); showToast('Étudiant ajouté','success'); }
    setStudentModal(false);
  };
  const handleDeleteStudent = async s => {
    if (await confirmAction({ title:'Supprimer', message:'Supprimer cet étudiant ?', type:'danger' })) {
      await deleteCtStudent(s.id);
      showToast('Étudiant supprimé', 'warning');
    }
  };

  const [sessionModal, setSessionModal] = useState(false);
  const emptySes = { trainingId:'',day:'Lundi',startTime:'08:00',endTime:'10:00',room:'' };
  const [sesForm, setSesForm] = useState(emptySes);
  const openAddSession = () => { setSesForm({...emptySes,trainingId:continuousTrainings[0]?.id||''}); setSessionModal(true); };
  const saveSession = async () => {
    if (!sesForm.trainingId) { showToast('Sélectionnez une formation','error'); return; }
    await addCtSession({...sesForm,time:sesForm.startTime+'-'+sesForm.endTime});
    showToast('Séance ajoutée','success'); setSessionModal(false);
  };
  const handleDeleteSession = async s => {
    if (await confirmAction({ title:'Supprimer', message:'Supprimer cette séance ?', type:'danger' })) {
      await deleteCtSession(s.id);
      showToast('Séance supprimée', 'warning');
    }
  };

  const generateAttestation = (student, training) => {
    if (!student||!training) return;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 20, 15, 30, 30);
      } catch (error) {
        console.warn("Impossible d'ajouter le logo à l'attestation:", error);
      }
    }
    doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('INSTITUT POLYTECHNIQUE DE LA FORMATION PROFESSIONNELLE',105,22,{align:'center'});
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text('IPFP — Formation Continue',105,28,{align:'center'});
    doc.setDrawColor(176,104,185); doc.setLineWidth(0.8); doc.line(20,38,190,38);
    doc.setFontSize(20); doc.setFont('helvetica','bold'); doc.setTextColor(176,104,185);
    doc.text('ATTESTATION DE FORMATION',105,60,{align:'center'});
    doc.setTextColor(0); doc.setFontSize(11); doc.setFont('helvetica','normal');
    const lines=[
      'Nous soussignés, Institut Polytechnique de la Formation Professionnelle,',
      'attestons que :','',student.firstName+' '+student.lastName,'',
      'a suivi avec succès la formation :','','« '+training.name+' »',
      'Type : '+typeConfig(training.type).label,
      training.teacherName?'Formateur : '+training.teacherName:'','',
      'Cette attestation est délivrée pour faire valoir ce que de droit.',
    ].filter(Boolean);
    lines.forEach((line,i)=>doc.text(line,25,80+i*7));
    const y=80+lines.length*7+20;
    doc.setFont('helvetica','bold'); doc.text('Date de délivrance :',25,y);
    doc.setFont('helvetica','normal'); doc.text(new Date().toLocaleDateString('fr-FR'),80,y);
    doc.setFont('helvetica','bold'); doc.text('Cachet et Signature :',120,y+20);
    doc.setDrawColor(200); doc.rect(120,y+24,60,25);
    doc.save('Attestation_'+student.firstName+'_'+student.lastName+'.pdf');
    showToast('Attestation générée','success');
  };

  return (
    <div>
      <div style={{ marginBottom:'24px' }}>
        <div style={{ display:'flex',alignItems:'center',gap:'12px',marginBottom:'4px' }}>
          <div style={{ width:'36px',height:'36px',borderRadius:'10px',background:'rgba(176,104,185,0.12)',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <GraduationCap size={18} style={{ color:'#b068b9' }}/>
          </div>
          <h1 style={{ fontSize:'22px',fontWeight:'900',color:'var(--text-primary)',margin:0 }}>Formations Continues</h1>
        </div>
        <p style={{ fontSize:'13px',color:'var(--text-muted)',marginLeft:'48px' }}>Langues · Informatique — Inscriptions, plannings et salaires</p>
      </div>

      <div style={{ display:'flex',gap:'4px',background:'var(--bg-subtle)',borderRadius:'14px',padding:'4px',marginBottom:'24px',width:'fit-content',flexWrap:'wrap' }}>
        {TABS.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            style={{ display:'flex',alignItems:'center',gap:'6px',padding:'8px 18px',borderRadius:'10px',border:'none',cursor:'pointer',fontSize:'13px',fontWeight:'700',
              background:activeTab===tab.id?'white':'transparent',color:activeTab===tab.id?'var(--primary)':'var(--text-muted)',
              boxShadow:activeTab===tab.id?'0 2px 8px rgba(0,0,0,0.08)':'none',transition:'all 0.2s' }}>
            <tab.icon size={14}/>{tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} transition={{ duration:0.2 }}>
          {activeTab==='formations'&&<FormationsTab trainings={continuousTrainings} ctStudents={ctStudents} onAdd={openAddTraining} onEdit={openEditTraining} onDelete={handleDeleteTraining}/>}
          {activeTab==='etudiants'&&<EtudiantsTab trainings={continuousTrainings} ctStudents={ctStudents} onAddStudent={openAddStudent} onEditStudent={openEditStudent} onDeleteStudent={handleDeleteStudent} onGeneratePDF={generateAttestation}/>}
          {activeTab==='planning'&&<PlanningTab sessions={ctSessions} trainings={continuousTrainings} onAddSession={openAddSession} onDeleteSession={handleDeleteSession}/>}
          {activeTab==='salaires'&&<SalairesTab trainings={continuousTrainings} ctStudents={ctStudents}/>}
        </motion.div>
      </AnimatePresence>

      <Modal open={trainingModal} onClose={()=>setTrainingModal(false)} title={editingTraining?'Modifier la formation':'Nouvelle formation'}>
        <Field label="Nom"><Inp value={tForm.name} onChange={e=>setTForm(p=>({...p,name:e.target.value}))} placeholder="Ex: Anglais des affaires"/></Field>
        <Field label="Type">
          <div style={{ display: 'flex', gap: '8px' }}>
            <select 
              value={TRAINING_TYPES.some(t => t.value === tForm.type) ? tForm.type : (tForm.type && Array.from(new Set(continuousTrainings.map(t=>t.type))).filter(t=>t&&!TRAINING_TYPES.some(tt=>tt.value===t)).includes(tForm.type) ? tForm.type : 'custom')} 
              onChange={e => {
                if (e.target.value === 'custom') {
                  setTForm(p => ({...p, type: ''}));
                } else {
                  setTForm(p => ({...p, type: e.target.value}));
                }
              }} 
              className="input-premium" 
              style={{ flex: 1, boxSizing:'border-box' }}
            >
              {TRAINING_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
              {Array.from(new Set(continuousTrainings.map(t=>t.type))).filter(t=>t&&!TRAINING_TYPES.some(tt=>tt.value===t)).map(t=><option key={t} value={t}>{t}</option>)}
              <option value="custom">Nouveau type...</option>
            </select>
            {(!TRAINING_TYPES.some(t => t.value === tForm.type) && !Array.from(new Set(continuousTrainings.map(t=>t.type))).filter(t=>t&&!TRAINING_TYPES.some(tt=>tt.value===t)).includes(tForm.type)) && (
              <Inp 
                value={tForm.type} 
                onChange={e => setTForm(p => ({...p, type: e.target.value}))} 
                placeholder="Nom du type" 
                style={{ flex: 1, boxSizing:'border-box' }} 
                autoFocus
              />
            )}
          </div>
        </Field>
        <Field label="Description">
          <textarea value={tForm.description} onChange={e=>setTForm(p=>({...p,description:e.target.value}))} className="input-premium" rows={2} placeholder="Description courte…" style={{ width:'100%',boxSizing:'border-box',resize:'vertical' }}/>
        </Field>
        <Field label="Formateur">
          <select value={tForm.teacherId} onChange={e=>{
            if (e.target.value === 'add_new') {
              navigate('/admin/add-teacher');
            } else {
              setTForm(p=>({...p,teacherId:e.target.value}))
            }
          }} className="input-premium" style={{ width:'100%',boxSizing:'border-box' }}>
            <option value="">— Choisir un formateur —</option>
            <option value="add_new" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>+ Ajouter un formateur</option>
            {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px' }}>
          <Field label="Prix par étudiant (DH)"><Inp type="number" value={tForm.pricePerStudent} onChange={e=>setTForm(p=>({...p,pricePerStudent:e.target.value}))} placeholder="0"/></Field>
          <Field label="% Formateur (sur encaissé)"><Inp type="number" value={tForm.teacherPct} onChange={e=>setTForm(p=>({...p,teacherPct:e.target.value}))} placeholder="0" min="0" max="100"/></Field>
        </div>
        <div style={{ display:'flex',justifyContent:'flex-end',gap:'10px',marginTop:'4px' }}>
          <button onClick={()=>setTrainingModal(false)} className="btn-ghost">Annuler</button>
          <button onClick={saveTraining} className="btn-modern">{editingTraining?'Enregistrer':'Créer'}</button>
        </div>
      </Modal>

      <Modal open={studentModal} onClose={()=>setStudentModal(false)} title={editingStudent?"Modifier l'étudiant":'Ajouter un étudiant'} width={600}>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px' }}>
          <Field label="Prénom"><Inp value={sForm.firstName} onChange={e=>setSForm(p=>({...p,firstName:e.target.value}))} placeholder="Prénom"/></Field>
          <Field label="Nom"><Inp value={sForm.lastName} onChange={e=>setSForm(p=>({...p,lastName:e.target.value}))} placeholder="Nom"/></Field>
          <Field label="Téléphone"><Inp value={sForm.phone} onChange={e=>setSForm(p=>({...p,phone:e.target.value}))} placeholder="06xxxxxxxx"/></Field>
          <Field label="Formation">
            <select value={sForm.trainingId} onChange={e=>setSForm(p=>({...p,trainingId:e.target.value}))} className="input-premium" style={{ width:'100%',boxSizing:'border-box' }}>
              <option value="">— Choisir une formation —</option>
              {continuousTrainings.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ borderTop:'1px solid var(--border-light)',paddingTop:'16px' }}>
          <p style={{ fontSize:'12px',fontWeight:'800',color:'var(--text-primary)',marginBottom:'12px' }}>Paiements</p>
          {(sForm.payments||[]).length>0&&(
            <div style={{ display:'flex',flexDirection:'column',gap:'6px',marginBottom:'12px' }}>
              {(sForm.payments||[]).map((p,i)=>(
                <div key={i} style={{ display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',background:'var(--bg-subtle)',borderRadius:'10px' }}>
                  <CheckCircle size={13} style={{ color:'#16a34a',flexShrink:0 }}/>
                  <span style={{ fontSize:'12px',fontWeight:'700',color:'#16a34a',flex:1 }}>{Number(p.amount).toLocaleString()} DH</span>
                  <span style={{ fontSize:'11px',color:'var(--text-muted)' }}>{p.date}</span>
                  <button onClick={()=>removePaymentEntry(i)} style={{ border:'none',background:'none',cursor:'pointer',color:'#ef4444',padding:'0 2px' }}><X size={13}/></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:'8px',alignItems:'end' }}>
            <Field label="Montant (DH)"><Inp type="number" value={newPayment.amount} onChange={e=>setNewPayment(p=>({...p,amount:e.target.value}))} placeholder="0"/></Field>
            <Field label="Date"><Inp type="date" value={newPayment.date} onChange={e=>setNewPayment(p=>({...p,date:e.target.value}))}/></Field>
            <button onClick={addPaymentEntry} style={{ height:'40px',marginBottom:'16px',padding:'0 12px',background:'var(--primary)',color:'white',border:'none',borderRadius:'10px',cursor:'pointer',fontWeight:'700',fontSize:'12px',whiteSpace:'nowrap' }}>+ Paiement</button>
          </div>
        </div>
        <div style={{ display:'flex',justifyContent:'flex-end',gap:'10px',marginTop:'4px' }}>
          <button onClick={()=>setStudentModal(false)} className="btn-ghost">Annuler</button>
          <button onClick={saveStudent} className="btn-modern">Enregistrer l'étudiant</button>
        </div>
      </Modal>

      <Modal open={sessionModal} onClose={()=>setSessionModal(false)} title="Ajouter une séance">
        <Field label="Formation">
          <select value={sesForm.trainingId} onChange={e=>setSesForm(p=>({...p,trainingId:e.target.value}))} className="input-premium" style={{ width:'100%',boxSizing:'border-box' }}>
            <option value="">— Choisir —</option>
            {continuousTrainings.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Jour">
          <select value={sesForm.day} onChange={e=>setSesForm(p=>({...p,day:e.target.value}))} className="input-premium" style={{ width:'100%',boxSizing:'border-box' }}>
            {DAYS.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px' }}>
          <Field label="Heure début"><Inp type="time" value={sesForm.startTime} onChange={e=>setSesForm(p=>({...p,startTime:e.target.value}))}/></Field>
          <Field label="Heure fin"><Inp type="time" value={sesForm.endTime} onChange={e=>setSesForm(p=>({...p,endTime:e.target.value}))}/></Field>
        </div>
        <Field label="Salle (optionnel)"><Inp value={sesForm.room} onChange={e=>setSesForm(p=>({...p,room:e.target.value}))} placeholder="Ex: Salle A1"/></Field>
        <div style={{ display:'flex',justifyContent:'flex-end',gap:'10px',marginTop:'4px' }}>
          <button onClick={()=>setSessionModal(false)} className="btn-ghost">Annuler</button>
          <button onClick={saveSession} className="btn-modern">Ajouter</button>
        </div>
      </Modal>
    </div>
  );
}
