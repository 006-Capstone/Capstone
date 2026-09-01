const fs = require('fs');

// 1. Update Archive.jsx
let jsx = fs.readFileSync('src/components/Archive.jsx', 'utf8');

const oldFilters = `{/* Filter Buttons */}
      <div className="archive-filters-row">
        <div className="archive-filter-buttons">
          <button
            className={\`filter-btn \${archiveFilter === 'All' ? 'active' : ''}\`}
            onClick={() => setArchiveFilter('All')}
          >
            All Accounts
          </button>
          <button
            className={\`filter-btn \${archiveFilter === 'Students' ? 'active' : ''}\`}
            onClick={() => setArchiveFilter('Students')}
          >
            Students Only
          </button>
          <button
            className={\`filter-btn \${archiveFilter === 'Staff' ? 'active' : ''}\`}
            onClick={() => setArchiveFilter('Staff')}
          >
            Staff Only
          </button>
        </div>
        <div className="archive-count">
          {filteredAccounts.length} account{filteredAccounts.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Table */}
      <div className="table-section">`;

const newFilters = `{/* Table Section with Tabs */}
      <div className="table-section admin-table-card">
        <div className="archive-tabs-container">
          <div className="archive-tabs">
            <div 
              className={\`tab \${archiveFilter === 'All' ? 'active' : ''}\`}
              onClick={() => setArchiveFilter('All')}
            >
              All Accounts
            </div>
            <div 
              className={\`tab \${archiveFilter === 'Students' ? 'active' : ''}\`}
              onClick={() => setArchiveFilter('Students')}
            >
              Students Only
            </div>
            <div 
              className={\`tab \${archiveFilter === 'Staff' ? 'active' : ''}\`}
              onClick={() => setArchiveFilter('Staff')}
            >
              Staff Only
            </div>
          </div>
          <div className="archive-count">
            {filteredAccounts.length} account{filteredAccounts.length === 1 ? '' : 's'}
          </div>
        </div>`;

if(jsx.includes('<div className="archive-filters-row">')) {
  jsx = jsx.replace(oldFilters, newFilters);
  fs.writeFileSync('src/components/Archive.jsx', jsx);
}

// 2. Update Archive.css
let css = fs.readFileSync('src/styles/Archive.css', 'utf8');

const oldCssRegex = /\.archive-filters-row {[\s\S]*?\.archive-filter-buttons \.filter-btn {[\s\S]*?}/;

const newCss = `.archive-tabs-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-divider);
  background-color: var(--gray-25, #fafafa);
}

.archive-tabs {
  display: flex;
  padding: 0 var(--space-4);
}

.archive-tabs .tab {
  padding: 14px 18px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all var(--transition-fast);
  user-select: none;
}

.archive-tabs .tab:hover {
  color: var(--color-primary);
}

.archive-tabs .tab.active {
  color: var(--color-primary);
  border-bottom: 2px solid var(--color-primary);
}

.archive-count {
  padding-right: var(--space-5);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-weight: var(--font-weight-medium);
}`;

css = css.replace(oldCssRegex, newCss);

// Remove the responsive styles for the old filters
const oldMediaRegex = /\.archive-filters-row {[\s\S]*?align-items: flex-start;\n  }[\s\S]*?\.archive-filter-buttons {[\s\S]*?width: 100%;\n  }[\s\S]*?\.archive-filter-buttons \.filter-btn {[\s\S]*?flex: 1;\n  }/;
css = css.replace(oldMediaRegex, '');

fs.writeFileSync('src/styles/Archive.css', css);

console.log('done');
