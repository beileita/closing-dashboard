<template>
  <div ref="el" class="w-full h-full"></div>
</template>

<script setup>
// 维护界面用的地图拾取器:点击地图 -> 输出经纬度
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({ lng: Number, lat: Number })
const emit = defineEmits(['pick'])
const el = ref(null)
let chart = null
let ready = false

function markerData() {
  return props.lng != null && props.lat != null ? [{ value: [props.lng, props.lat] }] : []
}
function render() {
  if (!chart || !ready) return
  chart.setOption({
    geo: {
      map: 'china',
      roam: true,
      zoom: 1.2,
      itemStyle: { areaColor: '#0a3526', borderColor: 'rgba(0,255,156,0.3)', borderWidth: 0.8 },
      emphasis: { itemStyle: { areaColor: '#10b07a', borderColor: '#00FF9C' } },
    },
    series: [
      {
        type: 'scatter',
        coordinateSystem: 'geo',
        data: markerData(),
        symbolSize: 14,
        itemStyle: { color: '#00FF9C', shadowBlur: 14, shadowColor: '#00FF9C' },
      },
    ],
  })
}
function resize() {
  chart && chart.resize()
}
onMounted(async () => {
  chart = echarts.init(el.value)
  const json = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json').then((r) => r.json())
  echarts.registerMap('china', json)
  ready = true
  render()
  chart.getZr().on('click', (e) => {
    if (!chart) return
    const pt = chart.convertFromPixel({ geoIndex: 0 }, [e.offsetX, e.offsetY])
    if (pt && pt[0] && pt[1]) emit('pick', { lng: +pt[0].toFixed(4), lat: +pt[1].toFixed(4) })
  })
  window.addEventListener('resize', resize)
})
watch(() => [props.lng, props.lat], render, { deep: true })
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  if (chart) chart.dispose()
  chart = null
})
</script>
