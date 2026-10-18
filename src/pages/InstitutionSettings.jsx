import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Check,
  Globe2,
  Image as ImageIcon,
  Mail,
  Palette,
  Save,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react';
import { getInstitutionPalette, INSTITUTION_PALETTES } from '../config/institution';
import { useApp } from '../context/AppContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useToast } from '../context/ToastContext';

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '7px' };
const labelStyle = {
  fontSize: '10px',
  fontWeight: '800',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const emptyForm = {
  name: '', shortName: '', appName: '', typeLabel: '', city: '', country: '',
  logoUrl: '', portalUrl: '', portalHostname: '', authEmailDomain: '', studentIdPrefix: '',
  paletteKey: 'campus', primaryColor: '', accentColor: '',
};

const readLogoFile = file => new Promise((resolve, reject) => {
  if (!file || !file.type.startsWith('image/')) {
    reject(new Error('Sélectionnez une image PNG, JPG, WEBP ou SVG.'));
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    reject(new Error('Le logo ne doit pas dépasser 8 Mo.'));
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Impossible de lire ce fichier.'));
  reader.onload = () => {
    const source = String(reader.result || '');
    if (file.type === 'image/svg+xml') {
      if (source.length > 900000) reject(new Error('Le fichier SVG est trop volumineux.'));
      else resolve(source);
      return;
    }

    const image = new window.Image();
    image.onload = () => {
      const maxSize = 720;
      const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Votre navigateur ne peut pas préparer ce logo.'));
        return;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const optimized = canvas.toDataURL('image/webp', 0.86);
      if (optimized.length > 900000) reject(new Error('Le logo optimisé est encore trop volumineux.'));
      else resolve(optimized);
    };
    image.onerror = () => reject(new Error('Ce fichier image est invalide.'));
    image.src = source;
  };
  reader.readAsDataURL(file);
});

export default function InstitutionSettings() {
  const { institution, updateInstitution } = useApp();
  const { isAdmin } = useAdminAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);

  useEffect(() => {
    if (institution) setFormData({ ...emptyForm, ...institution });
  }, [institution]);

  const activePalette = useMemo(() => getInstitutionPalette(formData), [formData]);
  const paletteOptions = Object.entries(INSTITUTION_PALETTES);

  const handleChange = event => {
    const { name, value } = event.target;
    setFormData(previous => ({ ...previous, [name]: value }));
  };

  const handlePaletteChange = key => {
    setFormData(previous => {
      const next = { ...previous, paletteKey: key };
      if (key === 'custom') {
        const current = getInstitutionPalette(previous);
        next.primaryColor = previous.primaryColor || current.primary;
        next.accentColor = previous.accentColor || current.accent;
      } else {
        next.primaryColor = '';
        next.accentColor = '';
      }
      return next;
    });
  };

  const handleCustomColorChange = (name, value) => {
    setFormData(previous => ({ ...previous, paletteKey: 'custom', [name]: value }));
  };

  const handleLogoFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLogoLoading(true);
    try {
      const logoUrl = await readLogoFile(file);
      setFormData(previous => ({ ...previous, logoUrl }));
      showToast('Logo chargé. Enregistrez le profil pour le publier.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLogoLoading(false);
    }
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
    <div className="section-padding institution-settings-page" style={{ maxWidth: '1180px', margin: '0 auto' }}>
      <header className="home-dashboard-heading" style={{ marginBottom: '24px' }}>
        <div>
          <span className="gedu-settings-eyebrow"><Palette size={13} /> Personnalisation</span>
          <h1>Identité de l’établissement</h1>
          <p>Choisissez le nom, le logo et les couleurs de votre école ou institut.</p>
        </div>
        <div className="dashboard-stat-icon" aria-hidden="true"><Building2 size={22} /></div>
      </header>

      <div className="institution-settings-layout">
        <form onSubmit={handleSubmit} className="glass-card institution-settings-form">
          <div className="institution-settings-section-heading">
            <span className="dashboard-stat-icon"><Building2 size={18} /></span>
            <div><h2>Nom et identité</h2><p>Ces informations apparaissent dans l’interface et les documents.</p></div>
          </div>

          <div className="form-grid">
            <div style={fieldStyle}><label style={labelStyle} htmlFor="institution-name">Nom complet</label><input id="institution-name" name="name" className="input-premium" value={formData.name} onChange={handleChange} placeholder="Ex. Institut de Formation aux Métiers" required /></div>
            <div style={fieldStyle}><label style={labelStyle} htmlFor="institution-short-name">Sigle</label><input id="institution-short-name" name="shortName" className="input-premium" value={formData.shortName} onChange={handleChange} placeholder="Ex. IFM" required /></div>
            <div style={fieldStyle}><label style={labelStyle} htmlFor="institution-app-name">Nom de l’application</label><input id="institution-app-name" name="appName" className="input-premium" value={formData.appName} onChange={handleChange} placeholder="Ex. Gestion IFM" /></div>
            <div style={fieldStyle}><label style={labelStyle} htmlFor="institution-type">Type d’établissement</label><input id="institution-type" name="typeLabel" className="input-premium" value={formData.typeLabel} onChange={handleChange} placeholder="École / institut de formation professionnelle" /></div>
            <div style={fieldStyle}><label style={labelStyle} htmlFor="institution-city">Ville</label><input id="institution-city" name="city" className="input-premium" value={formData.city} onChange={handleChange} placeholder="Ex. Casablanca" /></div>
            <div style={fieldStyle}><label style={labelStyle} htmlFor="institution-country">Pays</label><input id="institution-country" name="country" className="input-premium" value={formData.country} onChange={handleChange} placeholder="Ex. Maroc" /></div>
          </div>

          <div className="institution-settings-section-heading institution-settings-section-heading-spaced">
            <span className="dashboard-stat-icon"><ImageIcon size={18} /></span>
            <div><h2>Logo de l’établissement</h2><p>Importez une image ou utilisez une URL HTTPS.</p></div>
          </div>

          <div className="institution-logo-editor">
            <div className="institution-logo-dropzone" onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click(); }}>
              {formData.logoUrl ? <img src={formData.logoUrl} alt="Aperçu du logo" /> : <UploadCloud size={26} />}
              <strong>{logoLoading ? 'Préparation du logo…' : 'Importer un logo'}</strong>
              <small>PNG, JPG, WEBP ou SVG · 8 Mo maximum</small>
            </div>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoFile} hidden />
            <div style={{ ...fieldStyle, flex: 1 }}>
              <label style={labelStyle} htmlFor="institution-logo-url">URL du logo</label>
              <input id="institution-logo-url" name="logoUrl" type="url" className="input-premium" value={formData.logoUrl.startsWith('data:') ? '' : formData.logoUrl} onChange={handleChange} placeholder="https://.../logo.png" />
              {formData.logoUrl && <button type="button" className="institution-logo-remove" onClick={() => setFormData(previous => ({ ...previous, logoUrl: '' }))}><X size={13} /> Retirer le logo</button>}
            </div>
          </div>

          <div className="institution-settings-section-heading institution-settings-section-heading-spaced">
            <span className="dashboard-stat-icon"><Palette size={18} /></span>
            <div><h2>Palette de couleurs</h2><p>La palette est appliquée aux menus, boutons, cartes et tableaux de bord.</p></div>
          </div>

          <div className="institution-palette-grid">
            {paletteOptions.map(([key, palette]) => {
              const selected = formData.paletteKey === key;
              const preview = key === 'custom' ? activePalette : palette;
              return <button key={key} type="button" className={`institution-palette-option${selected ? ' is-selected' : ''}`} onClick={() => handlePaletteChange(key)} aria-pressed={selected}>
                <span className="institution-palette-swatches"><i style={{ background: preview.primary }} /><i style={{ background: preview.accent }} /></span>
                <span>{palette.label}</span>{selected && <Check size={15} />}
              </button>;
            })}
          </div>

          {formData.paletteKey === 'custom' && <div className="institution-custom-colors">
            <div style={fieldStyle}><label style={labelStyle} htmlFor="institution-primary-color">Couleur principale</label><div className="institution-color-input"><input id="institution-primary-color" type="color" value={activePalette.primary} onChange={event => handleCustomColorChange('primaryColor', event.target.value)} /><code>{activePalette.primary}</code></div></div>
            <div style={fieldStyle}><label style={labelStyle} htmlFor="institution-accent-color">Couleur accent</label><div className="institution-color-input"><input id="institution-accent-color" type="color" value={activePalette.accent} onChange={event => handleCustomColorChange('accentColor', event.target.value)} /><code>{activePalette.accent}</code></div></div>
          </div>}

          <div className="institution-settings-section-heading institution-settings-section-heading-spaced">
            <span className="dashboard-stat-icon"><Globe2 size={18} /></span>
            <div><h2>Portails et identifiants</h2><p>Paramètres techniques utilisés par les portails publics et les matricules.</p></div>
          </div>

          <div className="form-grid">
            <div style={fieldStyle}><label style={labelStyle} htmlFor="institution-portal-url">URL du portail public</label><input id="institution-portal-url" name="portalUrl" type="url" className="input-premium" value={formData.portalUrl} onChange={handleChange} placeholder="https://portail.exemple.ma" /></div>
            <div style={fieldStyle}><label style={labelStyle} htmlFor="institution-portal-hostname">Domaine réservé au portail</label><input id="institution-portal-hostname" name="portalHostname" className="input-premium" value={formData.portalHostname} onChange={handleChange} placeholder="portail.exemple.ma" /></div>
            <div style={fieldStyle}><label style={labelStyle} htmlFor="institution-auth-domain"><Mail size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Domaine email technique</label><input id="institution-auth-domain" name="authEmailDomain" className="input-premium" value={formData.authEmailDomain} onChange={handleChange} placeholder="ecole.example" /></div>
            <div style={fieldStyle}><label style={labelStyle} htmlFor="institution-student-prefix">Préfixe des matricules</label><input id="institution-student-prefix" name="studentIdPrefix" className="input-premium" value={formData.studentIdPrefix} onChange={handleChange} placeholder="EFP" maxLength={12} /></div>
          </div>

          <div className="institution-settings-notice"><ShieldCheck size={16} /><span>Seuls les administrateurs peuvent enregistrer ces paramètres. Le logo importé est optimisé avant d’être enregistré dans le profil de l’établissement.</span></div>
          <div className="institution-settings-actions"><button type="submit" className="btn-modern primary" disabled={!isAdmin || saving || logoLoading}><Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer le profil'}</button></div>
        </form>

        <aside className="institution-brand-preview" style={{ '--preview-primary': activePalette.primary, '--preview-accent': activePalette.accent, '--preview-primary-dark': activePalette.primaryDark }}>
          <span className="gedu-settings-eyebrow"><Palette size={13} /> Aperçu en direct</span>
          <div className="institution-brand-preview-card">
            <div className="institution-brand-preview-topbar" />
            <div className="institution-brand-preview-content">
              <div className="institution-brand-preview-logo">{formData.logoUrl ? <img src={formData.logoUrl} alt="Logo de l’établissement" /> : <Building2 size={26} />}</div>
              <span className="institution-brand-preview-short">{formData.shortName || 'SIGLE'}</span>
              <strong>{formData.name || 'Nom de l’établissement'}</strong>
              <small>{formData.typeLabel || 'École / institut de formation professionnelle'}</small>
              <div className="institution-brand-preview-actions"><span /><span /><span /></div>
            </div>
          </div>
          <div className="institution-brand-preview-palette"><span style={{ background: activePalette.primary }} /><span style={{ background: activePalette.accent }} /><div><strong>{INSTITUTION_PALETTES[formData.paletteKey]?.label || 'Palette personnalisée'}</strong><small>Les couleurs sont visibles immédiatement après l’enregistrement.</small></div></div>
        </aside>
      </div>
    </div>
  );
}
