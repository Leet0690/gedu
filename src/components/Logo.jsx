import { useId } from 'react';

const Logo = ({ size = 40, showText = true, onDark = false }) => {
  const filterId = `ipfpp-logo-${useId().replaceAll(':', '')}`;
  return (
    <div className={`ipfp-brand${showText ? '' : ' is-compact'}`} style={{ '--logo-size': `${size}px` }}>
      {onDark ? (
        <svg className="ipfpp-logo ipfpp-logo-transparent"
          viewBox={showText ? '95 205 1740 625' : '95 205 560 580'}
          role="img" aria-label="IPFPP — Institut Polytechnique de la Formation Professionnelle Privée, Tanger">
          <defs>
            {/* Preserve the supplied artwork; remove white and lighten navy only
                when displaying it over the dark navigation background. */}
            <filter id={filterId} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
              <feColorMatrix type="matrix" values="0 0 0 0 1  -0.25 0 0 0 1  -1 0 0 0 1  -1 -1 -1 0 3" />
            </filter>
          </defs>
          <image href="/logo-ipfpp.png" width="1920" height="1080" filter={`url(#${filterId})`} />
        </svg>
      ) : (
        <img className="ipfpp-logo" src="/logo-ipfpp.png"
          alt="IPFPP — Institut Polytechnique de la Formation Professionnelle Privée, Tanger"
          width="1920" height="1080" />
      )}
    </div>
  );
};
export default Logo;
