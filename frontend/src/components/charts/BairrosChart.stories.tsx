import type { Meta, StoryObj } from '@storybook/react';
import BairrosChart from './BairrosChart';

const meta: Meta<typeof BairrosChart> = {
  title: 'Charts/BairrosChart',
  component: BairrosChart,
  args: {
    data: [
      { bairro: 'Centro', count: 140 },
      { bairro: 'Santo Antônio', count: 110 },
      { bairro: 'Nova Betânia', count: 87 },
      { bairro: 'Boa Vista', count: 65 },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof BairrosChart>;

export const Default: Story = {};
