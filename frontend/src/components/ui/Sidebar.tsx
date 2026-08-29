import React from 'react';
import { version as appVersion } from '../../../package.json';

interface SidebarProps {
  activePanel: string;
  setPanel: (panel: string) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  status: 'loading' | 'online' | 'offline';
  lastUpdateIso: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onOpenFilters: () => void;
  totalActiveFilters: number;
}

interface MenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  isExternal?: boolean;
  url?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  activePanel,
  setPanel,
  theme,
  setTheme,
  status,
  lastUpdateIso,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileClose,
  onOpenFilters,
  totalActiveFilters,
}) => {
  const lastUpdateLabel = lastUpdateIso
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(lastUpdateIso))
    : '---';

  const connectionLabel =
    status === 'online' ? 'ATIVO' : status === 'loading' ? 'CARREGANDO' : 'OFFLINE';

  const menuItems: MenuItem[] = [
    {
      key: 'vigilancia',
      label: 'Vigilância',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      key: 'laboratorio',
      label: 'Laboratório',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 2v4l4 4v12h8V10l4-4V2H8z" />
          <line x1="4" y1="2" x2="20" y2="2" />
          <line x1="12" y1="10" x2="16" y2="10" />
          <line x1="10" y1="16" x2="14" y2="16" />
          <line x1="11" y1="19" x2="13" y2="19" />
        </svg>
      ),
    },
    {
      key: 'territorio',
      label: 'Território',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      ),
    },
    {
      key: 'unidades',
      label: 'Unid. Saúde',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
    },
    {
      key: 'cidadao',
      label: 'Cidadão',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      key: 'auditoria',
      label: 'Auditoria',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
  ];

  const handleItemClick = (item: MenuItem) => {
    setPanel(item.key);
    onMobileClose();
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <>
      <button
        type="button"
        className={`sidebar-backdrop ${mobileOpen ? 'open' : ''}`}
        aria-label="Fechar menu"
        onClick={onMobileClose}
      />

      <aside
        className={`sidebar ${mobileOpen ? 'sidebar--open' : ''} ${collapsed ? 'sidebar--collapsed' : ''}`}
      >
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">SRAG</div>
            <div className="logo-text sidebar-logo-text">
              <span>Mossoró</span>
              <small>Surveillance</small>
            </div>
            <button
              type="button"
              className={`sidebar-collapse-toggle${collapsed ? ' toggle-overlay' : ''}`}
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expandir sidebar' : 'Encolher sidebar'}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {collapsed ? <path d="m9 18 6-6-6-6" /> : <path d="m15 18-6-6 6-6" />}
              </svg>
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activePanel === item.key ? 'active' : ''} ${collapsed ? 'nav-item--collapsed' : ''}`}
              onClick={() => handleItemClick(item)}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label sidebar-nav-label">{item.label}</span>
            </button>
          ))}

          {/* Global Filters Drawer Trigger */}
          <button
            type="button"
            className={`nav-item nav-item--filters ${collapsed ? 'nav-item--collapsed' : ''}`}
            onClick={onOpenFilters}
            aria-label="Mostrar Filtros"
            title={collapsed ? 'Filtros' : undefined}
          >
            <span className="nav-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </span>
            {!collapsed && (
              <span
                className="nav-label sidebar-nav-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <span>Filtros</span>
                {totalActiveFilters > 0 && (
                  <span className="sb-filter-badge">{totalActiveFilters}</span>
                )}
              </span>
            )}
            {collapsed && totalActiveFilters > 0 && (
              <span className="sb-filter-badge sb-filter-badge--collapsed">
                {totalActiveFilters}
              </span>
            )}
          </button>
        </nav>

        <div className="sidebar-footer">
          <button
            onClick={toggleTheme}
            className={`nav-item ${collapsed ? 'nav-item--collapsed' : ''}`}
            style={{
              width: '100%',
              marginBottom: '0.75rem',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-pill)',
            }}
            aria-label={theme === 'light' ? 'Mudar para tema escuro' : 'Mudar para tema claro'}
            title={collapsed ? 'Alternar tema' : undefined}
          >
            <span className="nav-icon">
              {theme === 'light' ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="18.36" x2="5.64" y2="16.94" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </span>
            <span className="nav-label sidebar-nav-label" style={{ fontSize: '0.8rem' }}>
              {theme === 'light' ? 'Escuro' : 'Claro'}
            </span>
          </button>

          <div className="sb-meta sidebar-footer-meta">
            <div className="sb-meta-item">
              <span className={`sb-dot ${status === 'online' ? 'online' : 'offline'}`} />
              <span className="sb-meta-label">Base</span>
              <span className="sb-meta-value">{lastUpdateLabel}</span>
            </div>
          </div>

          <div className="sb-version sidebar-footer-meta">
            <span className="v-badge">v{appVersion}</span>
            <span className={`sb-sync-badge ${status === 'online' ? 'sync-ok' : 'sync-off'}`}>
              <span className="sb-sync-dot" />
              {connectionLabel}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
