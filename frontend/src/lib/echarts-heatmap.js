import * as echarts from "echarts/core";
import { HeatmapChart, SankeyChart, BarChart, LineChart, PieChart, BoxplotChart } from "echarts/charts";
import {
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  LegendComponent,
  TitleComponent,
  MarkLineComponent,
  DataZoomComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  LegendComponent,
  TitleComponent,
  MarkLineComponent,
  DataZoomComponent,
  HeatmapChart,
  SankeyChart,
  BarChart,
  LineChart,
  PieChart,
  BoxplotChart,
  CanvasRenderer,
]);

export default echarts;
