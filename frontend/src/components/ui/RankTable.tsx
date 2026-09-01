import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { exportToCsv, exportToPdf, exportToXlsx } from '../../utils/exportTable';

export interface RankTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
  sortable?: boolean;
}

export interface RankTableRow {
  key: string;
  values: Record<string, React.ReactNode>;
  searchText?: string;
  sortValues?: Record<string, number | string>;
}

interface RankTableExportable {
  filename: string;
  title?: string;
}

interface RankTableProps {
  title: string;
  subtitle?: React.ReactNode;
  subtitlePosition?: 'top' | 'bottom';
  searchPlaceholder: string;
  columns: RankTableColumn[];
  rows: RankTableRow[];
  pageSizeOptions?: number[];
  initialPageSize?: number;
  exportable?: RankTableExportable;
  children?: React.ReactNode;
}

function getCellTextForSort(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(getCellTextForSort).join('');
  if (typeof value === 'object') {
    const obj = value as { props?: unknown };
    if (obj.props != null) {
      const props = obj.props as Record<string, unknown>;
      if ('children' in props) return getCellTextForSort(props.children);
    }
  }
  return String(value);
}

function parseNumericCell(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = getCellTextForSort(value).trim();
  if (!raw || raw === '—' || raw === '-' || raw.toLowerCase() === 'na') return Number.NaN;
  // Keep digits, minus, dot, comma
  let s = raw.replace(/[^\d.,-]/g, '').trim();
  if (!s) return Number.NaN;
  // pt-BR handling: 1.234,56 -> 1234.56 ; 28,6 -> 28.6
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

const RankTable: React.FC<RankTableProps> = ({
  title,
  subtitle,
  subtitlePosition = 'top',
  searchPlaceholder,
  columns,
  rows,
  pageSizeOptions = [10, 25, 50],
  initialPageSize = 10,
  exportable,
  children,
}) => {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuId = useId();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const haystack = (
        row.searchText ??
        [
          row.key,
          ...Object.values(row.values).map((v) =>
            typeof v === 'string' || typeof v === 'number' ? String(v) : '',
          ),
        ].join(' ')
      ).toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortable) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const rawA = a.sortValues?.[sortKey] ?? a.values[sortKey];
      const rawB = b.sortValues?.[sortKey] ?? b.values[sortKey];
      const na = parseNumericCell(rawA);
      const nb = parseNumericCell(rawB);
      const isNumeric = Number.isFinite(na) && Number.isFinite(nb);
      let cmp: number;
      if (isNumeric) cmp = na - nb;
      else
        cmp = getCellTextForSort(rawA ?? '').localeCompare(
          getCellTextForSort(rawB ?? ''),
          'pt-BR',
          { sensitivity: 'base', numeric: true },
        );
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  const toggleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  useEffect(() => {
    if (!showExportMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowExportMenu(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!exportMenuRef.current?.contains(target) && !exportBtnRef.current?.contains(target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [showExportMenu]);

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    setShowExportMenu(false);
    if (!exportable || sorted.length === 0) return;
    const base = exportable.filename;
    const titleForExport = exportable.title ?? title;
    try {
      if (format === 'csv') exportToCsv(sorted, columns, base);
      else if (format === 'xlsx') await exportToXlsx(sorted, columns, base, titleForExport);
      else if (format === 'pdf') await exportToPdf(sorted, columns, base, titleForExport);
    } catch (err) {
      console.error('Falha ao exportar tabela', err);
    }
  };

  return (
    <div className="rank-table">
      <div className="section-header rank-table__header">
        <div>
          <div
            className="rank-table__title-container"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <h3>{title}</h3>
            {subtitle && (
              <div className="rank-tooltip-wrapper">
                <button
                  type="button"
                  className="rank-tooltip-trigger"
                  aria-label="Informações sobre a tabela"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </button>
                <div
                  className={`rank-tooltip-content${subtitlePosition === 'bottom' ? ' rank-tooltip-content--below' : ''}`}
                  style={{ width: '340px' }}
                >
                  {subtitle}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="filters rank-table__controls">
          {children}
          <input
            className="rank-search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <label className="rank-table__select">
            Linhas
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          {exportable && (
            <div style={{ position: 'relative' }}>
              <button
                ref={exportBtnRef}
                type="button"
                onClick={() => setShowExportMenu((v) => !v)}
                disabled={sorted.length === 0}
                aria-haspopup="menu"
                aria-expanded={showExportMenu}
                aria-controls={exportMenuId}
                title={sorted.length === 0 ? 'Sem dados para exportar' : 'Baixar tabela'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  minHeight: 34,
                  height: 34,
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1px solid var(--border-subtle)',
                  background: showExportMenu ? 'var(--bg-panel)' : 'var(--bg-status)',
                  color: sorted.length === 0 ? 'var(--text-muted)' : 'var(--text-main)',
                  cursor: sorted.length === 0 ? 'default' : 'pointer',
                  opacity: sorted.length === 0 ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3v13" />
                  <path d="M8 11l4 4 4-4" />
                  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
                Exportar
                <span aria-hidden="true" style={{ fontSize: 9, opacity: 0.7, marginLeft: 1 }}>
                  ▾
                </span>
              </button>
              {showExportMenu && (
                <div
                  ref={exportMenuRef}
                  id={exportMenuId}
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    minWidth: 168,
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                    padding: 6,
                    zIndex: 30,
                    display: 'grid',
                    gap: 4,
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleExport('csv')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background: 'rgba(100,116,139,0.12)',
                        color: '#64748b',
                        flexShrink: 0,
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 3h7l4 4v13H7z" />
                        <path d="M14 3v5h5" />
                        <path d="M9 14h6" />
                        <path d="M9 18h6" />
                        <path d="M9 10h1" />
                      </svg>
                    </span>
                    CSV{' '}
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>
                      (.csv)
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleExport('xlsx')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background: 'rgba(16,185,129,0.14)',
                        color: '#059669',
                        flexShrink: 0,
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 3h7l4 4v13H7z" />
                        <path d="M14 3v5h5" />
                        <path d="M9 14h6" />
                        <path d="M9 18h3" />
                        <path d="M13 10v8" />
                        <path d="M9 10h6" />
                      </svg>
                    </span>
                    Excel{' '}
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>
                      (.xlsx)
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleExport('pdf')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background: 'rgba(239,68,68,0.12)',
                        color: '#dc2626',
                        flexShrink: 0,
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 3h7l4 4v13H7z" />
                        <path d="M14 3v5h5" />
                        <path d="M9 13.5l1.2 1.8L12 12" />
                        <path d="M13.5 15.5h3" />
                      </svg>
                    </span>
                    PDF{' '}
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>
                      (.pdf)
                    </span>
                  </button>
                  <div
                    style={{
                      borderTop: '1px solid var(--border-subtle)',
                      marginTop: 2,
                      paddingTop: 6,
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      lineHeight: 1.4,
                      paddingLeft: 4,
                      paddingRight: 4,
                    }}
                  >
                    Exporta {sorted.length} linhas filtradas+ordenadas com data/hora no nome.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rank-table__scroll">
        <table className="rank-table__table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={[
                    column.align === 'right' ? 'is-right' : '',
                    column.sortable ? 'is-sortable' : '',
                    sortKey === column.key ? `is-sorted is-sorted--${sortDir}` : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  {...(column.sortable
                    ? {
                        onClick: () => toggleSort(column.key, column.sortable),
                        role: 'button',
                        tabIndex: 0,
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleSort(column.key, column.sortable);
                          }
                        },
                        'aria-sort':
                          sortKey === column.key
                            ? sortDir === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none',
                        title: 'Ordenar',
                      }
                    : {})}
                  style={column.sortable ? { cursor: 'pointer', userSelect: 'none' } : undefined}
                >
                  {column.label}
                  {column.sortable && (
                    <span
                      aria-hidden="true"
                      style={{
                        marginLeft: 4,
                        fontSize: 10,
                        opacity: sortKey === column.key ? 1 : 0.35,
                      }}
                    >
                      {sortKey === column.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="rank-table__empty">
                  Nenhum resultado encontrado.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={row.key}>
                  {columns.map((column) => (
                    <td key={column.key} className={column.align === 'right' ? 'is-right' : ''}>
                      {row.values[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rank-table__footer">
        <span className="meta">
          Mostrando {sorted.length === 0 ? 0 : start + 1}–
          {sorted.length === 0 ? 0 : start + pageRows.length} de {sorted.length}
        </span>
        <div className="rank-table__pager">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={safePage <= 1}
          >
            Anterior
          </button>
          <span>
            Página {safePage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={safePage >= totalPages}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
};

export default RankTable;
