import type { Meta, StoryObj } from '@storybook/react';
import PiramideEtariaChart from './PiramideEtariaChart';

const meta: Meta<typeof PiramideEtariaChart> = {
  title: 'Charts/PiramideEtariaChart',
  component: PiramideEtariaChart,
  args: {
    data: [
      { age_band: '0-9', male: 20, female: 18 },
      { age_band: '10-19', male: 24, female: 22 },
      { age_band: '20-39', male: 48, female: 61 },
      { age_band: '40-59', male: 39, female: 44 },
      { age_band: '60+', male: 18, female: 27 },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof PiramideEtariaChart>;

export const Default: Story = {};
