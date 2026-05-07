import type { Meta, StoryObj } from '@storybook/react';
import ZonesChart from './ZonesChart';

const meta: Meta<typeof ZonesChart> = {
  title: 'Charts/ZonesChart',
  component: ZonesChart,
  args: {
    data: [
      { zona: 'Urbana', count: 312 },
      { zona: 'Rural', count: 84 },
      { zona: 'Periurbana', count: 29 },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof ZonesChart>;

export const Default: Story = {};
