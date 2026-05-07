import type { Meta, StoryObj } from '@storybook/react';
import LabChart from './LabChart';

const meta: Meta<typeof LabChart> = {
  title: 'Charts/LabChart',
  component: LabChart,
  args: {
    data: [
      { lab_ref: 'LACEN', tested_cases: 420, positive_count: 96, positive_rate: 22.9 },
      { lab_ref: 'HMRN', tested_cases: 210, positive_count: 52, positive_rate: 24.8 },
      { lab_ref: 'SMS', tested_cases: 180, positive_count: 31, positive_rate: 17.2 },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof LabChart>;

export const Default: Story = {};
