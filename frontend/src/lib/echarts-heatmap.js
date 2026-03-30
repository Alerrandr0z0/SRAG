import * as echarts from 'echarts/core';
import { HeatmapChart, FunnelChart, SankeyChart, BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  LegendComponent,
  TitleComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  LegendComponent,
  TitleComponent,
  HeatmapChart,
  FunnelChart,
  SankeyChart,
  BarChart,
  LineChart,
  PieChart,
  CanvasRenderer
]);

export default echarts;
