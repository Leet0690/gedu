import React, { useEffect, useState } from 'react';
import { Building2, Globe2, Image, Mail, Save, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useToast } from '../context/ToastContext';

const fieldStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '7px',
};

const labelStyle = {
  fontSize: '10px',
  fontWeight: '800',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const emptyForm = {
  name: '',
  shortName: '',
  appName: '',
  typeLabel: '',
  city: '',
  country: '',
  logoUrl: '',
  portalUrl: '',
  portalHostname: '',
  authEmailDomain: '',
  studentIdPrefix: '',
};

export default function InstitutionSettings() {
  const { institution, updateInstitution } = useApp();
  const { isAdmin } = useAdminAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!institution) return;
    setFormData({ ...emptyForm, ...institution });
  }, [institution]);

  const handleChange = event => {
    const { name, value } = event.target;
    setFormData(previous => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (!isAdmin || saving) return;
    if (!formData.name.trim() || !formData.shortName.trim()) {
      showToast('Le nom et le sigle de l’établissement sont obligatoires.', 'error');
      return;
    }
    setSaving(true);
    await updateInstitution(formData);
    setSaving(false);
  };

  return (
    <div className="section-padding" style={{ maxWidth: '980px', margin: '0 auto' }}>
      <header className="home-dashboard-heading" style={{ marginBottom: '24px' }}>
        <div>
          <h1>Profil de l’établissement</h1>
          <p>Adaptez la plateforme à votre école ou institut de formation professionnelle.</p>
        </div>
        <div className="dashboard-stat-icon" aria-hidden="true"><Building2 size={22} /></div>
      </header>

      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
          <span className="dashboard-stat-icon" style={{ width: '40px', height: '40px' }}><Building2 size={18} /></span>
          <div>
            <h2 style={{ color: 'var(--primary)', fontSize: '18px', fontWeight: '800' }}>Identité et affichage</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '3px' }}>Ces informations sont utilisées dans l’interface et les documents exportés.</p>
          </div>
        </div>

        <div className="form-grid">
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="institution-name">Nom complet</label>
            <input id="institution-name" name="name" className="input-premium" value={formData.name} onChange={handleChange} placeholder="Ex. Institut de Formation aux Métiers" required />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="institution-short-name">Sigle</label>
            <input id="institution-short-name" name="shortName" className="input-premium" value={formData.shortName} onChange={handleChange} placeholder="Ex. IFM" required />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="institution-app-name">Nom de l’application</label>
            <input id="institution-app-name" name="appName" className="input-premium" value={formData.appName} onChange={handleChange} placeholder="Ex. Gestion IFM" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="institution-type">Type d’établissement</label>
            <input id="institution-type" name="typeLabel" className="input-premium" value={formData.typeLabel} onChange={handleChange} placeholder="École / institut de formation professionnelle" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="institution-city">Ville</label>
            <input id="institution-city" name="city" className="input-premium" value={formData.city} onChange={handleChange} placeholder="Ex. Casablanca" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="institution-country">Pays</label>
            <input id="institution-country" name="country" className="input-premium" value={formData.country} onChange={handleChange} placeholder="Ex. Maroc" />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '30px 0 22px' }}>
          <span className="dashboard-stat-icon" style={{ width: '40px', height: '40px' }}><Globe2 size={18} /></span>
          <div>
            <h2 style={{ color: 'var(--primary)', fontSize: '18px', fontWeight: '800' }}>Portails et identifiants</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '3px' }}>Les liens publics et les nouveaux comptes utiliseront ces paramètres.</p>
          </div>
        </div>

        <div className="form-grid">
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="institution-portal-url">URL du portail public</label>
            <input id="institution-portal-url" name="portalUrl" type="url" className="input-premium" value={formData.portalUrl} onChange={handleChange} placeholder="https://portail.exemple.ma" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="institution-portal-hostname">Domaine réservé au portail</label>
            <input id="institution-portal-hostname" name="portalHostname" className="input-premium" value={formData.portalHostname} onChange={handleChange} placeholder="portail.exemple.ma" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="institution-auth-domain"><Mail size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Domaine email technique</label>
            <input id="institution-auth-domain" name="authEmailDomain" className="input-premium" value={formData.authEmailDomain} onChange={handleChange} placeholder="ecole.example" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="institution-student-prefix">Préfixe des matricules</label>
            <input id="institution-student-prefix" name="studentIdPrefix" className="input-premium" value={formData.studentIdPrefix} onChange={handleChange} placeholder="EFP" maxLength={12} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '30px 0 22px' }}>
          <span className="dashboard-stat-icon" style={{ width: '40px', height: '40px' }}><Image size={18} /></span>
          <div>
            <h2 style={{ color: 'var(--primary)', fontSize: '18px', fontWeight: '800' }}>Logo</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '3px' }}>Utilisez une URL HTTPS accessible depuis les navigateurs des utilisateurs.</p>
          </div>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="institution-logo-url">URL du logo</label>
          <input id="institution-logo-url" name="logoUrl" type="url" className="input-premium" value={formData.logoUrl} onChange={handleChange} placeholder="https://.../logo.png" />
        </div>

        <div style={{ marginTop: '26px', padding: '13px 15px', borderRadius: 'var(--radius-lg)', background: 'var(--primary-ultra-light)', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.6, display: 'flex', gap: '9px' }}>
          <ShieldCheck size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
          <span>Seuls les administrateurs peuvent enregistrer ces paramètres. Les paramètres par défaut peuvent aussi être fournis par les variables <code>VITE_INSTITUTION_*</code> lors du déploiement.</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button type="submit" className="btn-modern primary" disabled={!isAdmin || saving}>
            <Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer le profil'}
          </button>
        </div>
      </form>
    </div>
  );
}
