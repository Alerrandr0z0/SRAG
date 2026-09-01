import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AggregatedSwimmerPlot, {
  type EnrichedTimeline,
} from '../../../../src/components/charts/AggregatedSwimmerPlot';

describe('AggregatedSwimmerPlot (Milestone Flow) — component', () => {
  const baseData: EnrichedTimeline = {
    perfil: 'bivalente',
    gripe_status: 'protegido',
    status_key: 'bivalente',
    severity_score: 1,
    count: 142,
    internP25: 2,
    internP75: 5,
    desfP25: 7,
    desfP75: 12,
    doseP25: -180,
    doseP75: -140,
    n: 142,
    uti_pct: 18,
    mediana_dose_sintoma: -160,
    mediana_sintoma_internacao: 4,
    mediana_internacao_desfecho: 8,
    taxa_cura: 0.92,
    taxa_obito: 0.08,
  };

  const obitoData: EnrichedTimeline = {
    ...baseData,
    perfil: 'nao_vacinado',
    gripe_status: 'nao_vacinado',
    status_key: 'nao_vacinado',
    severity_score: 5,
    count: 300,
    uti_pct: 45,
    mediana_dose_sintoma: null,
    taxa_cura: 0.12,
    taxa_obito: 0.88,
  };

  describe('table headers and content', () => {
    it('renders the table header columns', () => {
      render(<AggregatedSwimmerPlot data={[baseData]} />);

      expect(screen.getByText('Perfil Vacinal')).toBeInTheDocument();
      expect(screen.getByText('Última Dose')).toBeInTheDocument();
      expect(screen.getByText('Jornada Clínica (Sintoma → Desfecho)')).toBeInTheDocument();
      expect(screen.getByText('Admissão UTI')).toBeInTheDocument();
      expect(screen.getByText('Desfecho (Cura / Óbito)')).toBeInTheDocument();
      expect(screen.getByText('Bivalente')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows "Sem coortes para exibir" when data is empty', () => {
      render(<AggregatedSwimmerPlot data={[]} />);
      expect(screen.getByText('Sem coortes para exibir.')).toBeInTheDocument();
    });
  });

  describe('data with null dose', () => {
    it('renders row without dose marker when mediana_dose_sintoma is null', () => {
      render(
        <AggregatedSwimmerPlot
          data={[{ ...baseData, mediana_dose_sintoma: null }]}
        />,
      );
      expect(screen.getByText('Bivalente')).toBeInTheDocument();
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('multiple cohorts', () => {
    it('renders table with multiple rows', () => {
      render(<AggregatedSwimmerPlot data={[obitoData, baseData]} />);
      expect(screen.getByText('Não Vacinado')).toBeInTheDocument();
      expect(screen.getByText('Bivalente')).toBeInTheDocument();
    });

    it('shows correct UTI percentages per cohort', () => {
      render(<AggregatedSwimmerPlot data={[obitoData, baseData]} />);
      expect(screen.getByText('45% UTI')).toBeInTheDocument();
      expect(screen.getByText('18% UTI')).toBeInTheDocument();
    });
  });
});
