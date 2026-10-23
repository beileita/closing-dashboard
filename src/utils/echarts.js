// 按需引入 ECharts 模块，避免整包进首屏
// 当前项目只用到：geo 地图 + 散点/涟漪散点 + tooltip，canvas 渲染
import * as echarts from 'echarts/core'
import { GeoComponent, TooltipComponent } from 'echarts/components'
import { ScatterChart, EffectScatterChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([GeoComponent, TooltipComponent, ScatterChart, EffectScatterChart, CanvasRenderer])

export default echarts
