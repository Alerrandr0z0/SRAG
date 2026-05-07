import type { Meta, StoryObj } from '@storybook/react';
import RiskFactorsChart from './RiskFactorsChart';

const meta: Meta<typeof RiskFactorsChart> = {
  title: 'Charts/RiskFactorsChart',
  component: RiskFactorsChart,
  args: {
    data: [
      { factor: 'Hipertensão', count: 120 },
      { factor: 'Diabetes', count: 94 },
      { factor: 'Obesidade', count: 78 },
      { factor: 'Tabagismo', count: 61 },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof RiskFactorsChart>;

export const Default: Story = {};
