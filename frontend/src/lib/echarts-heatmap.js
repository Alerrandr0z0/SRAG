import * as echarts from "echarts/core";
import { HeatmapChart, SankeyChart, BarChart, LineChart } from "echarts/charts";
import {
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  LegendComponent,
  TitleComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  LegendComponent,
  TitleComponent,
  HeatmapChart,
  SankeyChart,
  BarChart,
  LineChart,
  CanvasRenderer,
]);

export default echarts;
