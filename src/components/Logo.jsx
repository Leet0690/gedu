import { GraduationCap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { institutionConfig } from '../config/institution';

const Logo = ({ size = 40, showText = true, onDark = false }) => {
  const { institution = institutionConfig } = useApp() || {};
  const logoUrl = institution.logoUrl || institutionConfig.logoUrl;
  const label = `${institution.shortName} — ${institution.name}`;
  const placeholder = (
    <span className={`ipfp-logo-placeholder${onDark ? ' is-on-dark' : ''}`} role="img" aria-label={label}>
      <span className="ipfp-logo-placeholder-mark"><GraduationCap size={Math.max(20, size * 0.58)} strokeWidth={1.8} /></span>
      {showText && (
        <span className="ipfp-logo-placeholder-copy">
          <strong>{institution.shortName}</strong>
          <small>{institution.name}</small>
        </span>
      )}
    </span>
  );

  return (
    <div className={`ipfp-brand${showText ? '' : ' is-compact'}`} style={{ '--logo-size': `${size}px` }}>
      {!logoUrl ? placeholder : onDark ? (
        <svg className="ipfpp-logo ipfpp-logo-transparent"
          viewBox={showText ? '95 205 1740 625' : '95 205 560 580'}
          role="img" aria-label={label}>
          <image href={logoUrl} width="1920" height="1080" />
        </svg>
      ) : (
        <img className="ipfpp-logo" src={logoUrl}
          alt={label}
          width="1920" height="1080" />
      )}
    </div>
  );
};

export default Logo;
