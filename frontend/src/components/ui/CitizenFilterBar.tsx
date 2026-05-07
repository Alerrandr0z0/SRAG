import React, { useMemo } from 'react';

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

interface CitizenFilterBarProps {
  citizenTab: string[];
  setCitizenTab: (tabs: string[]) => void;
  raceFilter: string[];
  setRaceFilter: (races: string[]) => void;
  genderFilter: string[];
  setGenderFilter: (genders: string[]) => void;
}

const CitizenFilterBar: React.FC<CitizenFilterBarProps> = ({
  citizenTab,
  setCitizenTab,
  raceFilter,
  setRaceFilter,
  genderFilter,
  setGenderFilter,
}) => {
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
  };

  const totalActive = citizenTab.length + raceFilter.length + genderFilter.length;

  const summaryText = useMemo(() => {
    const parts: string[] = [];
    if (citizenTab.length) parts.push(citizenTab.map(k => PERFIL_OPTIONS.find(o => o.key === k)?.label).join(', '));
    if (raceFilter.length) parts.push(raceFilter.map(k => RACA_OPTIONS.find(o => o.key === k)?.label).join(', '));
    if (genderFilter.length) parts.push(genderFilter.map(k => GENERO_OPTIONS.find(o => o.key === k)?.label).join(', '));
    return parts.join(' · ');
  }, [citizenTab, raceFilter, genderFilter]);

  return (
    <div className="fb">
      <div style={{ overflowX: 'auto', paddingBottom: '2px' }}>
        <div className="fb-bar">
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

          <div className="fb-sep"></div>

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

          <div className="fb-sep"></div>

          <span className="fb-label">Gênero</span>
          {GENERO_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`pill ${genderFilter.includes(opt.key) ? 'active' : ''}`}
              onClick={() => toggle(genderFilter, opt.key, setGenderFilter)}
            >
              {opt.label}
            </button>
          ))}

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

export default CitizenFilterBar;
