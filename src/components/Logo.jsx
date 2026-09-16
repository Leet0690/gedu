import React from 'react';

const Logo = ({ size = 40, showText = true, color = '#70528f' }) => {
  return (
    <div className="ipfp-brand" style={{ display: 'inline-flex', alignItems: 'center', gap: '11px' }}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 48 48"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="IPFP — apprendre et grandir"
        style={{ flexShrink: 0 }}
      >
        <rect x="1" y="1" width="46" height="46" rx="15" fill={color} />
        <rect x="3" y="3" width="42" height="42" rx="13" stroke="white" strokeOpacity="0.12" />
        <path d="M10 22C15 21 19 23 24 27V38C19 34 15 32 10 33V22Z" fill="#f7e6d4" />
        <path d="M38 22C33 21 29 23 24 27V38C29 34 33 32 38 33V22Z" fill="#fffdf8" />
        <path d="M17 19L24 25L31 19" stroke="#f3cc8c" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="13" r="4" fill="#f3cc8c" />
      </svg>
      
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ 
            fontSize: size * 0.45, 
            fontWeight: '900', 
            letterSpacing: '-0.02em',
            color: '#443253',
            textTransform: 'uppercase'
          }}>
            IPFP
          </span>
          <span style={{ 
            fontSize: size * 0.22, 
            fontWeight: '700', 
            color: '#817286',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginTop: '2px'
          }}>
            Manager
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
