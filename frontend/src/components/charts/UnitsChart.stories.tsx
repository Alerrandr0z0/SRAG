import type { Meta, StoryObj } from '@storybook/react';
import UnitsChart from './UnitsChart';

const meta: Meta<typeof UnitsChart> = {
  title: 'Charts/UnitsChart',
  component: UnitsChart,
  args: {
    data: [
      { id_unidade: 'UPA Centro', count: 120 },
      { id_unidade: 'HMEP', count: 98 },
      { id_unidade: 'Maternidade', count: 76 },
      { id_unidade: 'Policlínica', count: 55 },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof UnitsChart>;

export const Default: Story = {};
