import '../styles/Brand.css';

/**
 * Reusable school brand mark: crest image (when available) with a styled
 * monogram fallback, plus the school name and portal label.
 */
function Brand({ size = 'md', subtitle = 'Student Portal' }) {
  return (
    <div className={`brand ${size === 'lg' ? 'brand-lg' : ''}`}>
      <div className="brand-logo" aria-hidden="true">
        <img
          src="/logo.jpg"
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <span className="brand-logo-fallback">ASJ</span>
      </div>
      <div className="brand-text">
        <span className="brand-name">Academia De San Jose</span>
        {subtitle && <span className="brand-subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}

export default Brand;
