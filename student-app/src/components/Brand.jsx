import React, { useState } from 'react';
import '../styles/Brand.css';

/**
 * Reusable school brand mark: crest image (when available) with a styled
 * monogram fallback, plus the school name and portal label.
 */
function Brand({ size = 'md', subtitle = 'Student Portal' }) {
  const publicUrl = process.env.PUBLIC_URL || '';
  const [logoSrc, setLogoSrc] = useState(`${publicUrl}/logo.jpg`);
  const [hasError, setHasError] = useState(false);

  const handleImageError = () => {
    if (logoSrc !== `${publicUrl}/school-logo.jpg`) {
      setLogoSrc(`${publicUrl}/school-logo.jpg`);
    } else {
      setHasError(true);
    }
  };

  return (
    <div className={`brand ${size === 'lg' ? 'brand-lg' : ''}`}>
      <div className="brand-logo" aria-hidden="true">
        {!hasError ? (
          <img
            src={logoSrc}
            alt="Academia De San Jose"
            onError={handleImageError}
          />
        ) : (
          <span className="brand-logo-fallback">ASJ</span>
        )}
      </div>
      <div className="brand-text">
        <span className="brand-name">Academia De San Jose</span>
        {subtitle && <span className="brand-subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}

export default Brand;
