import type { Meta, StoryObj } from '@storybook/react';
import TrendChart from './TrendChart';

const meta: Meta<typeof TrendChart> = {
  title: 'Charts/TrendChart',
  component: TrendChart,
  args: {
    history: [
      { epi_week: '2024-W01', total: 120 },
      { epi_week: '2024-W02', total: 134 },
      { epi_week: '2024-W03', total: 128 },
      { epi_week: '2024-W04', total: 150 },
    ],
    forecast: [
      { epi_week: '2024-W05', predicted_cases: 145, predicted_cases_lower: 120, predicted_cases_upper: 168 },
      { epi_week: '2024-W06', predicted_cases: 138, predicted_cases_lower: 110, predicted_cases_upper: 160 },
    ],
    thresholds: { medium: 100, high: 140, very_high: 180 },
    composition: [],
    baseCumulative: 0,
    seriesMode: 'weekly',
  },
};

export default meta;

type Story = StoryObj<typeof TrendChart>;

export const Default: Story = {};
