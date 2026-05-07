import type { Meta, StoryObj } from '@storybook/react';
import SankeyChart from './SankeyChart';

const meta: Meta<typeof SankeyChart> = {
  title: 'Charts/SankeyChart',
  component: SankeyChart,
  args: {
    nodes: [
      { name: 'Comunitária' },
      { name: 'Internado em Enfermaria' },
      { name: 'Internado em UTI' },
      { name: 'Cura' },
      { name: 'Óbito' },
    ],
    links: [
      { source: 'Comunitária', target: 'Internado em Enfermaria', value: 120, pct: 60 },
      { source: 'Comunitária', target: 'Internado em UTI', value: 80, pct: 40 },
      { source: 'Internado em Enfermaria', target: 'Cura', value: 90, pct: 75 },
      { source: 'Internado em UTI', target: 'Óbito', value: 30, pct: 37.5 },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof SankeyChart>;

export const Default: Story = {};
