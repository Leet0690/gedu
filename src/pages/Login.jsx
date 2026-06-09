import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Logo from '../components/Logo';
import { Lock, ArrowRight, CircleAlert, Loader2, Eye, EyeOff } from 'lucide-react';

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
    <div className="finance-admin-page" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', overflow: 'hidden', borderRadius: '0px', width: '100%'
    }}>
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: 'rgba(176, 104, 185, 0.08)', filter: 'blur(100px)', borderRadius: '50%' }}></div>
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: 'rgba(254, 205, 8, 0.06)', filter: 'blur(100px)', borderRadius: '50%' }}></div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: '100%', maxWidth: '380px', position: 'relative', zIndex: 10 }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            <Logo size={56} showText={false} />
          </div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '4px' }}>
            IPFP MANAGER
          </h1>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: '400' }}>
            Connectez-vous à votre Espace Direction
          </p>
        </div>

        {/* Card */}
        <div className="glass-premium" style={{ padding: '28px', borderRadius: '24px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '2px' }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input-premium" style={{ width: '100%', paddingLeft: '42px', paddingRight: '44px', paddingTop: '12px', paddingBottom: '12px', opacity: loading ? 0.6 : 1 }}
                  placeholder="••••••••" required autoComplete="current-password" disabled={loading} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex' }}>
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
        </div>

        <p style={{ textAlign: 'center', fontSize: '10px', fontWeight: '600', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '28px', lineHeight: '1.6' }}>
          Institut Polytechnique de la Formation Professionnelle
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
