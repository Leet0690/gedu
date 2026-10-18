import { useId } from 'react';
import { useApp } from '../context/AppContext';
import { institutionConfig } from '../config/institution';

const Logo = ({ size = 40, showText = true, onDark = false }) => {
  const { institution = institutionConfig } = useApp() || {};
  const filterId = `institution-logo-${useId().replaceAll(':', '')}`;
  const logoUrl = institution.logoUrl || institutionConfig.logoUrl;
  const label = `${institution.shortName} — ${institution.name}`;

  return (
    <div className={`ipfp-brand${showText ? '' : ' is-compact'}`} style={{ '--logo-size': `${size}px` }}>
      {onDark ? (
        <svg className="ipfpp-logo ipfpp-logo-transparent"
          viewBox={showText ? '95 205 1740 625' : '95 205 560 580'}
          role="img" aria-label={label}>
          <defs>
            <filter id={filterId} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
              <feColorMatrix type="matrix" values="0 0 0 0 1  -0.25 0 0 0 1  -1 0 0 0 1  -1 -1 -1 0 3" />
            </filter>
          </defs>
          <image href={logoUrl} width="1920" height="1080" filter={`url(#${filterId})`} />
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
