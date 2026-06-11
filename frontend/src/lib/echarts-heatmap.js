import {
  BarChart,
  BoxplotChart,
  EffectScatterChart,
  HeatmapChart,
  LineChart,
  PieChart,
  SankeyChart,
  ScatterChart,
  TreemapChart,
} from 'echarts/charts';
import {
  AriaComponent,
  DatasetComponent,
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { LabelLayout, LegacyGridContainLabel, UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

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
  LegacyGridContainLabel,
  UniversalTransition,
  HeatmapChart,
  SankeyChart,
  BarChart,
  LineChart,
  PieChart,
  BoxplotChart,
  ScatterChart,
  EffectScatterChart,
  TreemapChart,
  CanvasRenderer,
]);

export default echarts;
