import type { Meta, StoryObj } from '@storybook/react';
import AggregatedSwimmerPlot, { type EnrichedTimeline } from './AggregatedSwimmerPlot';

const data: EnrichedTimeline[] = [
  {
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
  },
  {
    perfil: 'reforco_1',
    gripe_status: 'vencida',
    status_key: 'reforco_1',
    severity_score: 2,
    count: 86,
    internP25: 3,
    internP75: 7,
    desfP25: 8,
    desfP75: 14,
    doseP25: -130,
    doseP75: -90,
    n: 86,
    uti_pct: 32,
    mediana_dose_sintoma: -110,
    mediana_sintoma_internacao: 5,
    mediana_internacao_desfecho: 10,
    taxa_cura: 0.78,
    taxa_obito: 0.22,
  },
  {
    perfil: 'nao_vacinado',
    gripe_status: 'nao_vacinado',
    status_key: 'nao_vacinado',
    severity_score: 3,
    count: 54,
    internP25: 5,
    internP75: 11,
    desfP25: 12,
    desfP75: 20,
    n: 54,
    uti_pct: 41,
    mediana_dose_sintoma: null,
    mediana_sintoma_internacao: 8,
    mediana_internacao_desfecho: 15,
    taxa_cura: 0.54,
    taxa_obito: 0.46,
  },
];

const meta: Meta<typeof AggregatedSwimmerPlot> = {
  title: 'Charts/AggregatedSwimmerPlot',
  component: AggregatedSwimmerPlot,
  args: {
    data,
  },
};

export default meta;

type Story = StoryObj<typeof AggregatedSwimmerPlot>;

export const Default: Story = {};
