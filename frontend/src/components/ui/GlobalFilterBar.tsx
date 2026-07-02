import React, { useEffect, useMemo, useRef, useState } from 'react';

interface FilterOption {
  key: string;
  label: string;
}

interface ActiveFilter {
  type: string;
  val: string;
  remover: () => void;
}

interface GlobalFilterBarProps {
  years: number[];
  dashboardYear: number[];
  setDashboardYear: (y: number[]) => void;

  citizenTab: string[];
  setCitizenTab: (t: string[]) => void;
  raceFilter: string[];
  setRaceFilter: (r: string[]) => void;
  genderFilter: string[];
  setGenderFilter: (g: string[]) => void;
  maternalFilter: string[];
  setMaternalFilter: (m: string[]) => void;
  occupationFilter: string[];
  setOccupationFilter: (o: string[]) => void;

  zoneFilter: string[];
  setZoneFilter: (z: string[]) => void;
  bairroFilter: string[];
  setBairroFilter: (b: string[]) => void;
  bairrosList: Array<{ name: string; count: number }>;

  unitFilter: string[];
  setUnitFilter: (u: string[]) => void;
  unitsList: Array<{
    id_unidade: string;
    nome_fantasia: string;
    count: number;
    municipio?: string;
    uf?: string;
  }>;

  agentFilter: string[];
  setAgentFilter: (a: string[]) => void;

  occupationOptions: string[];

  activeFilters: ActiveFilter[];
  clearAllFilters: () => void;

  dashboardMonth: number[];
  setDashboardMonth: (m: number[]) => void;
  dashboardDay: number[];
  setDashboardDay: (d: number[]) => void;
}

const PERFIL_OPTS: FilterOption[] = [
  { key: 'crianca', label: 'Criança' },
  { key: 'adolescente', label: 'Adolescente' },
  { key: 'adulto', label: 'Adulto' },
  { key: 'idoso', label: 'Idoso' },
];

const RACA_OPTS: FilterOption[] = [
  { key: 'Branca', label: 'Branca' },
  { key: 'Preta', label: 'Preta' },
  { key: 'Amarela', label: 'Amarela' },
  { key: 'Parda', label: 'Parda' },
  { key: 'Indígena', label: 'Indígena' },
];

const GENERO_OPTS: FilterOption[] = [
  { key: 'M', label: 'Masculino' },
  { key: 'F', label: 'Feminino' },
  { key: 'I', label: 'Ignorado' },
];

const ZONA_OPTS: FilterOption[] = [
  { key: 'URBANA', label: 'Urbana' },
  { key: 'RURAL', label: 'Rural' },
  { key: 'PERIURBANA', label: 'Periurbana' },
];

const MATERNAL_OPTS: FilterOption[] = [
  { key: 'gestante', label: 'Gestante' },
  { key: 'puerpera', label: 'Puérpera' },
];

const AGENT_OPTS: FilterOption[] = [
  { key: 'COVID-19', label: 'COVID-19' },
  { key: 'Influenza', label: 'Influenza' },
];

const toggle = (list: string[], key: string, setter: (v: string[]) => void) => {
  setter(list.includes(key) ? list.filter((i) => i !== key) : [...list, key]);
};

const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({
  years,
  dashboardYear,
  setDashboardYear,
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
  zoneFilter,
  setZoneFilter,
  bairroFilter,
  setBairroFilter,
  bairrosList,
  unitFilter,
  setUnitFilter,
  unitsList,
  agentFilter,
  setAgentFilter,
  occupationOptions,
  activeFilters,
  clearAllFilters,
  dashboardMonth,
  setDashboardMonth,
  dashboardDay,
  setDashboardDay,
}) => {
  const [occSearch, setOccSearch] = useState('');
  const [showOccDropdown, setShowOccDropdown] = useState(false);
  const [bairroSearch, setBairroSearch] = useState('');
  const [showBairroDropdown, setShowBairroDropdown] = useState(false);
  const [unitSearch, setUnitSearch] = useState('');
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const isFemaleSelected = genderFilter.includes('F');

  const occRef = useRef<HTMLDivElement>(null);
  const bairroRef = useRef<HTMLDivElement>(null);
  const unitRef = useRef<HTMLDivElement>(null);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('gfb-collapsed') === 'true';
  });

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('gfb-collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bairroRef.current && !bairroRef.current.contains(event.target as Node)) {
        setShowBairroDropdown(false);
      }
      if (unitRef.current && !unitRef.current.contains(event.target as Node)) {
        setShowUnitDropdown(false);
      }
      if (occRef.current && !occRef.current.contains(event.target as Node)) {
        setShowOccDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredOccupations = useMemo(() => {
    const search = occSearch.toLowerCase();
    const filtered = occupationOptions.filter((o) => o.toLowerCase().includes(search));

    // Sort selected to the top, then limit
    return [...occupationFilter, ...filtered.filter((o) => !occupationFilter.includes(o))].slice(
      0,
      20,
    );
  }, [occupationOptions, occSearch, occupationFilter]);

  const filteredBairros = useMemo(() => {
    const search = bairroSearch.toLowerCase();
    const filtered = bairrosList.filter((b) => b.name.toLowerCase().includes(search));

    const selectedNames = bairroFilter;
    const selectedObjs = bairrosList.filter((b) => selectedNames.includes(b.name));
    const unselectedObjs = filtered.filter((b) => !selectedNames.includes(b.name));

    return [...selectedObjs, ...unselectedObjs].slice(0, 25);
  }, [bairrosList, bairroSearch, bairroFilter]);

  const filteredUnits = useMemo(() => {
    const search = unitSearch.toLowerCase();
    const filtered = unitsList.filter((u) => {
      return (
        u.id_unidade.toLowerCase().includes(search) ||
        u.nome_fantasia.toLowerCase().includes(search) ||
        u.municipio?.toLowerCase().includes(search) ||
        u.uf?.toLowerCase().includes(search)
      );
    });

    const selectedNames = unitFilter;
    const selectedObjs = unitsList.filter((u) => selectedNames.includes(u.id_unidade));
    const unselectedObjs = filtered.filter((u) => !selectedNames.includes(u.id_unidade));

    return [...selectedObjs, ...unselectedObjs].slice(0, 30);
  }, [unitsList, unitSearch, unitFilter]);

  const totalActive = activeFilters.length;

  return (
    <article className="gfb">
      <div className="gfb-body">
        <div
          className={`gfb-title${isCollapsed && totalActive === 0 ? ' gfb-title--collapsed-empty' : ''}`}
        >
          <div className="gfb-title-left">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            <span>Filtros</span>
            {isCollapsed && totalActive > 0 && (
              <span className="gfb-active-badge">
                {totalActive} {totalActive === 1 ? 'ativo' : 'ativos'}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="gfb-toggle-btn"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? 'Mostrar Filtros' : 'Ocultar Filtros'}
          >
            {isCollapsed ? 'Mostrar Filtros' : 'Ocultar Filtros'}
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`gfb-toggle-icon ${isCollapsed ? '' : 'gfb-toggle-icon--open'}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        <div className={`gfb-collapsible ${isCollapsed ? 'collapsed' : ''}`}>
          <div className="gfb-groups">
            {/* Ano */}
            <div className="gfb-group">
              <span className="gfb-label">Ano</span>
              <select
                className="gfb-select"
                value={dashboardYear[0] ? String(dashboardYear[0]) : ''}
                onChange={(e) => setDashboardYear(e.target.value ? [Number(e.target.value)] : [])}
              >
                <option value="">Todos</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Mês */}
            <div className="gfb-group">
              <span className="gfb-label">Mês</span>
              <select
                className="gfb-select"
                value={dashboardMonth[0] ? String(dashboardMonth[0]) : ''}
                onChange={(e) => setDashboardMonth(e.target.value ? [Number(e.target.value)] : [])}
              >
                <option value="">Todos</option>
                {[
                  [1, 'Jan'],
                  [2, 'Fev'],
                  [3, 'Mar'],
                  [4, 'Abr'],
                  [5, 'Mai'],
                  [6, 'Jun'],
                  [7, 'Jul'],
                  [8, 'Ago'],
                  [9, 'Set'],
                  [10, 'Out'],
                  [11, 'Nov'],
                  [12, 'Dez'],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Dia */}
            <div className="gfb-group">
              <span className="gfb-label">Dia</span>
              <select
                className="gfb-select"
                value={dashboardDay[0] ? String(dashboardDay[0]) : ''}
                onChange={(e) => setDashboardDay(e.target.value ? [Number(e.target.value)] : [])}
              >
                <option value="">Todos</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Perfil */}
            <div className="gfb-group">
              <span className="gfb-label">Perfil</span>
              <div className="gfb-pills">
                {PERFIL_OPTS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`gfb-pill ${citizenTab.includes(opt.key) ? 'active' : ''}`}
                    onClick={() => toggle(citizenTab, opt.key, setCitizenTab)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Raça */}
            <div className="gfb-group">
              <span className="gfb-label">Raça</span>
              <div className="gfb-pills">
                {RACA_OPTS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`gfb-pill ${raceFilter.includes(opt.key) ? 'active' : ''}`}
                    onClick={() => toggle(raceFilter, opt.key, setRaceFilter)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Gênero */}
            <div className="gfb-group">
              <span className="gfb-label">Gênero</span>
              <div className="gfb-pills">
                {GENERO_OPTS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`gfb-pill ${genderFilter.includes(opt.key) ? 'active' : ''}`}
                    onClick={() => {
                      const newList = genderFilter.includes(opt.key)
                        ? genderFilter.filter((i) => i !== opt.key)
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
            </div>

            {/* Agente Etiológico */}
            <div className="gfb-group">
              <span className="gfb-label">Agente Etiológico</span>
              <div className="gfb-pills">
                {AGENT_OPTS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`gfb-pill ${agentFilter[0] === opt.key ? 'active' : ''}`}
                    onClick={() => {
                      setAgentFilter(agentFilter[0] === opt.key ? [] : [opt.key]);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Maternal */}
            {isFemaleSelected && (
              <div className="gfb-group">
                <span className="gfb-label" style={{ color: 'var(--color-maternal)' }}>
                  Maternal
                </span>
                <div className="gfb-pills">
                  {MATERNAL_OPTS.map((opt) => (
                    <button
                      key={opt.key}
                      className={`gfb-pill maternal ${maternalFilter.includes(opt.key) ? 'active' : ''}`}
                      onClick={() => toggle(maternalFilter, opt.key, setMaternalFilter)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Zona */}
            <div className="gfb-group">
              <span className="gfb-label">Zona</span>
              <div className="gfb-pills">
                {ZONA_OPTS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`gfb-pill ${zoneFilter.includes(opt.key) ? 'active' : ''}`}
                    onClick={() => toggle(zoneFilter, opt.key, setZoneFilter)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Localidade */}
            <div className="gfb-group" style={{ position: 'relative' }} ref={bairroRef}>
              <span className="gfb-label">Localidade</span>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="gfb-input"
                  placeholder="Buscar bairro ou zona rural..."
                  value={bairroSearch}
                  onChange={(e) => {
                    setBairroSearch(e.target.value);
                    setShowBairroDropdown(true);
                  }}
                  onFocus={() => setShowBairroDropdown(true)}
                />
                {bairroSearch && (
                  <button
                    type="button"
                    className="gfb-input-clear"
                    onClick={() => setBairroSearch('')}
                    aria-label="Limpar busca"
                  >
                    ×
                  </button>
                )}
                {showBairroDropdown && (
                  <div className="gfb-dropdown">
                    <div className="gfb-dropdown-list">
                      {filteredBairros.map((b) => (
                        <button
                          key={b.name}
                          className={`gfb-dropdown-item ${bairroFilter.includes(b.name) ? 'active' : ''}`}
                          onClick={() => toggle(bairroFilter, b.name, setBairroFilter)}
                        >
                          {b.name} <small style={{ opacity: 0.6 }}>({b.count})</small>
                        </button>
                      ))}
                      {filteredBairros.length === 0 && (
                        <p className="gfb-dropdown-empty">Nenhuma localidade encontrada</p>
                      )}
                    </div>
                    <button
                      className="gfb-dropdown-close"
                      onClick={() => setShowBairroDropdown(false)}
                    >
                      Concluído
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Unidade */}
            <div className="gfb-group" style={{ position: 'relative' }} ref={unitRef}>
              <span className="gfb-label">Unidade</span>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="gfb-input"
                  placeholder="Buscar unidade..."
                  value={unitSearch}
                  onChange={(e) => {
                    setUnitSearch(e.target.value);
                    setShowUnitDropdown(true);
                  }}
                  onFocus={() => setShowUnitDropdown(true)}
                />
                {unitSearch && (
                  <button
                    type="button"
                    className="gfb-input-clear"
                    onClick={() => setUnitSearch('')}
                    aria-label="Limpar busca"
                  >
                    ×
                  </button>
                )}
                {showUnitDropdown && (
                  <div className="gfb-dropdown" style={{ width: '320px' }}>
                    <div className="gfb-dropdown-list">
                      {filteredUnits.map((u) => (
                        <button
                          key={u.id_unidade}
                          className={`gfb-dropdown-item ${unitFilter.includes(u.id_unidade) ? 'active' : ''}`}
                          onClick={() => toggle(unitFilter, u.id_unidade, setUnitFilter)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                            padding: '8px 12px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              textAlign: 'left',
                            }}
                          >
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              {u.nome_fantasia}
                            </span>
                            {u.municipio && u.uf && (
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                {u.municipio} - {u.uf} (CNES: {u.id_unidade})
                              </span>
                            )}
                          </div>
                          <small style={{ opacity: 0.6, marginLeft: '8px' }}>({u.count})</small>
                        </button>
                      ))}
                      {filteredUnits.length === 0 && (
                        <p className="gfb-dropdown-empty">Nenhuma unidade encontrada</p>
                      )}
                    </div>
                    <button
                      className="gfb-dropdown-close"
                      onClick={() => setShowUnitDropdown(false)}
                    >
                      Concluído
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Ocupação */}
            <div className="gfb-group" style={{ position: 'relative' }} ref={occRef}>
              <span className="gfb-label">Ocupação</span>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="gfb-input"
                  placeholder="Buscar ocupação..."
                  value={occSearch}
                  onChange={(e) => {
                    setOccSearch(e.target.value);
                    setShowOccDropdown(true);
                  }}
                  onFocus={() => setShowOccDropdown(true)}
                />
                {occSearch && (
                  <button
                    type="button"
                    className="gfb-input-clear"
                    onClick={() => setOccSearch('')}
                    aria-label="Limpar busca"
                  >
                    ×
                  </button>
                )}
                {showOccDropdown && (
                  <div className="gfb-dropdown">
                    <div className="gfb-dropdown-list">
                      {filteredOccupations.map((occ) => (
                        <button
                          key={occ}
                          className={`gfb-dropdown-item ${occupationFilter.includes(occ) ? 'active' : ''}`}
                          onClick={() => toggle(occupationFilter, occ, setOccupationFilter)}
                        >
                          {occ}
                        </button>
                      ))}
                      {filteredOccupations.length === 0 && (
                        <p className="gfb-dropdown-empty">Nenhuma ocupação encontrada</p>
                      )}
                    </div>
                    <button
                      className="gfb-dropdown-close"
                      onClick={() => setShowOccDropdown(false)}
                    >
                      Concluído
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {totalActive > 0 && (
          <div className="gfb-chips" style={{ marginTop: isCollapsed ? '0.5rem' : '0' }}>
            {activeFilters.map((f) => (
              <div key={`${f.type}-${f.val}`} className="gfb-chip">
                <span className="gfb-chip-type">{f.type}:</span>
                <strong>{f.val}</strong>
                <button onClick={f.remover} className="gfb-chip-close">
                  <svg viewBox="0 0 14 14" width="10" height="10">
                    <path
                      d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            ))}
            <button onClick={clearAllFilters} className="gfb-clear-all">
              Limpar tudo
            </button>
          </div>
        )}
      </div>
    </article>
  );
};

export default GlobalFilterBar;
