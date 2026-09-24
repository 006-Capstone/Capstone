import React from 'react';
import '../../styles/Skeleton.css';

/**
 * Base Skeleton Primitive
 * White-themed shimmer effect matching container background with smooth gradient wave animation
 */
export const Skeleton = ({
  variant = 'text',
  width,
  height,
  borderRadius,
  className = '',
  style = {},
  ...props
}) => {
  const variantClass = `skeleton-${variant}`;
  const customStyle = {
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(borderRadius !== undefined ? { borderRadius } : {}),
    ...style
  };

  return (
    <span
      className={`skeleton-block ${variantClass} ${className}`}
      style={customStyle}
      aria-hidden="true"
      {...props}
    />
  );
};

/**
 * 1. Request and Ticket Feeds Skeleton
 * Circular avatar placeholders, wide header bar for request IDs and titles,
 * multi-line bars for message excerpts, and metadata tag chips.
 */
export const RequestFeedSkeleton = ({ count = 3, className = '' }) => {
  return (
    <div className={`skeleton-feed-container ${className}`} aria-label="Loading feed..." role="status">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-feed-card">
          <div className="skeleton-feed-header">
            <Skeleton variant="circular" width={40} height={40} className="skeleton-feed-avatar" />
            <div className="skeleton-feed-title-col">
              <div className="skeleton-feed-id-row">
                <Skeleton variant="text" width="65px" height="15px" />
                <Skeleton variant="pill" width="80px" height="22px" />
                <Skeleton variant="text" width="90px" height="13px" style={{ marginLeft: 'auto' }} />
              </div>
              <Skeleton variant="text" width={index % 2 === 0 ? '75%' : '60%'} height="20px" />
            </div>
          </div>
          <div className="skeleton-feed-body">
            <Skeleton variant="text" width="96%" height="13px" />
            <Skeleton variant="text" width={index % 2 === 0 ? '82%' : '88%'} height="13px" />
            <Skeleton variant="text" width="55%" height="13px" />
          </div>
          <div className="skeleton-feed-footer">
            <Skeleton variant="pill" width="85px" height="22px" />
            <Skeleton variant="pill" width="110px" height="22px" />
            <Skeleton variant="pill" width="95px" height="22px" />
            <Skeleton variant="rounded" width="30px" height="30px" style={{ marginLeft: 'auto' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const TicketFeedSkeleton = RequestFeedSkeleton;

/**
 * 2. Chat and Conversation Panels Skeleton
 * Top header toolbar, left-aligned message bubbles with circular avatar skeletons,
 * right-aligned user reply bubbles, and bottom chat input bar.
 */
export const ChatPanelSkeleton = ({
  includeSidebar = false,
  compact = false,
  className = ''
}) => {
  const chatCard = (
    <div className={`skeleton-chat-wrapper ${className}`} aria-label="Loading conversation..." role="status">
      {/* Top Header Toolbar */}
      <div className="skeleton-chat-toolbar">
        <div className="skeleton-chat-toolbar-left">
          <Skeleton variant="rounded" width={32} height={32} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Skeleton variant="text" width="180px" height="18px" />
            <Skeleton variant="text" width="90px" height="12px" />
          </div>
        </div>
        <div className="skeleton-chat-toolbar-right">
          <Skeleton variant="pill" width="90px" height="28px" />
          <Skeleton variant="rounded" width="34px" height="34px" />
        </div>
      </div>

      {/* Conversation Messages */}
      <div className="skeleton-chat-messages">
        {/* Highlighted original inquiry */}
        <div className="skeleton-bubble-left" style={{ maxWidth: '90%' }}>
          <Skeleton variant="circular" width={36} height={36} />
          <div className="skeleton-bubble-left-content" style={{ width: '100%', borderColor: 'var(--sage-200, #dce9da)', background: '#ffffff' }}>
            <div className="skeleton-bubble-header">
              <Skeleton variant="text" width="130px" height="15px" />
              <Skeleton variant="pill" width="90px" height="20px" />
            </div>
            <Skeleton variant="text" width="98%" height="13px" />
            <Skeleton variant="text" width="92%" height="13px" />
            <Skeleton variant="text" width="65%" height="13px" />
          </div>
        </div>

        {/* Left-aligned response bubble */}
        <div className="skeleton-bubble-left">
          <Skeleton variant="circular" width={32} height={32} />
          <div className="skeleton-bubble-left-content">
            <div className="skeleton-bubble-header">
              <Skeleton variant="text" width="110px" height="14px" />
              <Skeleton variant="text" width="60px" height="12px" />
            </div>
            <Skeleton variant="text" width="95%" height="13px" />
            <Skeleton variant="text" width="80%" height="13px" />
          </div>
        </div>

        {/* Right-aligned user reply bubble */}
        <div className="skeleton-bubble-right">
          <div className="skeleton-bubble-right-content">
            <div className="skeleton-bubble-header">
              <Skeleton variant="text" width="90px" height="14px" />
              <Skeleton variant="text" width="55px" height="12px" />
            </div>
            <Skeleton variant="text" width="92%" height="13px" />
            <Skeleton variant="text" width="70%" height="13px" />
          </div>
        </div>

        {/* Left-aligned response bubble 2 */}
        <div className="skeleton-bubble-left">
          <Skeleton variant="circular" width={32} height={32} />
          <div className="skeleton-bubble-left-content">
            <div className="skeleton-bubble-header">
              <Skeleton variant="text" width="125px" height="14px" />
              <Skeleton variant="text" width="65px" height="12px" />
            </div>
            <Skeleton variant="text" width="88%" height="13px" />
          </div>
        </div>
      </div>

      {/* Bottom Chat Input Bar */}
      <div className="skeleton-chat-input-bar">
        <Skeleton variant="rounded" width="100%" height={compact ? 44 : 54} />
        <div className="skeleton-chat-input-row">
          <Skeleton variant="rounded" width={36} height={36} />
          <Skeleton variant="rounded" width={110} height={38} />
        </div>
      </div>
    </div>
  );

  if (!includeSidebar) {
    return chatCard;
  }

  return (
    <div className="skeleton-details-layout">
      <div className="skeleton-details-main">
        {chatCard}
      </div>
      <div className="skeleton-details-sidebar">
        <div className="skeleton-sidebar-card">
          <Skeleton variant="text" width="130px" height="16px" />
          <Skeleton variant="pill" width="100px" height="28px" />
          <Skeleton variant="text" width="90%" height="14px" />
          <Skeleton variant="text" width="75%" height="14px" />
        </div>
        <div className="skeleton-sidebar-card">
          <Skeleton variant="text" width="110px" height="16px" />
          <Skeleton variant="text" width="85%" height="13px" />
          <Skeleton variant="text" width="90%" height="13px" />
          <Skeleton variant="text" width="70%" height="13px" />
        </div>
      </div>
    </div>
  );
};

export const ConversationSkeleton = ChatPanelSkeleton;

/**
 * 3. Analytics and Overview Cards Skeleton
 * Rectangles matching exact height of statistic widgets, small label placeholders,
 * and larger metric blocks.
 */
export const OverviewCardsSkeleton = ({
  count = 4,
  layout = 'grid',
  className = ''
}) => {
  if (layout === 'admin') {
    return (
      <div className={`skeleton-admin-stats-row ${className}`} aria-label="Loading statistics..." role="status">
        <div className="skeleton-admin-stats-right">
          {/* Rectangular Pending card */}
          <div className="skeleton-overview-card" style={{ minHeight: '82px' }}>
            <div className="skeleton-overview-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Skeleton variant="rounded" width={34} height={34} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <Skeleton variant="text" width="75px" height="14px" />
                  <Skeleton variant="text" width="110px" height="12px" />
                </div>
              </div>
              <Skeleton variant="text" width="38px" height="28px" />
            </div>
          </div>

          {/* 2x2 square cards grid */}
          <div className="skeleton-admin-squares-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-admin-square-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Skeleton variant="text" width="70px" height="13px" />
                  <Skeleton variant="pill" width="45px" height="18px" />
                </div>
                <Skeleton variant="text" width="42px" height="30px" style={{ margin: '8px 0' }} />
                <Skeleton variant="text" width="85px" height="12px" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`skeleton-overview-grid ${className}`} aria-label="Loading statistics..." role="status">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-overview-card">
          <div className="skeleton-overview-top">
            <Skeleton variant="text" width="38%" height="11px" />
            <Skeleton variant="rounded" width={18} height={18} />
          </div>
          <div className="skeleton-overview-body">
            <Skeleton variant="rounded" width={38} height={38} />
            <div className="skeleton-overview-texts">
              <Skeleton variant="text" width="48%" height="28px" />
              <Skeleton variant="text" width="68%" height="13px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Analytics Chart Skeleton
 * For volume trend & performance visualization widgets
 */
export const AnalyticsChartSkeleton = ({ height = 360, className = '' }) => {
  const barHeights = [45, 65, 30, 85, 50, 95, 70, 40, 75, 60, 80, 55];

  return (
    <div className={`skeleton-chart-card ${className}`} style={{ minHeight: `${height}px` }} aria-label="Loading chart data..." role="status">
      <div className="skeleton-chart-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Skeleton variant="text" width="220px" height="20px" />
          <Skeleton variant="text" width="320px" height="13px" />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Skeleton variant="rounded" width="80px" height="32px" />
          <Skeleton variant="rounded" width="80px" height="32px" />
          <Skeleton variant="rounded" width="80px" height="32px" />
        </div>
      </div>

      <div className="skeleton-chart-bars-wrap">
        {barHeights.map((h, i) => (
          <div key={i} className="skeleton-chart-bar-col">
            <Skeleton variant="rounded" width="70%" height={`${h}%`} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} />
          </div>
        ))}
      </div>

      <div className="skeleton-chart-x-axis">
        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
          <Skeleton key={i} variant="text" width="24px" height="11px" />
        ))}
      </div>
    </div>
  );
};

/**
 * 4. Data Tables and Management Lists Skeleton
 * Header row, multiple placeholder data rows with varying column widths,
 * and bottom pagination skeletons.
 */
export const DataTableSkeleton = ({
  columns = 6,
  rows = 5,
  hasCheckbox = false,
  hasPagination = true,
  className = ''
}) => {
  // Configurable or default column widths
  const columnDefs = Array.isArray(columns)
    ? columns
    : [
        ...(hasCheckbox ? [{ width: '36px', align: 'center', type: 'checkbox' }] : []),
        { width: '12%', type: 'id' },
        { width: '22%', type: 'text' },
        { width: '28%', type: 'text' },
        { width: '16%', type: 'date' },
        { width: '14%', type: 'status' },
        { width: '40px', align: 'right', type: 'action' }
      ].slice(0, typeof columns === 'number' ? columns : 6);

  return (
    <div className={`skeleton-table-card ${className}`} aria-label="Loading data table..." role="status">
      <div className="skeleton-table-container">
        <table className="skeleton-table">
          <thead>
            <tr>
              {columnDefs.map((col, cIdx) => (
                <th key={cIdx} className="skeleton-th" style={{ width: col.width, textAlign: col.align || 'left' }}>
                  {col.type === 'checkbox' ? (
                    <Skeleton variant="rectangular" width={16} height={16} />
                  ) : (
                    <Skeleton variant="text" width={col.type === 'action' ? 0 : '70%'} height="12px" />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rIdx) => (
              <tr key={rIdx} className="skeleton-tr">
                {columnDefs.map((col, cIdx) => {
                  let cellContent;

                  if (col.type === 'checkbox') {
                    cellContent = <Skeleton variant="rectangular" width={16} height={16} />;
                  } else if (col.type === 'id') {
                    cellContent = <Skeleton variant="text" width="55px" height="15px" style={{ fontWeight: 'bold' }} />;
                  } else if (col.type === 'status') {
                    cellContent = <Skeleton variant="pill" width="85px" height="24px" />;
                  } else if (col.type === 'action') {
                    cellContent = <Skeleton variant="rounded" width={30} height={30} />;
                  } else if (col.type === 'date') {
                    cellContent = <Skeleton variant="text" width="90px" height="14px" />;
                  } else {
                    // Regular text with organic alternating widths
                    const textWidths = ['85%', '72%', '90%', '64%', '78%'];
                    const chosenWidth = textWidths[(rIdx + cIdx) % textWidths.length];
                    cellContent = <Skeleton variant="text" width={chosenWidth} height="14px" />;
                  }

                  return (
                    <td key={cIdx} className="skeleton-td" style={{ textAlign: col.align || 'left' }}>
                      {cellContent}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasPagination && (
        <div className="skeleton-pagination">
          <Skeleton variant="text" width="160px" height="14px" />
          <div className="skeleton-pagination-pages">
            <Skeleton variant="rounded" width={32} height={32} />
            <Skeleton variant="rounded" width={32} height={32} />
            <Skeleton variant="rounded" width={32} height={32} />
            <Skeleton variant="rounded" width={32} height={32} />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 5. Submit New Request Page Skeleton
 * Breadcrumb, header, 3 form section cards (office grid, details, uploads), and sidebar guidelines
 */
export const NewRequestSkeleton = () => {
  return (
    <div className="new-request-page" aria-label="Loading request form..." role="status">
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
        <Skeleton variant="text" width="100px" height="16px" />
        <span style={{ color: 'var(--gray-300, #d1d5db)' }}>/</span>
        <Skeleton variant="text" width="90px" height="16px" />
      </div>

      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div className="page-title-group">
          <Skeleton variant="text" width="220px" height="32px" style={{ marginBottom: '6px' }} />
          <Skeleton variant="text" width="380px" height="16px" />
        </div>
      </div>

      <div className="new-request-content">
        <div className="new-request-main">
          <div className="request-form-container">
            {/* Section 1: Office Selection */}
            <div className="form-section-card">
              <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Skeleton variant="circular" width={28} height={28} />
                <Skeleton variant="text" width="240px" height="20px" />
              </div>
              <div className="office-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="office-card" style={{ cursor: 'default' }}>
                    <div className="office-card-header">
                      <Skeleton variant="rounded" width={36} height={36} borderRadius="8px" />
                      <Skeleton variant="circular" width={20} height={20} />
                    </div>
                    <div className="office-info" style={{ marginTop: '12px', width: '100%' }}>
                      <Skeleton variant="text" width="50%" height="18px" style={{ marginBottom: '8px' }} />
                      <Skeleton variant="text" width="92%" height="13px" style={{ marginBottom: '4px' }} />
                      <Skeleton variant="text" width="70%" height="13px" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Request Details */}
            <div className="form-section-card">
              <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Skeleton variant="circular" width={28} height={28} />
                <Skeleton variant="text" width="220px" height="20px" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <Skeleton variant="text" width="80px" height="16px" style={{ marginBottom: '8px' }} />
                  <Skeleton variant="rounded" width="100%" height="44px" borderRadius="8px" />
                </div>
                <div>
                  <Skeleton variant="text" width="160px" height="16px" style={{ marginBottom: '8px' }} />
                  <Skeleton variant="rounded" width="100%" height="120px" borderRadius="8px" />
                </div>
              </div>
            </div>

            {/* Section 3: Supporting Documents */}
            <div className="form-section-card">
              <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Skeleton variant="circular" width={28} height={28} />
                <Skeleton variant="text" width="280px" height="20px" />
              </div>
              <div className="upload-area" style={{ cursor: 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '140px' }}>
                <Skeleton variant="circular" width={48} height={48} style={{ marginBottom: '12px' }} />
                <Skeleton variant="text" width="250px" height="16px" style={{ marginBottom: '8px' }} />
                <Skeleton variant="text" width="340px" height="13px" />
              </div>
            </div>

            {/* Actions Bar */}
            <div className="form-actions-bar" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Skeleton variant="rounded" width="90px" height="42px" borderRadius="8px" />
              <Skeleton variant="rounded" width="150px" height="42px" borderRadius="8px" />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="new-request-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="req-sidebar-card guidelines-card">
            <Skeleton variant="text" width="180px" height="20px" style={{ marginBottom: '16px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <Skeleton variant="circular" width={18} height={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ width: '100%' }}>
                    <Skeleton variant="text" width="90%" height="13px" style={{ marginBottom: '4px' }} />
                    <Skeleton variant="text" width="65%" height="13px" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="req-sidebar-card info-card">
            <Skeleton variant="text" width="140px" height="18px" style={{ marginBottom: '12px' }} />
            <Skeleton variant="text" width="96%" height="13px" style={{ marginBottom: '6px' }} />
            <Skeleton variant="text" width="80%" height="13px" style={{ marginBottom: '16px' }} />
            <Skeleton variant="rounded" width="120px" height="34px" borderRadius="6px" />
          </div>
        </aside>
      </div>
    </div>
  );
};

/**
 * 6. FAQ Page Skeleton
 * Header, accordion question bars with animated shimmer, and sidebar topic navigation
 */
export const FAQSkeleton = ({ className = '' }) => {
  return (
    <div className={`faqs-container ${className}`} aria-label="Loading FAQs..." role="status">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div className="page-title-group">
          <Skeleton variant="text" width="140px" height="32px" style={{ marginBottom: '8px' }} />
          <Skeleton variant="text" width="380px" height="16px" />
        </div>
      </div>

      <div className="faqs-content">
        <div className="faqs-main">
          <div className="faqs-sections">
            {[1, 2, 3].map((sectionIdx) => (
              <div key={sectionIdx} className="faq-section">
                <Skeleton variant="text" width="180px" height="22px" style={{ marginBottom: '16px' }} />
                <div className="faq-section-list">
                  {[1, 2, 3, 4].map((itemIdx) => (
                    <div key={itemIdx} className="faq-item" style={{ padding: '16px 20px', cursor: 'default' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Skeleton variant="text" width={itemIdx % 2 === 0 ? '65%' : '80%'} height="18px" />
                        <Skeleton variant="circular" width={20} height={20} />
                      </div>
                      {sectionIdx === 1 && itemIdx === 1 && (
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-divider, #e5e7eb)' }}>
                          <Skeleton variant="text" width="94%" height="14px" style={{ marginBottom: '6px' }} />
                          <Skeleton variant="text" width="88%" height="14px" style={{ marginBottom: '6px' }} />
                          <Skeleton variant="text" width="60%" height="14px" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="faqs-sidebar">
          <div className="faq-sidebar-card faq-nav-card" style={{ padding: '20px', marginBottom: '16px' }}>
            <Skeleton variant="text" width="120px" height="18px" style={{ marginBottom: '16px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3, 4, 5].map((c) => (
                <div key={c} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Skeleton variant="text" width="60%" height="14px" />
                  <Skeleton variant="pill" width="28px" height="20px" />
                </div>
              ))}
            </div>
          </div>

          <div className="faq-sidebar-card faq-help-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <Skeleton variant="circular" width={48} height={48} style={{ marginBottom: '12px' }} />
            <Skeleton variant="text" width="150px" height="18px" style={{ marginBottom: '8px' }} />
            <Skeleton variant="text" width="85%" height="13px" style={{ marginBottom: '4px' }} />
            <Skeleton variant="text" width="70%" height="13px" style={{ marginBottom: '16px' }} />
            <Skeleton variant="rounded" width="140px" height="38px" borderRadius="6px" style={{ marginBottom: '16px' }} />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Skeleton variant="text" width="90%" height="13px" />
              <Skeleton variant="text" width="75%" height="13px" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

/**
 * 7. Settings Modal Skeleton & Content Skeleton
 * Modal overlay, modal header, profile picture with fields, security section, and save footer
 */
export const SettingsContentSkeleton = () => {
  return (
    <>
      {/* Profile Information Section */}
      <div className="settings-section">
        <Skeleton variant="text" width="160px" height="20px" style={{ marginBottom: '20px' }} />
        <div className="profile-info-grid">
          <div className="profile-picture-section">
            <div className="profile-picture-container">
              <Skeleton variant="circular" width={120} height={120} />
            </div>
          </div>

          <div className="profile-fields" style={{ width: '100%' }}>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <Skeleton variant="text" width="80px" height="14px" style={{ marginBottom: '8px' }} />
                <Skeleton variant="rounded" width="100%" height="42px" borderRadius="6px" />
              </div>
              <div>
                <Skeleton variant="text" width="80px" height="14px" style={{ marginBottom: '8px' }} />
                <Skeleton variant="rounded" width="100%" height="42px" borderRadius="6px" />
              </div>
              <div>
                <Skeleton variant="text" width="80px" height="14px" style={{ marginBottom: '8px' }} />
                <Skeleton variant="rounded" width="100%" height="42px" borderRadius="6px" />
              </div>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <Skeleton variant="text" width="90px" height="14px" style={{ marginBottom: '8px' }} />
                <Skeleton variant="rounded" width="100%" height="42px" borderRadius="6px" />
              </div>
              <div>
                <Skeleton variant="text" width="90px" height="14px" style={{ marginBottom: '8px' }} />
                <Skeleton variant="rounded" width="100%" height="42px" borderRadius="6px" />
              </div>
              <div>
                <Skeleton variant="text" width="90px" height="14px" style={{ marginBottom: '8px' }} />
                <Skeleton variant="rounded" width="100%" height="42px" borderRadius="6px" />
              </div>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <Skeleton variant="text" width="110px" height="14px" style={{ marginBottom: '8px' }} />
                <Skeleton variant="rounded" width="100%" height="42px" borderRadius="6px" />
              </div>
              <div>
                <Skeleton variant="text" width="110px" height="14px" style={{ marginBottom: '8px' }} />
                <Skeleton variant="rounded" width="100%" height="42px" borderRadius="6px" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Authentication Section */}
      <div className="settings-section" style={{ marginTop: '20px' }}>
        <Skeleton variant="text" width="200px" height="20px" style={{ marginBottom: '16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '8px', marginBottom: '12px' }}>
          <div>
            <Skeleton variant="text" width="140px" height="16px" style={{ marginBottom: '6px' }} />
            <Skeleton variant="text" width="260px" height="13px" />
          </div>
          <Skeleton variant="rounded" width="130px" height="36px" borderRadius="6px" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '8px' }}>
          <div>
            <Skeleton variant="text" width="180px" height="16px" style={{ marginBottom: '6px' }} />
            <Skeleton variant="text" width="220px" height="13px" />
          </div>
          <Skeleton variant="pill" width="48px" height="26px" />
        </div>
      </div>

      {/* Save Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', gap: '12px' }}>
        <Skeleton variant="rounded" width="140px" height="42px" borderRadius="6px" />
      </div>
    </>
  );
};

export const SettingsModalSkeleton = ({ onClose, title = "Settings" }) => {
  return (
    <div className="profile-settings-overlay" onClick={onClose} aria-label="Loading settings..." role="status">
      <div className="profile-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-settings-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close settings">
            <span style={{ fontSize: '24px', lineHeight: 1 }}>&times;</span>
          </button>
        </div>

        <div className="profile-settings-content">
          <SettingsContentSkeleton />
        </div>
      </div>
    </div>
  );
};

export default Skeleton;
