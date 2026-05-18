import React, { useMemo } from 'react';

interface FilterOption {
  key: string;
  label: string;
}

const ZONA_OPTIONS: FilterOption[] = [
  { key: 'URBANA', label: 'Urbana' },
  { key: 'RURAL', label: 'Rural' },
  { key: 'PERIURBANA', label: 'Periurbana' },
];

interface TerritoryFilterBarProps {
  zoneFilter: string[];
  setZoneFilter: (zones: string[]) => void;
  bairroFilter: string[];
  setBairroFilter: (bairros: string[]) => void;
  bairrosList: Array<{ name: string; count: number }>;
}

const TerritoryFilterBar: React.FC<TerritoryFilterBarProps> = ({
  zoneFilter,
  setZoneFilter,
  bairroFilter,
  setBairroFilter,
  bairrosList,
}) => {
  const toggle = (list: string[], key: string, setter: (val: string[]) => void) => {
    if (list.includes(key)) {
      setter(list.filter((i) => i !== key));
    } else {
      setter([...list, key]);
    }
  };

  const addBairro = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val && !bairroFilter.includes(val)) {
      setBairroFilter([...bairroFilter, val]);
    }
  };

  const clearAll = () => {
    setZoneFilter([]);
    setBairroFilter([]);
  };

  const totalActive = zoneFilter.length + bairroFilter.length;

  const summaryText = useMemo(() => {
    const parts: string[] = [];
    if (zoneFilter.length)
      parts.push(
        zoneFilter.map((k) => ZONA_OPTIONS.find((o) => o.key === k)?.label || k).join(', '),
      );
    if (bairroFilter.length) parts.push(bairroFilter.join(', '));
    return parts.join(' · ');
  }, [zoneFilter, bairroFilter]);

  return (
    <div className="fb">
      <div style={{ overflowX: 'auto', paddingBottom: '2px' }}>
        <div className="fb-bar">
          <span className="fb-label">Zona</span>
          {ZONA_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`pill ${zoneFilter.includes(opt.key) ? 'active' : ''}`}
              onClick={() => toggle(zoneFilter, opt.key, setZoneFilter)}
            >
              {opt.label}
            </button>
          ))}

          <div className="fb-sep"></div>

          <span className="fb-label">Bairro / Comunidade</span>
          {bairroFilter.map((b) => (
            <button
              key={b}
              className="pill active"
              onClick={() => toggle(bairroFilter, b, setBairroFilter)}
              title="Clique para remover"
            >
              {b} &times;
            </button>
          ))}

          <select
            onChange={addBairro}
            className="pill"
            style={{
              appearance: 'none',
              cursor: 'pointer',
              outline: 'none',
              background: 'transparent',
            }}
          >
            <option value="">+ Adicionar local...</option>
            {bairrosList.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name} ({b.count})
              </option>
            ))}
          </select>

          <div className="fb-sep"></div>

          <button className="fb-clear" onClick={clearAll} title="Limpar Filtros">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2l6 6M8 2l-6 6" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className={`fb-summary ${totalActive > 0 ? 'visible' : ''}`}>
        Filtrando: {summaryText} <span className="fb-badge">{totalActive}</span>
      </div>
    </div>
  );
};

export default TerritoryFilterBar;
