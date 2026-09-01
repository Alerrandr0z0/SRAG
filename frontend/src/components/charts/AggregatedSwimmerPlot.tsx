import React, { useMemo, useState } from 'react';
import { useThemeMode } from '../../hooks/useThemeMode';
import { AggregatedTimeline } from '../../types/epi';

type GripeStatus = 'protegido' | 'vencida' | 'nao_vacinado' | 'ignorado' | 'inconsistencia';

export interface EnrichedTimeline extends AggregatedTimeline {
  gripe_status?: GripeStatus;
  internP25: number;
  internP75: number;
  desfP25: number;
  desfP75: number;
  doseP25?: number | null;
  doseP75?: number | null;
  n: number;
  uti_pct: number;
}

interface AggregatedSwimmerPlotProps {
  data: EnrichedTimeline[];
  swimmerVirus?: 'covid' | 'gripe';
}

const PERFIL_LABELS: Record<string, string> = {
  bivalente: 'Bivalente',
  reforco_2: '2º Reforço',
  reforco_1: '1º Reforço',
  completo: 'Esquema Completo',
  dose_1: 'Dose 1',
  nao_vacinado: 'Não Vacinado',
  ignorado: 'Ignorado',
};

const perfilLabel = (raw: string): string => PERFIL_LABELS[raw] ?? raw;

const getUtiBadgeColor = (pct: number): { bg: string; text: string; label: string } => {
  if (pct >= 50) return { bg: 'rgba(220, 38, 38, 0.15)', text: '#dc2626', label: 'Crítico' };
  if (pct >= 40) return { bg: 'rgba(217, 119, 6, 0.15)', text: '#d97706', label: 'Atenção' };
  return { bg: 'rgba(15, 118, 110, 0.15)', text: '#0f766e', label: 'Adequado' };
};

type SortField = 'perfil' | 'dose' | 'jornada' | 'uti' | 'desfecho';
type SortOrder = 'asc' | 'desc';

const MilestoneFlowPlot: React.FC<AggregatedSwimmerPlotProps> = ({
  data,
  swimmerVirus = 'gripe',
}) => {
  const theme = useThemeMode();
  const isDark = theme === 'dark';
  const [hoveredPerfil, setHoveredPerfil] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('perfil');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'perfil' ? 'asc' : 'desc');
    }
  };

  const themeColors = useMemo(
    () => ({
      bg: isDark ? '#1e293b' : '#ffffff',
      panel: isDark ? '#0f172a' : '#f8fafc',
      border: isDark ? '#334155' : '#e2e8f0',
      text: isDark ? '#94a3b8' : '#64748b',
      main: isDark ? '#f8fafc' : '#0f172a',
      stripeEven: isDark ? '#1e293b' : '#ffffff',
      stripeOdd: isDark ? '#0f172a' : '#f8fafc',
      symptomBar: '#3b82f6', // Azul - Fase 1: Sintomas -> Internação
      hospBar: '#0f766e', // Teal - Fase 2: Internação -> Desfecho
      cureBar: '#0f766e',
      deathBar: '#dc2626',
    }),
    [isDark],
  );

  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const orderMap: Record<string, number> = {
      bivalente: 1,
      reforco_2: 2,
      reforco_1: 3,
      completo: 4,
      dose_1: 5,
      nao_vacinado: 6,
      ignorado: 7,
    };

    const copy = [...data];
    copy.sort((a, b) => {
      let result = 0;
      if (sortField === 'perfil') {
        result = (orderMap[a.perfil] ?? 99) - (orderMap[b.perfil] ?? 99);
      } else if (sortField === 'dose') {
        const valA = a.mediana_dose_sintoma ?? Number.NEGATIVE_INFINITY;
        const valB = b.mediana_dose_sintoma ?? Number.NEGATIVE_INFINITY;
        result = valA - valB;
      } else if (sortField === 'jornada') {
        const totalA = (a.mediana_sintoma_internacao ?? 0) + (a.mediana_internacao_desfecho ?? 0);
        const totalB = (b.mediana_sintoma_internacao ?? 0) + (b.mediana_internacao_desfecho ?? 0);
        result = totalA - totalB;
      } else if (sortField === 'uti') {
        result = (a.uti_pct ?? 0) - (b.uti_pct ?? 0);
      } else if (sortField === 'desfecho') {
        result = (a.taxa_obito ?? 0) - (b.taxa_obito ?? 0);
      }
      return sortOrder === 'asc' ? result : -result;
    });
    return copy;
  }, [data, sortField, sortOrder]);

  // Eixo dinâmico baseado exatamente no maior valor acumulado da coorte ativa (100% da largura)
  const maxStay = useMemo(() => {
    if (!sortedData.length) return 1;
    const maxes = sortedData.map(
      (d) => (d.mediana_sintoma_internacao ?? 0) + (d.mediana_internacao_desfecho ?? 0),
    );
    return Math.max(...maxes, 1);
  }, [sortedData]);

  if (!sortedData.length) {
    return (
      <div
        style={{
          margin: '16px 0',
          padding: '28px 16px',
          textAlign: 'center',
          color: themeColors.text,
          fontSize: '13px',
          background: themeColors.panel,
          border: `1px dashed ${themeColors.border}`,
          borderRadius: '12px',
        }}
      >
        <div style={{ fontWeight: 600, color: themeColors.main, marginBottom: 6 }}>
          Sem coortes para exibir.
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          {swimmerVirus === 'covid'
            ? 'Nenhum caso de COVID-19 com histórico vacinal registrado para os filtros atuais.'
            : 'Nenhum caso de Influenza com status vacinal (≤365d da campanha) para os filtros atuais.'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div
        style={{
          minWidth: '760px',
          border: `1px solid ${themeColors.border}`,
          borderRadius: '12px',
          background: themeColors.bg,
          boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Table Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '180px 130px 1fr 110px 150px',
            padding: '12px 16px',
            background: themeColors.panel,
            borderBottom: `1px solid ${themeColors.border}`,
            fontSize: '11px',
            fontWeight: 700,
            color: themeColors.text,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => handleSort('perfil')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              color: sortField === 'perfil' ? themeColors.main : themeColors.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              textAlign: 'left',
            }}
          >
            Perfil Vacinal
            <span style={{ fontSize: '10px', opacity: sortField === 'perfil' ? 1 : 0.4 }}>
              {sortField === 'perfil' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSort('dose')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              color: sortField === 'dose' ? themeColors.main : themeColors.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              textAlign: 'left',
            }}
          >
            Última Dose
            <span style={{ fontSize: '10px', opacity: sortField === 'dose' ? 1 : 0.4 }}>
              {sortField === 'dose' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSort('jornada')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              color: sortField === 'jornada' ? themeColors.main : themeColors.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              textAlign: 'left',
            }}
          >
            Jornada Clínica (Sintoma → Desfecho)
            <span style={{ fontSize: '10px', opacity: sortField === 'jornada' ? 1 : 0.4 }}>
              {sortField === 'jornada' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSort('uti')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              color: sortField === 'uti' ? themeColors.main : themeColors.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              width: '100%',
            }}
          >
            Admissão UTI
            <span style={{ fontSize: '10px', opacity: sortField === 'uti' ? 1 : 0.4 }}>
              {sortField === 'uti' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSort('desfecho')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              color: sortField === 'desfecho' ? themeColors.main : themeColors.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '4px',
              width: '100%',
            }}
          >
            Desfecho (Cura / Óbito)
            <span style={{ fontSize: '10px', opacity: sortField === 'desfecho' ? 1 : 0.4 }}>
              {sortField === 'desfecho' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
            </span>
          </button>
        </div>

        {/* Rows */}
        <div>
          {sortedData.map((row, idx) => {
            const isEven = idx % 2 === 0;
            const utiBadge = getUtiBadgeColor(row.uti_pct);

            const symptomDays = row.mediana_sintoma_internacao ?? 0;
            const hospDays = row.mediana_internacao_desfecho ?? 0;
            const totalDays = symptomDays + hospDays;

            const curaPct = (row.taxa_cura ?? 0) * 100;
            const obitoPct = (row.taxa_obito ?? 0) * 100;

            const doseDays = row.mediana_dose_sintoma;
            const doseText = doseDays != null ? `${Math.abs(doseDays).toFixed(0)}d antes` : '—';
            const isHovered = hoveredPerfil === row.perfil;

            return (
              <div
                key={row.perfil}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '180px 130px 1fr 110px 150px',
                  padding: '14px 16px',
                  background: isHovered
                    ? isDark
                      ? 'rgba(30, 41, 59, 0.9)'
                      : 'rgba(241, 245, 249, 0.9)'
                    : isEven
                      ? themeColors.stripeEven
                      : themeColors.stripeOdd,
                  borderBottom:
                    idx === sortedData.length - 1 ? 'none' : `1px solid ${themeColors.border}`,
                  alignItems: 'center',
                  fontSize: '12px',
                  transition: 'background 0.15s ease',
                }}
              >
                {/* 1. Perfil Vacinal */}
                <div>
                  <div style={{ fontWeight: 700, color: themeColors.main }}>
                    {perfilLabel(row.perfil)}
                  </div>
                  <div style={{ fontSize: '11px', color: themeColors.text, marginTop: '2px' }}>
                    N = <b>{row.n.toLocaleString('pt-BR')}</b> casos
                  </div>
                </div>

                {/* 2. Última Dose */}
                <div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-status)',
                      color: doseDays != null ? themeColors.main : themeColors.text,
                      border: `1px solid ${themeColors.border}`,
                    }}
                  >
                    {doseText}
                  </span>
                </div>

                {/* 3. Jornada Clínica — Linha de Marcos Encadeados T0 → T1 → T2 */}
                <div
                  style={{ paddingRight: '12px', position: 'relative' }}
                  onMouseEnter={() => setHoveredPerfil(row.perfil)}
                  onMouseLeave={() => setHoveredPerfil(null)}
                >
                  {(() => {
                    const t1Pct = Math.min(94, Math.max(12, (symptomDays / maxStay) * 100));
                    const t2Pct = Math.min(98, Math.max(t1Pct + 10, (totalDays / maxStay) * 100));
                    const seg1Width = Math.max(2, t1Pct);
                    const seg2Left = t1Pct;
                    const seg2Width = Math.max(2, t2Pct - t1Pct);
                    return (
                      <div
                        style={{
                          position: 'relative',
                          height: '64px',
                        }}
                      >
                        {/* Eixo de fundo (marcos ocupam 12px/13px, centro do eixo em y=30px) */}
                        <div
                          style={{
                            position: 'absolute',
                            left: '6px',
                            right: '6px',
                            top: '30px',
                            height: '2px',
                            background: themeColors.border,
                            borderRadius: '1px',
                          }}
                        />
                        {/* Segmento T0→T1 (pontilhado azul) */}
                        <div
                          style={{
                            position: 'absolute',
                            left: '6px',
                            width: `calc(${seg1Width}% - 6px)`,
                            top: '29px',
                            height: '4px',
                            background: `repeating-linear-gradient(90deg, ${themeColors.symptomBar} 0 6px, transparent 6px 10px)`,
                            borderRadius: '2px',
                          }}
                        />
                        {/* Segmento T1→T2 (sólido teal) */}
                        <div
                          style={{
                            position: 'absolute',
                            left: `calc(6px + ${seg2Left}% - 6px)`,
                            width: `${seg2Width}%`,
                            top: '28px',
                            height: '6px',
                            background: themeColors.hospBar,
                            borderRadius: '3px',
                            boxShadow: `0 1px 3px ${themeColors.hospBar}55`,
                          }}
                        />

                        {/* ACIMA DO EIXO (top: 0px): Rótulo de Internação com Badge +Texto e respiro livre */}
                        <div
                          style={{
                            position: 'absolute',
                            left: `calc(6px + ${t1Pct}% - 6px)`,
                            top: '0px',
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            whiteSpace: 'nowrap',
                            zIndex: 2,
                          }}
                        >
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 600,
                              color: themeColors.main,
                              lineHeight: '1.1',
                              marginBottom: '1px',
                            }}
                          >
                            Internação
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: themeColors.hospBar,
                              background: themeColors.bg,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              border: `1px solid ${themeColors.border}`,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                              lineHeight: '1.2',
                            }}
                          >
                            {symptomDays.toFixed(1)}d
                          </span>
                        </div>

                        {/* NO EIXO (top: 24px / 25px): Ícones dos Marcos */}
                        {/* T0 (círculo azul alinhado no centro de x=6px, centro visual 0d) */}
                        <span
                          style={{
                            position: 'absolute',
                            left: '0px',
                            top: '24px',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: themeColors.symptomBar,
                            border: `2px solid ${themeColors.bg}`,
                            boxShadow: `0 0 0 2px ${themeColors.symptomBar}`,
                            display: 'block',
                          }}
                        />

                        {/* T1 (quadrado teal em t1Pct) */}
                        <span
                          style={{
                            position: 'absolute',
                            left: `calc(6px + ${t1Pct}% - 6px)`,
                            top: '24px',
                            transform: 'translateX(-50%)',
                            width: '13px',
                            height: '13px',
                            borderRadius: '3px',
                            background: themeColors.hospBar,
                            border: `2px solid ${themeColors.bg}`,
                            boxShadow: `0 0 0 2px ${themeColors.hospBar}`,
                            display: 'block',
                          }}
                        />

                        {/* T2 (círculo desfecho em t2Pct) */}
                        <span
                          style={{
                            position: 'absolute',
                            left: `calc(6px + ${t2Pct}% - 6px)`,
                            top: '24px',
                            transform: 'translateX(-50%)',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background:
                              curaPct >= obitoPct ? themeColors.cureBar : themeColors.deathBar,
                            border: `2px solid ${themeColors.bg}`,
                            boxShadow: `0 0 0 2px ${
                              curaPct >= obitoPct ? themeColors.cureBar : themeColors.deathBar
                            }`,
                            display: 'block',
                          }}
                        />

                        {/* ABAIXO DO EIXO (top: 40px): Rótulos inferiores sem colisão */}
                        {/* Rótulo T0 (Sintomas) */}
                        <div
                          style={{
                            position: 'absolute',
                            left: '0px',
                            top: '40px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              color: themeColors.symptomBar,
                              lineHeight: '1.1',
                            }}
                          >
                            T0
                          </span>
                          <span
                            style={{ fontSize: '8px', color: themeColors.text, lineHeight: '1.1' }}
                          >
                            Sintoma
                          </span>
                        </div>

                        {/* Rótulo T2 (Desfecho) */}
                        <div
                          style={{
                            position: 'absolute',
                            left: `calc(6px + ${t2Pct}% - 6px)`,
                            top: '40px',
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              color: themeColors.main,
                              lineHeight: '1.1',
                            }}
                          >
                            {totalDays.toFixed(1)}d total
                          </span>
                          <span
                            style={{ fontSize: '8px', color: themeColors.text, lineHeight: '1.1' }}
                          >
                            Desfecho
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Escala do Eixo — Apenas o label final (ex: 24d) */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      fontSize: '8.5px',
                      color: themeColors.text,
                      marginTop: '1px',
                      paddingRight: '2px',
                    }}
                  >
                    <span>{maxStay}d</span>
                  </div>

                  {/* Popover Tooltip Elegante no Hover */}
                  {isHovered && (
                    <div
                      style={{
                        position: 'absolute',
                        left: idx === 0 ? '60%' : '50%',
                        top: idx === 0 ? '100%' : 'auto',
                        bottom: idx === 0 ? 'auto' : '100%',
                        transform: 'translateX(-50%)',
                        marginTop: idx === 0 ? '8px' : '0px',
                        marginBottom: idx === 0 ? '0px' : '8px',
                        width: '280px',
                        background: themeColors.bg,
                        border: `1px solid ${themeColors.border}`,
                        borderRadius: '10px',
                        padding: '12px 14px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.15)',
                        zIndex: 200,
                        pointerEvents: 'none',
                        fontSize: '11px',
                        lineHeight: '1.4',
                      }}
                    >
                      {/* Header do Popover */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: `1px solid ${themeColors.border}`,
                          paddingBottom: '6px',
                          marginBottom: '8px',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: themeColors.main, fontSize: '12px' }}>
                          {perfilLabel(row.perfil)}
                        </span>
                        <span style={{ color: themeColors.text, fontSize: '10px' }}>
                          N = <b>{row.n.toLocaleString('pt-BR')}</b> casos
                        </span>
                      </div>

                      {/* Marcos Temporais */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: themeColors.symptomBar, fontWeight: 600 }}>
                            ● T0 (Primeiros Sintomas)
                          </span>
                          <span style={{ fontWeight: 700, color: themeColors.main }}>Dia 0</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: themeColors.hospBar, fontWeight: 600 }}>
                            ■ T1 (Internação Hospitalar)
                          </span>
                          <span style={{ fontWeight: 700, color: themeColors.hospBar }}>
                            {symptomDays.toFixed(1)}d
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: themeColors.text, fontWeight: 600 }}>
                            ● T2 (Permanência / Alta)
                          </span>
                          <span style={{ fontWeight: 700, color: themeColors.main }}>
                            +{hospDays.toFixed(1)}d ({totalDays.toFixed(1)}d total)
                          </span>
                        </div>
                      </div>

                      {/* Divisor */}
                      <div style={{ borderTop: `1px dashed ${themeColors.border}`, paddingTop: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ color: themeColors.text }}>Admissão UTI:</span>
                          <span
                            style={{
                              fontWeight: 700,
                              color: utiBadge.text,
                              background: utiBadge.bg,
                              padding: '1px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {row.uti_pct}% UTI
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: themeColors.text }}>Desfechos:</span>
                          <span>
                            <b style={{ color: themeColors.cureBar }}>Cura {curaPct.toFixed(0)}%</b>
                            {' · '}
                            <b style={{ color: themeColors.deathBar }}>Óbito {obitoPct.toFixed(0)}%</b>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Admissão UTI */}
                <div style={{ textAlign: 'center' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: utiBadge.bg,
                      color: utiBadge.text,
                      display: 'inline-block',
                    }}
                  >
                    {row.uti_pct}% UTI
                  </span>
                </div>

                {/* 5. Desfecho (Cura vs Óbito) */}
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '8px',
                      marginBottom: '4px',
                      fontSize: '11px',
                    }}
                  >
                    <span style={{ color: themeColors.cureBar, fontWeight: 700 }}>
                      Cura {curaPct.toFixed(0)}%
                    </span>
                    <span style={{ color: themeColors.text }}>|</span>
                    <span style={{ color: themeColors.deathBar, fontWeight: 700 }}>
                      Óbito {obitoPct.toFixed(0)}%
                    </span>
                  </div>
                  {/* Mini barra empilhada Cura x Óbito */}
                  <div
                    style={{
                      height: '6px',
                      width: '100%',
                      borderRadius: '3px',
                      overflow: 'hidden',
                      display: 'flex',
                      background: 'var(--bg-status)',
                    }}
                  >
                    <div style={{ width: `${curaPct}%`, background: themeColors.cureBar }} />
                    <div style={{ width: `${obitoPct}%`, background: themeColors.deathBar }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MilestoneFlowPlot;
