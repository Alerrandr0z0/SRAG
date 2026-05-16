import React, { useMemo, useState } from 'react';

interface FilterOption {
  key: string;
  label: string;
}

const PERFIL_OPTIONS: FilterOption[] = [
  { key: 'crianca', label: 'Criança' },
  { key: 'adolescente', label: 'Adolescente' },
  { key: 'adulto', label: 'Adulto' },
  { key: 'idoso', label: 'Idoso' },
];

const RACA_OPTIONS: FilterOption[] = [
  { key: 'Branca', label: 'Branca' },
  { key: 'Preta', label: 'Preta' },
  { key: 'Amarela', label: 'Amarela' },
  { key: 'Parda', label: 'Parda' },
  { key: 'Indígena', label: 'Indígena' },
];

const GENERO_OPTIONS: FilterOption[] = [
  { key: 'M', label: 'Masculino' },
  { key: 'F', label: 'Feminino' },
  { key: 'I', label: 'Ignorado' },
];

const MATERNAL_OPTIONS: FilterOption[] = [
  { key: 'gestante', label: 'Gestante' },
  { key: 'puerpera', label: 'Puérpera' },
];

interface CitizenFilterBarProps {
  citizenTab: string[];
  setCitizenTab: (tabs: string[]) => void;
  raceFilter: string[];
  setRaceFilter: (races: string[]) => void;
  genderFilter: string[];
  setGenderFilter: (genders: string[]) => void;
  maternalFilter: string[];
  setMaternalFilter: (maternal: string[]) => void;
  occupationFilter: string[];
  setOccupationFilter: (occ: string[]) => void;
  occupationOptions: string[];
}

const CitizenFilterBar: React.FC<CitizenFilterBarProps> = ({
  citizenTab,
  setCitizenTab,
  raceFilter,
  setRaceFilter,
  genderFilter,
  setGenderFilter,
  maternalFilter,
  setMaternalFilter,
  occupationFilter,
  setOccupationFilter,
  occupationOptions,
}) => {
  const [occSearch, setOccSearch] = useState('');
  const [showOccDropdown, setShowOccDropdown] = useState(false);

  const toggle = (list: string[], key: string, setter: (val: string[]) => void) => {
    if (list.includes(key)) {
      setter(list.filter((i) => i !== key));
    } else {
      setter([...list, key]);
    }
  };

  const clearAll = () => {
    setCitizenTab([]);
    setRaceFilter([]);
    setGenderFilter([]);
    setMaternalFilter([]);
    setOccupationFilter([]);
  };

  const isFemaleSelected = genderFilter.includes('F');

  const filteredOccupations = useMemo(() => {
    if (!occSearch) return occupationOptions.slice(0, 10);
    return occupationOptions
      .filter(o => o.toLowerCase().includes(occSearch.toLowerCase()))
      .slice(0, 15);
  }, [occupationOptions, occSearch]);

  return (
    <div className="fb" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', width: '100%' }}>
      <div className="fb-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', width: '100%' }}>

        {/* Perfil Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span className="fb-label">Perfil</span>
          {PERFIL_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`pill ${citizenTab.includes(opt.key) ? 'active' : ''}`}
              onClick={() => toggle(citizenTab, opt.key, setCitizenTab)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="fb-sep"></div>

        {/* Raça Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span className="fb-label">Raça</span>
          {RACA_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`pill ${raceFilter.includes(opt.key) ? 'active' : ''}`}
              onClick={() => toggle(raceFilter, opt.key, setRaceFilter)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="fb-sep"></div>

        {/* Gênero Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span className="fb-label">Gênero</span>
          {GENERO_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`pill ${genderFilter.includes(opt.key) ? 'active' : ''}`}
              onClick={() => {
                const newList = genderFilter.includes(opt.key)
                  ? genderFilter.filter(i => i !== opt.key)
                  : [...genderFilter, opt.key];
                setGenderFilter(newList);
                if (opt.key === 'F' && genderFilter.includes('F')) {
                  setMaternalFilter([]);
                }
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Maternal Group - Conditional */}
        {isFemaleSelected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div className="fb-sep" style={{ borderLeft: '1px dashed #be185d', opacity: 0.5, height: '20px', width: 0, margin: '0 4px' }}></div>
            <span className="fb-label" style={{ color: '#be185d' }}>Maternal</span>
            {MATERNAL_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                className={`pill ${maternalFilter.includes(opt.key) ? 'active' : ''}`}
                style={maternalFilter.includes(opt.key) ? { backgroundColor: '#be185d', borderColor: '#be185d' } : {}}
                onClick={() => toggle(maternalFilter, opt.key, setMaternalFilter)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <div className="fb-sep"></div>

        {/* Ocupação Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flexGrow: 1, minWidth: '220px' }}>
          <span className="fb-label">Ocupação</span>
          <div style={{ position: 'relative', flex: 1 }}>
             <input
              type="text"
              placeholder="Buscar profissão..."
              value={occSearch}
              onChange={(e) => {
                setOccSearch(e.target.value);
                setShowOccDropdown(true);
              }}
              onFocus={() => setShowOccDropdown(true)}
              className="custom-select"
              style={{ width: '100%', paddingRight: '2.5rem' }}
            />
            <svg
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          </div>

          {showOccDropdown && (occSearch || filteredOccupations.length > 0) && (
            <div
              className="panel"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                marginTop: '8px',
                padding: '0.6rem',
                maxHeight: '300px',
                overflowY: 'auto',
                boxShadow: '0 12px 30px -5px rgba(0,0,0,0.15)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {filteredOccupations.map(occ => (
                  <button
                    key={occ}
                    onClick={() => {
                      toggle(occupationFilter, occ, setOccupationFilter);
                      setOccSearch('');
                      // REMOVED: setShowOccDropdown(false);
                    }}
                    className={`nav-item ${occupationFilter.includes(occ) ? 'active' : ''}`}
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  >
                    {occ}
                  </button>
                ))}
                {filteredOccupations.length === 0 && (
                  <p style={{ padding: '12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>Nenhuma ocupação encontrada.</p>
                )}
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '6px', paddingTop: '6px' }}>
                <button
                  onClick={() => setShowOccDropdown(false)}
                  style={{ width: '100%', border: 'none', background: '#f8fafc', padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>

        <button className="fb-clear" onClick={clearAll} title="Limpar Filtros" style={{ flexShrink: 0 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {occupationFilter.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '4rem' }}>
          {occupationFilter.map(occ => (
            <div key={occ} className="global-filter-chip" style={{ fontSize: '10px', padding: '2px 8px' }}>
              {occ}
              <button
                onClick={() => setOccupationFilter(occupationFilter.filter(o => o !== occ))}
                className="global-filter-close"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CitizenFilterBar;
