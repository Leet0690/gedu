import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Logo from '../components/Logo';
import { Lock, ArrowRight, CircleAlert, Loader2, Eye, EyeOff, ShieldCheck, Sparkles, GraduationCap } from 'lucide-react';

const Login = () => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useApp();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    const ok = login(password);
    if (ok) {
      navigate('/');
    } else {
      setError('Clé de sécurité non valide');
      setPassword('');
      setLoading(false);
    }
  };

  return (
    <div className="login-premium-page">
      <div className="login-premium-orb login-premium-orb-one" aria-hidden="true" />
      <div className="login-premium-orb login-premium-orb-two" aria-hidden="true" />
      <div className="login-premium-grid" aria-hidden="true" />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="login-premium-shell">

        <section className="login-premium-brand">
          <div className="login-premium-brand-logo">
            <Logo size={58} showText={false} />
          </div>
          <div className="login-premium-brand-copy">
            <span className="login-premium-eyebrow"><Sparkles size={12} /> Plateforme de gestion</span>
            <h1>IPFP<br />Manager</h1>
            <p>Un espace unifié pour piloter les formations, les présences et les résultats académiques.</p>
          </div>
          <div className="login-premium-feature-list">
            <span><ShieldCheck size={15} /> Accès Direction sécurisé</span>
            <span><GraduationCap size={15} /> Pilotage académique centralisé</span>
          </div>
          <div className="login-premium-brand-orb" aria-hidden="true"><GraduationCap size={180} /></div>
        </section>

        <section className="glass-premium login-premium-card">
          <div className="login-premium-card-heading">
            <span className="login-premium-card-icon"><Lock size={18} /></span>
            <div>
              <span className="login-premium-card-eyebrow">Espace Direction</span>
              <h2>Bienvenue</h2>
              <p>Connectez-vous pour accéder au tableau de bord.</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="login-premium-label">
                Mot de passe
              </label>
              <div className="login-premium-input-wrap">
                <Lock size={16} className="login-premium-input-icon" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input-premium login-premium-input" style={{ opacity: loading ? 0.6 : 1 }}
                  placeholder="••••••••" required autoComplete="current-password" disabled={loading} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="login-premium-visibility" aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                style={{ background: 'var(--danger-bg)', color: 'var(--danger)', fontWeight: '600', padding: '10px 14px', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-xs)', textAlign: 'center', border: '1px solid var(--danger-bg)' }}>
                <CircleAlert size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> {error}
              </motion.div>
            )}

            <button type="submit" className="btn-modern primary" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', fontWeight: '700', letterSpacing: '0.02em' }}>
              {loading ? <><Loader2 size={16} className="spinner" style={{ marginRight: '8px' }} />Connexion...</> : <>Se connecter <ArrowRight size={16} style={{ marginLeft: '6px' }} /></>}
            </button>
          </form>
          <p className="login-premium-security"><ShieldCheck size={12} /> Connexion sécurisée et accès restreint</p>
        </section>

        <p className="login-premium-footer">
          Institut Polytechnique de la Formation Professionnelle
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
