import React, { useMemo, useState } from 'react';

export interface RankTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export interface RankTableRow {
  key: string;
  values: Record<string, React.ReactNode>;
}

interface RankTableProps {
  title: string;
  subtitle?: string;
  searchPlaceholder: string;
  columns: RankTableColumn[];
  rows: RankTableRow[];
  pageSizeOptions?: number[];
  initialPageSize?: number;
  children?: React.ReactNode;
}

const RankTable: React.FC<RankTableProps> = ({
  title,
  subtitle,
  searchPlaceholder,
  columns,
  rows,
  pageSizeOptions = [10, 25, 50],
  initialPageSize = 10,
  children,
}) => {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => row.key.toLowerCase().includes(term));
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

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
                <div className="rank-tooltip-content">{subtitle}</div>
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
        </div>
      </div>

      <div className="rank-table__scroll">
        <table className="rank-table__table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.align === 'right' ? 'is-right' : ''}>
                  {column.label}
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
          Mostrando {filtered.length === 0 ? 0 : start + 1}–
          {filtered.length === 0 ? 0 : start + pageRows.length} de {filtered.length}
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
