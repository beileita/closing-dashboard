<template>
  <div class="relative w-full h-full">
    <div ref="el" class="w-full h-full"></div>

    <!-- 返回全国 -->
    <button
      v-if="drilled"
      @click="back"
      class="absolute top-3 left-3 glass rounded-lg px-3 py-1.5 text-sm text-tech-green hover:bg-tech-green/10 transition z-10"
    >
      ← 返回全国
    </button>
    <div v-if="drilled" class="absolute top-3 left-1/2 -translate-x-1/2 text-tech-green text-sm neon z-10">
      {{ drilled }}
    </div>

    <!-- 3D 切换(桌面 + 支持 WebGL 时显示) -->
    <button
      v-if="desktop && glOk"
      @click="toggle3D"
      class="absolute bottom-3 right-3 z-10 glass rounded-lg px-3 py-1.5 text-xs text-tech-green hover:bg-tech-green/10 transition"
    >
      {{ use3D ? '切换 2D 平面' : '切换 3D 立体' }}
    </button>

    <!-- 图例 -->
    <div class="absolute bottom-3 left-3 glass rounded-lg px-3 py-2 text-xs space-y-1 z-10">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-tech-green dot-done"></span>
        <span class="text-tech-fg">已完成</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-tech-dim border border-tech-border"></span>
        <span class="text-tech-muted">未完成</span>
      </div>
      <div class="text-tech-dimtext pt-1">点击省份下钻 · 点击点位查看</div>
    </div>

    <!-- 单位卡片 -->
    <transition name="fade">
      <div v-if="cardUnit" class="absolute top-3 right-3 glass rounded-xl p-4 w-64 z-20 shadow-glowsoft">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-tech-green font-semibold neon">{{ cardUnit.name }}</div>
            <div class="text-xs text-tech-muted mt-0.5">
              {{ cardUnit.province }} · {{ cardUnit.city }}{{ cardUnit.district ? ' · ' + cardUnit.district : '' }}
            </div>
          </div>
          <button @click="selectUnit(null)" class="text-tech-muted hover:text-tech-green text-sm leading-none">✕</button>
        </div>
        <div class="mt-3 flex items-center justify-between text-sm">
          <span class="text-tech-muted">负责人</span>
          <span class="text-tech-fg">{{ cardUnit.owner || '-' }}</span>
        </div>
        <div class="mt-1 flex items-center justify-between text-sm">
          <span class="text-tech-muted">状态</span>
          <span :class="cardDone ? 'text-tech-green neon' : 'text-tech-muted'">{{ cardDone ? '✓ 已完成' : '○ 未完成' }}</span>
        </div>
        <button
          @click="onToggle"
          :disabled="!canToggle"
          :class="[
            'mt-3 w-full py-2 rounded-lg text-sm font-medium transition',
            cardDone
              ? 'border border-tech-border text-tech-muted hover:text-tech-green'
              : 'bg-tech-green/15 border border-tech-green text-tech-green hover:bg-tech-green/25',
            !canToggle && 'opacity-40 cursor-not-allowed',
          ]"
        >
          {{ cardDone ? '取消标记' : '✓ 标记完成' }}
        </button>
        <div v-if="!canToggle" class="text-xs text-tech-dimtext mt-1 text-center">历史周期不可修改</div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import { store, selectUnit, toggleUnit, isDone, addToast } from '../data/store'
import { provinceAdcode } from '../data/adcode'
import { hasWebGL } from '../utils/webgl'

const el = ref(null)
let chart = null
let chinaReady = false
const drilled = ref(null)
const desktop = ref(window.matchMedia('(min-width: 768px)').matches)
const glOk = ref(hasWebGL())
const use3D = ref(false) // 默认 2D(稳定),3D 按需开启

const cardUnit = computed(() => (store.selectedUnitId ? store.units.find((u) => u.id === store.selectedUnitId) : null))
const cardDone = computed(() => (store.selectedUnitId ? isDone(store.selectedUnitId) : false))
const canToggle = computed(() => store.currentPeriod === store.realCurrentPeriod)

// ---------- 共享数据计算 ----------
function ratioForProvince(name) {
  const us = store.units.filter((u) => u.province === name)
  if (!us.length) return 0
  return us.filter((u) => isDone(u.id)).length / us.length
}
function ratioForCity(province, city) {
  const us = store.units.filter((u) => u.province === province && u.city === city)
  if (!us.length) return 0
  return us.filter((u) => isDone(u.id)).length / us.length
}
function regionColor(r) {
  if (r <= 0) return '#0a3526'
  const a = 0.2 + r * 0.55
  return `rgba(0,255,156,${a.toFixed(3)})`
}
function regionList() {
  if (drilled.value) {
    const cities = [...new Set(store.units.filter((u) => u.province === drilled.value).map((u) => u.city))]
    return cities.map((c) => ({ name: c, ratio: ratioForCity(drilled.value, c), color: regionColor(ratioForCity(drilled.value, c)) }))
  }
  return Object.keys(provinceAdcode).map((name) => {
    const r = ratioForProvince(name)
    return { name, ratio: r, color: regionColor(r) }
  })
}
function visibleUnits() {
  return drilled.value ? store.units.filter((u) => u.province === drilled.value) : store.units
}
function splitPoints() {
  const done = []
  const undone = []
  for (const u of visibleUnits()) {
    if (isDone(u.id)) done.push(u)
    else undone.push(u)
  }
  return { done, undone }
}

function tooltipFormatter() {
  return (p) => {
    if (!p.data || !p.data.unitId) {
      const r = drilled.value ? ratioForCity(drilled.value, p.name) : ratioForProvince(p.name)
      return `<b style="color:#00FF9C">${p.name}</b><br/>完成率 ${Math.round(r * 100)}%`
    }
    const u = store.units.find((x) => x.id === p.data.unitId)
    const d = isDone(u.id)
    return `<b style="color:#00FF9C">${u.name}</b><br/>${u.province} ${u.city}<br/>负责人:${u.owner || '-'}<br/>状态:${d ? '<span style="color:#00FF9C">✓ 已完成</span>' : '<span style="color:#7dbf9c">○ 未完成</span>'}`
  }
}

// ---------- 3D 选项 ----------
function buildOption3D(mapName) {
  const { done, undone } = splitPoints()
  const regions = regionList()
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: 'rgba(2,12,8,0.92)', borderColor: 'rgba(0,255,156,0.4)', borderWidth: 1, textStyle: { color: '#e6fff2', fontSize: 12 }, formatter: tooltipFormatter() },
    series: [
      {
        type: 'map3D',
        map: mapName,
        boxDepth: 90,
        regionHeight: 3,
        shading: 'lambert',
        environment: 'none',
        groundPlane: { show: false },
        light: { main: { intensity: 1.7, shadow: true, alpha: 40, beta: 50 }, ambient: { intensity: 0.65 } },
        postEffect: { enable: true, bloom: { enable: true, intensity: 0.4, radius: 4 } },
        viewControl: { autoRotate: false, panMouseButton: 'left', rotateMouseButton: 'right' },
        itemStyle: { color: '#0a3526', borderColor: 'rgba(0,255,156,0.35)', borderWidth: 0.7, opacity: 0.96 },
        emphasis: { itemStyle: { color: '#10b07a', borderColor: '#00FF9C', borderWidth: 1.2 }, label: { show: true, color: '#00FF9C', fontSize: 11 } },
        label: { show: false },
        data: regions.map((r) => ({ name: r.name, value: r.ratio, itemStyle: { color: r.color } })),
      },
      {
        type: 'scatter3D',
        name: '已完成',
        coordinateSystem: 'geo3D',
        data: done.map((u) => ({ name: u.name, value: [u.lng, u.lat, 6], unitId: u.id })),
        symbolSize: 14,
        itemStyle: { color: '#00FF9C', opacity: 0.96, borderColor: '#e6fff2', borderWidth: 0.4 },
        emphasis: { scale: 1.5 },
      },
      {
        type: 'scatter3D',
        name: '未完成',
        coordinateSystem: 'geo3D',
        data: undone.map((u) => ({ name: u.name, value: [u.lng, u.lat, 2], unitId: u.id })),
        symbolSize: 7,
        itemStyle: { color: '#3a7159', opacity: 0.82 },
      },
    ],
  }
}

// ---------- 2D 选项(默认,稳定) ----------
function buildOption2D(mapName) {
  const { done, undone } = splitPoints()
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: 'rgba(2,12,8,0.92)', borderColor: 'rgba(0,255,156,0.4)', borderWidth: 1, textStyle: { color: '#e6fff2', fontSize: 12 }, formatter: tooltipFormatter() },
    geo: {
      map: mapName,
      roam: true,
      scaleLimit: { min: 1, max: 8 },
      zoom: 1.2,
      label: { show: !!drilled.value, color: '#7fe6c0', fontSize: 10 },
      itemStyle: { areaColor: '#0a3526', borderColor: 'rgba(0,255,156,0.3)', borderWidth: 0.8 },
      emphasis: { itemStyle: { areaColor: '#10b07a', borderColor: '#00FF9C' }, label: { color: '#00FF9C' } },
      regions: regionList().map((r) => ({ name: r.name, itemStyle: { areaColor: r.color } })),
    },
    series: [
      {
        type: 'scatter',
        coordinateSystem: 'geo',
        data: undone.map((u) => ({ name: u.name, value: [u.lng, u.lat], unitId: u.id })),
        symbolSize: 7,
        itemStyle: { color: '#3a7159', opacity: 0.85, borderColor: 'rgba(0,255,156,0.4)', borderWidth: 1 },
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: done.map((u) => ({ name: u.name, value: [u.lng, u.lat], unitId: u.id })),
        symbolSize: 9,
        rippleEffect: { brushType: 'stroke', scale: 3.4, period: 3 },
        itemStyle: { color: '#00FF9C', shadowBlur: 14, shadowColor: '#00FF9C' },
        zlevel: 2,
      },
    ],
  }
}

function buildOption(mapName) {
  return use3D.value ? buildOption3D(mapName) : buildOption2D(mapName)
}
function render() {
  if (!chart || !chinaReady) return
  const mapName = drilled.value ? 'province' : 'china'
  try {
    chart.setOption(buildOption(mapName), true)
  } catch (e) {
    // 3D 渲染异常 -> 自动回退 2D
    if (use3D.value) {
      use3D.value = false
      addToast('3D 渲染失败,已切回 2D')
      try {
        chart.setOption(buildOption2D(mapName), true)
      } catch (_) {
        /* ignore */
      }
    }
  }
}
function updateData() {
  if (!chart || !chinaReady) return
  try {
    if (use3D.value) {
      const { done, undone } = splitPoints()
      const regions = regionList()
      chart.setOption({
        series: [
          { data: regions.map((r) => ({ name: r.name, value: r.ratio, itemStyle: { color: r.color } })) },
          { data: done.map((u) => ({ name: u.name, value: [u.lng, u.lat, 6], unitId: u.id })) },
          { data: undone.map((u) => ({ name: u.name, value: [u.lng, u.lat, 2], unitId: u.id })) },
        ],
      })
    } else {
      const { done, undone } = splitPoints()
      chart.setOption({
        geo: { regions: regionList().map((r) => ({ name: r.name, itemStyle: { areaColor: r.color } })) },
        series: [
          { data: undone.map((u) => ({ name: u.name, value: [u.lng, u.lat], unitId: u.id })) },
          { data: done.map((u) => ({ name: u.name, value: [u.lng, u.lat], unitId: u.id })) },
        ],
      })
    }
  } catch (e) {
    /* ignore update errors */
  }
}

async function loadChina() {
  const json = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json').then((r) => r.json())
  echarts.registerMap('china', json)
  chinaReady = true
  render()
}
async function drillTo(name) {
  const adcode = provinceAdcode[name]
  if (!adcode) return
  try {
    const json = await fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`).then((r) => r.json())
    echarts.registerMap('province', json)
    drilled.value = name
    render()
  } catch (e) {
    /* 留在全国图 */
  }
}
function back() {
  drilled.value = null
  render()
}

async function toggle3D() {
  const next = !use3D.value
  if (next) {
    try {
      await import('echarts-gl')
    } catch (e) {
      addToast('3D 模块加载失败')
      return
    }
  }
  use3D.value = next
  render()
}

let lastHl = null
function highlightPoint(id, tip = true) {
  if (!chart || !chinaReady || !id) return
  const opt = chart.getOption()
  let found = null
  ;(opt.series || []).forEach((s, si) => {
    ;(s.data || []).forEach((d, di) => {
      if (d && d.unitId === id) found = { si, di }
    })
  })
  if (lastHl) chart.dispatchAction({ type: 'downplay', seriesIndex: lastHl.si, dataIndex: lastHl.di })
  if (found) {
    chart.dispatchAction({ type: 'highlight', seriesIndex: found.si, dataIndex: found.di })
    if (tip) chart.dispatchAction({ type: 'showTip', seriesIndex: found.si, dataIndex: found.di })
    lastHl = found
  } else {
    lastHl = null
  }
}
function pulseRegion(province) {
  if (!chart || !use3D.value) return
  try {
    chart.dispatchAction({ type: 'highlight', seriesIndex: 0, name: province })
    setTimeout(() => chart && chart.dispatchAction({ type: 'downplay', seriesIndex: 0, name: province }), 1500)
  } catch (e) {
    /* ignore */
  }
}

function onToggle() {
  if (store.selectedUnitId) toggleUnit(store.selectedUnitId)
}
function resize() {
  chart && chart.resize()
}

onMounted(async () => {
  chart = echarts.init(el.value, null, { renderer: 'canvas' })
  chart.on('click', (p) => {
    if (p.seriesType === 'map3D') {
      if (!drilled.value && p.name && provinceAdcode[p.name]) drillTo(p.name)
    } else if (p.seriesType === 'scatter3D') {
      if (p.data && p.data.unitId) selectUnit(p.data.unitId)
    } else if (p.componentType === 'series') {
      if (p.data && p.data.unitId) selectUnit(p.data.unitId)
    } else if (p.componentType === 'geo') {
      if (!drilled.value && p.name && provinceAdcode[p.name]) drillTo(p.name)
    }
  })
  await loadChina()
  window.addEventListener('resize', resize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  if (chart) chart.dispose()
  chart = null
})

watch(() => store.progress, updateData, { deep: true })
watch(() => store.units.length, () => render())
watch(() => store.selectedUnitId, (id) => highlightPoint(id))
watch(() => store.pulseUnitId, (id) => {
  if (!id) return
  highlightPoint(id, true)
  const u = store.units.find((x) => x.id === id)
  if (u) pulseRegion(u.province)
})
watch(() => store.currentPeriod, () => {
  drilled.value = null
  render()
})
</script>
