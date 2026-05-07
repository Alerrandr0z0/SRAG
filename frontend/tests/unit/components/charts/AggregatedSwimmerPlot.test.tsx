import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AggregatedSwimmerPlot, { type EnrichedTimeline } from '../../../../src/components/charts/AggregatedSwimmerPlot';

describe('AggregatedSwimmerPlot — component', () => {
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

  describe('caption and legends', () => {
    it('renders the chart caption and legends', () => {
      render(<AggregatedSwimmerPlot data={[baseData]} debug />);

      expect(screen.getByText(/Mediana de tempo entre eventos/)).toBeInTheDocument();
      expect(screen.getByText('Marcadores')).toBeInTheDocument();
      expect(screen.getByText('Status vacinal da gripe')).toBeInTheDocument();
      expect(screen.getByText('Bivalente')).toBeInTheDocument();
    });

    it('renders all MARKER_LEGEND items', () => {
      render(<AggregatedSwimmerPlot data={[baseData]} debug />);
      const markers = ['Última dose', 'Internação', 'Cura predominante', 'Óbito predominante', 'Pré-sintoma', 'Banda IQR'];
      markers.forEach(label => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('renders all GRIPE_LEGEND items', () => {
      render(<AggregatedSwimmerPlot data={[baseData]} debug />);
      const statuses = ['Protegida', 'Vencida', 'Não vacinada', 'Ignorado'];
      statuses.forEach(label => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows "Sem coortes para exibir" when data is empty', () => {
      render(<AggregatedSwimmerPlot data={[]} />);
      expect(screen.getByText('Sem coortes para exibir.')).toBeInTheDocument();
    });

    it('hides legends when data is empty', () => {
      render(<AggregatedSwimmerPlot data={[]} />);
      expect(screen.queryByText('Marcadores')).not.toBeInTheDocument();
      expect(screen.queryByText('Status vacinal da gripe')).not.toBeInTheDocument();
    });
  });

  describe('obito divider', () => {
    it('shows divider labels when obito and cura cohorts coexist', () => {
      render(<AggregatedSwimmerPlot data={[obitoData, baseData]} />);
      expect(screen.getByText('ÓBITO PREDOMINANTE')).toBeInTheDocument();
      expect(screen.getByText('CURA PREDOMINANTE')).toBeInTheDocument();
    });

    it('hides divider when only cura cohorts', () => {
      render(<AggregatedSwimmerPlot data={[baseData]} />);
      expect(screen.queryByText('ÓBITO PREDOMINANTE')).not.toBeInTheDocument();
      expect(screen.queryByText('CURA PREDOMINANTE')).not.toBeInTheDocument();
    });

    it('hides divider when only obito cohorts', () => {
      render(<AggregatedSwimmerPlot data={[obitoData]} />);
      expect(screen.queryByText('ÓBITO PREDOMINANTE')).not.toBeInTheDocument();
      expect(screen.queryByText('CURA PREDOMINANTE')).not.toBeInTheDocument();
    });
  });

  describe('data with null dose', () => {
    it('renders row without dose marker when mediana_dose_sintoma is null', () => {
      render(<AggregatedSwimmerPlot data={[{ ...baseData, mediana_dose_sintoma: null, doseP25: null, doseP75: null }]} />);
      expect(screen.getByText('Bivalente')).toBeInTheDocument();
    });
  });

  describe('uti color hint in footer', () => {
    it('renders the color hint text below grip legend', () => {
      render(<AggregatedSwimmerPlot data={[baseData]} />);
      expect(screen.getByText(/A cor da linha representa o status vacinal/)).toBeInTheDocument();
    });
  });

  describe('multiple cohorts', () => {
    it('renders SVG with two rows', () => {
      render(<AggregatedSwimmerPlot data={[obitoData, baseData]} />);
      const svg = document.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(screen.getByText('Não Vacinado')).toBeInTheDocument();
      expect(screen.getByText('Bivalente')).toBeInTheDocument();
    });

    it('shows correct UTI values per cohort', () => {
      render(<AggregatedSwimmerPlot data={[obitoData, baseData]} />);
      expect(screen.getByText(/UTI 45%/)).toBeInTheDocument();
      expect(screen.getByText(/UTI 18%/)).toBeInTheDocument();
    });
  });
});
