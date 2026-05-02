import React, { useMemo } from 'react';

interface UnitsFilterBarProps {
  unitFilter: string[];
  setUnitFilter: (units: string[]) => void;
  unitsList: Array<{ id_unidade: string; count: number }>;
}

const UnitsFilterBar: React.FC<UnitsFilterBarProps> = ({
  unitFilter,
  setUnitFilter,
  unitsList,
}) => {
  const toggle = (list: string[], key: string, setter: (val: string[]) => void) => {
    if (list.includes(key)) {
      setter(list.filter((i) => i !== key));
    } else {
      setter([...list, key]);
    }
  };

  const addUnit = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val && !unitFilter.includes(val)) {
      setUnitFilter([...unitFilter, val]);
    }
    e.target.value = ""; // Reset select
  };

  const clearAll = () => {
    setUnitFilter([]);
  };

  const totalActive = unitFilter.length;

  const summaryText = useMemo(() => {
    return unitFilter.join(', ');
  }, [unitFilter]);

  return (
    <div className="fb">
      <div style={{ overflowX: 'auto', paddingBottom: '2px' }}>
        <div className="fb-bar">
          <span className="fb-label">Unidade Notificadora</span>
          
          {unitFilter.map((u) => (
            <button
              key={u}
              className="pill active"
              onClick={() => toggle(unitFilter, u, setUnitFilter)}
              title="Clique para remover"
            >
              {u} &times;
            </button>
          ))}
          
          <select 
            onChange={addUnit} 
            className="pill" 
            style={{ appearance: 'none', cursor: 'pointer', outline: 'none', background: 'transparent' }}
          >
            <option value="">+ Adicionar unidade...</option>
            {unitsList.map(u => (
              <option key={u.id_unidade} value={u.id_unidade}>{u.id_unidade} ({u.count})</option>
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

export default UnitsFilterBar;
