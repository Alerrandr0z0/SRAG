import type { Meta, StoryObj } from '@storybook/react';
import SchoolingChart from './SchoolingChart';

const meta: Meta<typeof SchoolingChart> = {
  title: 'Charts/SchoolingChart',
  component: SchoolingChart,
  args: {
    data: [
      { label: 'Ensino Médio', count: 142 },
      { label: 'Fundamental Completo', count: 116 },
      { label: 'Superior', count: 58 },
      { label: 'Sem Escolaridade', count: 21 },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof SchoolingChart>;

export const Default: Story = {};
