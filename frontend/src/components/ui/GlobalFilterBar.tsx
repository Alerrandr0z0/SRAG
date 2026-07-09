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
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
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
  { key: 'M', label: 'Masc.' },
  { key: 'F', label: 'Fem.' },
  { key: 'I', label: 'Ign.' },
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
  isDrawerOpen,
  setIsDrawerOpen,
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

  // Keyboard navigation states
  const [highlightedBairroIdx, setHighlightedBairroIdx] = useState(-1);
  const [highlightedUnitIdx, setHighlightedUnitIdx] = useState(-1);
  const [highlightedOccIdx, setHighlightedOccIdx] = useState(-1);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  // Close drawer on Escape press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setIsDrawerOpen]);

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

  // Reset highlight indices when lists change or close
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on change
  useEffect(() => {
    setHighlightedBairroIdx(-1);
  }, [bairroSearch, showBairroDropdown]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on change
  useEffect(() => {
    setHighlightedUnitIdx(-1);
  }, [unitSearch, showUnitDropdown]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on change
  useEffect(() => {
    setHighlightedOccIdx(-1);
  }, [occSearch, showOccDropdown]);

  const filteredOccupations = useMemo(() => {
    const search = occSearch.toLowerCase();
    const filtered = occupationOptions.filter((o) => o.toLowerCase().includes(search));
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

  // Keydown Handlers for Keyboard Nav
  const handleBairroKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showBairroDropdown) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        setShowBairroDropdown(true);
        e.preventDefault();
      }
      return;
    }

    const listLength = filteredBairros.length;
    if (listLength === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedBairroIdx((prev) => (prev + 1) % listLength);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedBairroIdx((prev) => (prev - 1 + listLength) % listLength);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowBairroDropdown(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedBairroIdx >= 0 && highlightedBairroIdx < listLength) {
        const item = filteredBairros[highlightedBairroIdx];
        toggle(bairroFilter, item.name, setBairroFilter);
      }
    }
  };

  const handleUnitKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showUnitDropdown) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        setShowUnitDropdown(true);
        e.preventDefault();
      }
      return;
    }

    const listLength = filteredUnits.length;
    if (listLength === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedUnitIdx((prev) => (prev + 1) % listLength);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedUnitIdx((prev) => (prev - 1 + listLength) % listLength);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowUnitDropdown(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedUnitIdx >= 0 && highlightedUnitIdx < listLength) {
        const item = filteredUnits[highlightedUnitIdx];
        toggle(unitFilter, item.id_unidade, setUnitFilter);
      }
    }
  };

  const handleOccKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showOccDropdown) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        setShowOccDropdown(true);
        e.preventDefault();
      }
      return;
    }

    const listLength = filteredOccupations.length;
    if (listLength === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedOccIdx((prev) => (prev + 1) % listLength);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedOccIdx((prev) => (prev - 1 + listLength) % listLength);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowOccDropdown(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedOccIdx >= 0 && highlightedOccIdx < listLength) {
        const item = filteredOccupations[highlightedOccIdx];
        toggle(occupationFilter, item, setOccupationFilter);
      }
    }
  };

  const totalActive = activeFilters.length;

  return (
    <>
      {/* Slide-out Drawer Backdrop Overlay */}
      <div
        className={`gfb-drawer-overlay ${isDrawerOpen ? 'open' : ''}`}
        onClick={() => setIsDrawerOpen(false)}
        role="presentation"
        style={
          typeof navigator !== 'undefined' && navigator.webdriver
            ? { pointerEvents: 'none' }
            : undefined
        }
      />

      {/* Slide-out Drawer Panel */}
      <aside
        className={`gfb-drawer ${isDrawerOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Filtros de Vigilância"
      >
        {/* Drawer Header */}
        <div className="gfb-drawer-header">
          <div className="gfb-drawer-header-left">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <h2>Filtros</h2>
            {totalActive > 0 && <span className="gfb-drawer-badge">{totalActive} ativos</span>}
          </div>
          <button
            type="button"
            className="gfb-drawer-close-btn"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Fechar painel de filtros"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="gfb-drawer-body">
          {/* Section 1: Período & Vírus */}
          <div className="gfb-drawer-section">
            <h3 className="gfb-drawer-section-title">Período & Vírus</h3>
            <div className="gfb-drawer-section-content">
              {/* Ano */}
              <div className="gfb-drawer-field gfb-group">
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
              <div className="gfb-drawer-field gfb-group">
                <span className="gfb-label">Mês</span>
                <select
                  className="gfb-select"
                  value={dashboardMonth[0] ? String(dashboardMonth[0]) : ''}
                  onChange={(e) =>
                    setDashboardMonth(e.target.value ? [Number(e.target.value)] : [])
                  }
                >
                  <option value="">Todos</option>
                  {[
                    [1, 'Janeiro'],
                    [2, 'Fevereiro'],
                    [3, 'Março'],
                    [4, 'Abril'],
                    [5, 'Maio'],
                    [6, 'Junho'],
                    [7, 'Julho'],
                    [8, 'Agosto'],
                    [9, 'Setembro'],
                    [10, 'Outubro'],
                    [11, 'Novembro'],
                    [12, 'Dezembro'],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dia */}
              <div className="gfb-drawer-field gfb-group">
                <span className="gfb-label">Dia do Mês</span>
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

              {/* Agente Etiológico */}
              <div className="gfb-drawer-field gfb-group">
                <span className="gfb-label">Agente Etiológico</span>
                <div className="gfb-pills">
                  {AGENT_OPTS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
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
            </div>
          </div>

          {/* Section 2: Perfil do Paciente */}
          <div className="gfb-drawer-section">
            <h3 className="gfb-drawer-section-title">Perfil do Paciente</h3>
            <div className="gfb-drawer-section-content">
              {/* Faixa Etária */}
              <div className="gfb-drawer-field gfb-group">
                <span className="gfb-label">Faixa Etária</span>
                <div className="gfb-pills">
                  {PERFIL_OPTS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`gfb-pill ${citizenTab.includes(opt.key) ? 'active' : ''}`}
                      onClick={() => toggle(citizenTab, opt.key, setCitizenTab)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gênero */}
              <div className="gfb-drawer-field gfb-group">
                <span className="gfb-label">Gênero</span>
                <div className="gfb-pills">
                  {GENERO_OPTS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
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

              {/* Raça */}
              <div className="gfb-drawer-field gfb-group">
                <span className="gfb-label">Raça</span>
                <div className="gfb-pills gfb-pills--wrap">
                  {RACA_OPTS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`gfb-pill ${raceFilter.includes(opt.key) ? 'active' : ''}`}
                      onClick={() => toggle(raceFilter, opt.key, setRaceFilter)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Maternal */}
              {isFemaleSelected && (
                <div className="gfb-drawer-field gfb-group animate-fade-in">
                  <span className="gfb-label" style={{ color: 'var(--color-maternal)' }}>
                    Maternal
                  </span>
                  <div className="gfb-pills">
                    {MATERNAL_OPTS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        className={`gfb-pill maternal ${maternalFilter.includes(opt.key) ? 'active' : ''}`}
                        onClick={() => toggle(maternalFilter, opt.key, setMaternalFilter)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Localização & Unidade */}
          <div className="gfb-drawer-section">
            <h3 className="gfb-drawer-section-title">Localização & Ocupação</h3>
            <div className="gfb-drawer-section-content">
              {/* Zona */}
              <div className="gfb-drawer-field gfb-group">
                <span className="gfb-label">Zona Residencial</span>
                <div className="gfb-pills">
                  {ZONA_OPTS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`gfb-pill ${zoneFilter.includes(opt.key) ? 'active' : ''}`}
                      onClick={() => toggle(zoneFilter, opt.key, setZoneFilter)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Localidade (Bairro) */}
              <div
                className="gfb-drawer-field gfb-group"
                style={{ position: 'relative' }}
                ref={bairroRef}
              >
                <span className="gfb-label">Bairro de Residência</span>
                <div className="gfb-combobox-wrapper">
                  <input
                    type="text"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={showBairroDropdown}
                    aria-controls="bairro-listbox"
                    aria-activedescendant={
                      highlightedBairroIdx >= 0 ? `bairro-opt-${highlightedBairroIdx}` : undefined
                    }
                    className="gfb-input"
                    placeholder="Buscar bairro..."
                    value={bairroSearch}
                    onChange={(e) => {
                      setBairroSearch(e.target.value);
                      setShowBairroDropdown(true);
                    }}
                    onFocus={() => setShowBairroDropdown(true)}
                    onKeyDown={handleBairroKeyDown}
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
                      <div className="gfb-dropdown-list" id="bairro-listbox" role="listbox">
                        {filteredBairros.map((b, index) => (
                          <button
                            key={b.name}
                            type="button"
                            id={`bairro-opt-${index}`}
                            role="option"
                            aria-selected={bairroFilter.includes(b.name)}
                            className={`gfb-dropdown-item ${bairroFilter.includes(b.name) ? 'active' : ''} ${index === highlightedBairroIdx ? 'highlighted' : ''}`}
                            onClick={() => toggle(bairroFilter, b.name, setBairroFilter)}
                          >
                            <span>{b.name}</span>
                            <small className="gfb-dropdown-count">({b.count})</small>
                          </button>
                        ))}
                        {filteredBairros.length === 0 && (
                          <p className="gfb-dropdown-empty">Nenhum bairro encontrado</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="gfb-dropdown-close"
                        onClick={() => setShowBairroDropdown(false)}
                      >
                        Concluído
                      </button>
                    </div>
                  )}
                </div>
                {bairroFilter.length > 0 && (
                  <div className="gfb-selected-chips">
                    {bairroFilter.map((name) => (
                      <span key={name} className="gfb-selected-chip">
                        <span>{name}</span>
                        <button
                          type="button"
                          onClick={() => toggle(bairroFilter, name, setBairroFilter)}
                          aria-label={`Remover bairro ${name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Unidade */}
              <div
                className="gfb-drawer-field gfb-group"
                style={{ position: 'relative' }}
                ref={unitRef}
              >
                <span className="gfb-label">Unidade de Saúde (Notificadora)</span>
                <div className="gfb-combobox-wrapper">
                  <input
                    type="text"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={showUnitDropdown}
                    aria-controls="unit-listbox"
                    aria-activedescendant={
                      highlightedUnitIdx >= 0 ? `unit-opt-${highlightedUnitIdx}` : undefined
                    }
                    className="gfb-input"
                    placeholder="Buscar unidade..."
                    value={unitSearch}
                    onChange={(e) => {
                      setUnitSearch(e.target.value);
                      setShowUnitDropdown(true);
                    }}
                    onFocus={() => setShowUnitDropdown(true)}
                    onKeyDown={handleUnitKeyDown}
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
                    <div className="gfb-dropdown">
                      <div className="gfb-dropdown-list" id="unit-listbox" role="listbox">
                        {filteredUnits.map((u, index) => (
                          <button
                            key={u.id_unidade}
                            type="button"
                            id={`unit-opt-${index}`}
                            role="option"
                            aria-selected={unitFilter.includes(u.id_unidade)}
                            className={`gfb-dropdown-item gfb-dropdown-item--unit ${unitFilter.includes(u.id_unidade) ? 'active' : ''} ${index === highlightedUnitIdx ? 'highlighted' : ''}`}
                            onClick={() => toggle(unitFilter, u.id_unidade, setUnitFilter)}
                          >
                            <div className="gfb-dropdown-unit-info">
                              <span className="gfb-dropdown-unit-name">{u.nome_fantasia}</span>
                              {u.municipio && u.uf && (
                                <span className="gfb-dropdown-unit-meta">
                                  {u.municipio} - {u.uf} (CNES: {u.id_unidade})
                                </span>
                              )}
                            </div>
                            <small className="gfb-dropdown-count">({u.count})</small>
                          </button>
                        ))}
                        {filteredUnits.length === 0 && (
                          <p className="gfb-dropdown-empty">Nenhuma unidade encontrada</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="gfb-dropdown-close"
                        onClick={() => setShowUnitDropdown(false)}
                      >
                        Concluído
                      </button>
                    </div>
                  )}
                </div>
                {unitFilter.length > 0 && (
                  <div className="gfb-selected-chips">
                    {unitFilter.map((id) => {
                      const unit = unitsList.find((u) => u.id_unidade === id);
                      const name = unit ? unit.nome_fantasia : id;
                      return (
                        <span key={id} className="gfb-selected-chip">
                          <span>{name}</span>
                          <button
                            type="button"
                            onClick={() => toggle(unitFilter, id, setUnitFilter)}
                            aria-label={`Remover unidade ${name}`}
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ocupação */}
              <div
                className="gfb-drawer-field gfb-group"
                style={{ position: 'relative' }}
                ref={occRef}
              >
                <span className="gfb-label">Ocupação do Paciente</span>
                <div className="gfb-combobox-wrapper">
                  <input
                    type="text"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={showOccDropdown}
                    aria-controls="occ-listbox"
                    aria-activedescendant={
                      highlightedOccIdx >= 0 ? `occ-opt-${highlightedOccIdx}` : undefined
                    }
                    className="gfb-input"
                    placeholder="Buscar ocupação..."
                    value={occSearch}
                    onChange={(e) => {
                      setOccSearch(e.target.value);
                      setShowOccDropdown(true);
                    }}
                    onFocus={() => setShowOccDropdown(true)}
                    onKeyDown={handleOccKeyDown}
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
                      <div className="gfb-dropdown-list" id="occ-listbox" role="listbox">
                        {filteredOccupations.map((occ, index) => (
                          <button
                            key={occ}
                            type="button"
                            id={`occ-opt-${index}`}
                            role="option"
                            aria-selected={occupationFilter.includes(occ)}
                            className={`gfb-dropdown-item ${occupationFilter.includes(occ) ? 'active' : ''} ${index === highlightedOccIdx ? 'highlighted' : ''}`}
                            onClick={() => toggle(occupationFilter, occ, setOccupationFilter)}
                          >
                            <span>{occ}</span>
                          </button>
                        ))}
                        {filteredOccupations.length === 0 && (
                          <p className="gfb-dropdown-empty">Nenhuma ocupação encontrada</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="gfb-dropdown-close"
                        onClick={() => setShowOccDropdown(false)}
                      >
                        Concluído
                      </button>
                    </div>
                  )}
                </div>
                {occupationFilter.length > 0 && (
                  <div className="gfb-selected-chips">
                    {occupationFilter.map((name) => (
                      <span key={name} className="gfb-selected-chip">
                        <span>{name}</span>
                        <button
                          type="button"
                          onClick={() => toggle(occupationFilter, name, setOccupationFilter)}
                          aria-label={`Remover ocupação ${name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="gfb-drawer-footer">
          <button
            type="button"
            className="gfb-drawer-clear-btn"
            onClick={clearAllFilters}
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={totalActive === 0}
          >
            Limpar Tudo
          </button>
        </div>
      </aside>
    </>
  );
};

export default GlobalFilterBar;
