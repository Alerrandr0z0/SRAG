import * as echarts from "echarts/core";
import { 
  HeatmapChart, 
  SankeyChart, 
  BarChart, 
  LineChart, 
  PieChart, 
  BoxplotChart,
  ScatterChart,
  EffectScatterChart
} from "echarts/charts";
import {
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  LegendComponent,
  TitleComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
  DataZoomComponent,
  DatasetComponent,
  TransformComponent,
  AriaComponent,
  GraphicComponent,
  ToolboxComponent
} from "echarts/components";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  LegendComponent,
  TitleComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
  DataZoomComponent,
  DatasetComponent,
  TransformComponent,
  AriaComponent,
  GraphicComponent,
  ToolboxComponent,
  LabelLayout,
  UniversalTransition,
  HeatmapChart,
  SankeyChart,
  BarChart,
  LineChart,
  PieChart,
  BoxplotChart,
  ScatterChart,
  EffectScatterChart,
  CanvasRenderer,
]);

export default echarts;
