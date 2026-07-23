<template>
  <div class="relative w-full h-full">
    <div ref="el" class="w-full h-full"></div>

    <button v-if="drilled" @click="back"
      class="absolute top-3 left-3 card px-3 py-1.5 text-sm text-green-400 hover:bg-green-700/10 transition z-10">
      ← 返回全国
    </button>
    <div v-if="drilled" class="absolute top-3 left-1/2 -translate-x-1/2 text-green-400 text-sm font-medium z-10">
      {{ drilled }}
    </div>

    <div class="absolute bottom-3 left-3 card px-3 py-2 text-xs space-y-1.5 z-10">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full dot-done" :style="{background:mapColors.scatterDone}"></span>
        <span :style="{color:mapColors.tooltipText}">已完成</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full border" :style="{background:mapColors.scatterUndone,borderColor:mapColors.scatterUndoneBorder}"></span>
        <span :style="{color:mapColors.labelColor}">未完成</span>
      </div>
      <div class="pt-1 text-[10px]" :style="{color:store.theme==='dark'?'#556677':'#8899aa'}">点击省份下钻 · 点击点位详情</div>
    </div>

    <!-- Info card (no owner display) -->
    <transition name="fade">
      <div v-if="cardUnit" class="absolute top-3 right-3 card-elevated p-4 w-64 z-20">
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm truncate" :style="{color:'var(--text-primary)'}">{{ cardUnit.name }}</div>
            <div class="text-xs mt-0.5" :style="{color:'var(--text-secondary)'}">{{ cardUnit.province }} · {{ cardUnit.city }}{{ cardUnit.district ? ' · '+cardUnit.district : '' }}</div>
          </div>
          <button @click="selectUnit(null)" class="hover:text-current ml-2 transition text-sm" :style="{color:'var(--text-muted)'}">✕</button>
        </div>
        <div class="mt-3 flex items-center justify-between text-sm">
          <span :style="{color:'var(--text-secondary)'}">状态</span>
          <span :class="cardDone?'font-medium':''" :style="{color:cardDone?'var(--accent)':'var(--text-muted)'}">{{ cardDone?'✓ 已完成':'○ 待结账' }}</span>
        </div>
        <div v-if="cardDone && store.progress[cardUnit.id]?.doneAt" class="flex items-center justify-between text-sm mt-1">
          <span :style="{color:'var(--text-secondary)'}">完成于</span>
          <span class="font-mono text-xs" :style="{color:'var(--text-primary)'}">{{ fmtTime(store.progress[cardUnit.id].doneAt) }}</span>
        </div>
        <button @click="onToggle" :disabled="!canToggle"
          :class="['mt-4 w-full py-2 rounded-xl text-sm font-semibold transition-all duration-200',
            cardDone?'border text-gray-400 hover:text-green-400 hover:border-green-600/30':'bg-green-700/15 border border-green-600/50 text-green-400 hover:bg-green-700/25 active:scale-[0.97]',
            !canToggle&&'opacity-40 cursor-not-allowed']">
          {{ cardDone?'取消标记':'✓ 标记完成' }}
        </button>
        <div v-if="!canToggle" class="text-xs mt-1 text-center" :style="{color:'var(--text-muted)'}">历史周期不可修改</div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import { store, selectUnit, toggleUnit, isDone } from '../data/store'
import { provinceAdcode } from '../data/adcode'

// ---- Theme-aware map colors ----
const mapColors = {
  get land() { return store.theme === 'dark' ? '#1b2a37' : '#e8ecf2' },
  get border() { return store.theme === 'dark' ? 'rgba(148,163,178,0.25)' : 'rgba(0,0,0,0.18)' },
  get hoverLand() { return store.theme === 'dark' ? '#253444' : '#d5dbe3' },
  get accent() { return store.theme === 'dark' ? '#00c26e' : '#008A4C' },
  get accentSoft() { return store.theme === 'dark' ? '#22c55e' : '#16a34a' },
  get scatterDone() { return store.theme === 'dark' ? '#00c26e' : '#008A4C' },
  get scatterUndone() { return store.theme === 'dark' ? '#3d4f60' : '#bcc4cf' },
  get scatterUndoneBorder() { return store.theme === 'dark' ? 'rgba(156,163,175,0.15)' : 'rgba(0,0,0,0.12)' },
  get tooltipBg() { return store.theme === 'dark' ? 'rgba(17,27,35,0.97)' : 'rgba(255,255,255,0.97)' },
  get tooltipText() { return store.theme === 'dark' ? '#e6edf3' : '#15222e' },
  get tooltipBorder() { return store.theme === 'dark' ? 'rgba(0,194,110,0.3)' : 'rgba(0,138,76,0.3)' },
  get shadowColor() { return store.theme === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)' },
  get emphasisShadow() { return store.theme === 'dark' ? 'rgba(0,194,110,0.15)' : 'rgba(0,138,76,0.12)' },
  regionColor(r) {
    if (r <= 0) return store.theme === 'dark' ? '#17222d' : '#e2e6ed'
    if (store.theme === 'dark') {
      const a = 0.22 + r * 0.48
      return `rgba(${Math.round(r*120)},${Math.round(130+r*100)},${Math.round(r*70)},${a.toFixed(3)})`
    }
    // day mode: soft green tint
    const a = 0.15 + r * 0.45
    return `rgba(${Math.round(r*60)},${Math.round(130+r*50)},${Math.round(80+r*40)},${a.toFixed(3)})`
  },
  get labelColor() { return store.theme === 'dark' ? '#9ca3af' : '#556677' },
  get emphasisLabelColor() { return store.theme === 'dark' ? '#22c55e' : '#008A4C' },
}

const el = ref(null)
let chart = null, chinaReady = false
const drilled = ref(null)

const cardUnit = computed(() => store.selectedUnitId ? store.units.find(u => u.id===store.selectedUnitId) : null)
const cardDone = computed(() => store.selectedUnitId ? isDone(store.selectedUnitId) : false)
const canToggle = computed(() => store.currentPeriod === store.realCurrentPeriod)

// Auto-close card after 5 seconds
let cardTimer = null
watch(cardUnit, (u) => {
  clearTimeout(cardTimer)
  if (u) cardTimer = setTimeout(() => selectUnit(null), 5000)
})

function ratioForProvince(name) {
  const us = store.units.filter(u => u.province===name)
  return us.length ? us.filter(u => isDone(u.id)).length / us.length : 0
}
function ratioForCity(province, city) {
  const us = store.units.filter(u => u.province===province && u.city===city)
  return us.length ? us.filter(u => isDone(u.id)).length / us.length : 0
}

function regionList() {
  if (drilled.value) {
    const cities = [...new Set(store.units.filter(u => u.province===drilled.value).map(u => u.city))]
    return cities.map(c => ({ name:c, ratio:ratioForCity(drilled.value,c), color:mapColors.regionColor(ratioForCity(drilled.value,c)) }))
  }
  return Object.keys(provinceAdcode).map(name => {
    const r = ratioForProvince(name)
    return { name, ratio:r, color:mapColors.regionColor(r) }
  })
}

function visibleUnits() { return drilled.value ? store.units.filter(u => u.province===drilled.value) : store.units }

function splitPoints() {
  const done=[], undone=[]
  for(const u of visibleUnits()) { if(isDone(u.id)) done.push(u); else undone.push(u) }
  return {done,undone}
}

function tooltipFormatter() {
  return (p) => {
    if (!p.data||!p.data.unitId) {
      const r = drilled.value ? ratioForCity(drilled.value,p.name) : ratioForProvince(p.name)
      return `<b style="color:#22c55e">${p.name}</b><br/>完成率 ${Math.round(r*100)}%`
    }
    const u = store.units.find(x => x.id===p.data.unitId)
    if (!u) return ''
    const d = isDone(u.id)
    return `<b style="color:#22c55e">${u.name}</b><br/>${u.province} ${u.city}<br/>状态:${d?'<span style="color:#008A4C">✓ 已完成</span>':'<span style="color:#9ca3af">○ 未完成</span>'}`
  }
}

function buildOption(mapName) {
  const {done, undone} = splitPoints()
  const mc = mapColors
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger:'item', backgroundColor:mc.tooltipBg, borderColor:mc.tooltipBorder, borderWidth:1, padding:[10,14], textStyle:{color:mc.tooltipText,fontSize:12}, formatter:tooltipFormatter() },
    geo: {
      map: mapName, roam: true, scaleLimit: { min:1, max:8 },
      center: drilled.value ? undefined : [104.5, 37],
      zoom: 1.25,
      label: { show: !!drilled.value, color: mc.labelColor, fontSize: 10 },
      itemStyle: { areaColor: mc.land, borderColor: mc.border, borderWidth: 1, shadowColor: mc.shadowColor, shadowBlur: 12 },
      emphasis: { itemStyle: { areaColor:mc.hoverLand, borderColor:mc.accent, borderWidth:1.5, shadowBlur:16, shadowColor:mc.emphasisShadow }, label: { color:mc.emphasisLabelColor } },
      regions: regionList().map(r => ({ name:r.name, itemStyle:{ areaColor:r.color } })),
    },
    series: [
      { type:'effectScatter', coordinateSystem:'geo', data:done.map(u=>({ name:u.name, value:[u.lng,u.lat], unitId:u.id })), symbolSize:10,
        rippleEffect:{ brushType:'stroke', scale:4.5, period:3.5, color:mc.accent },
        itemStyle:{ color:mc.scatterDone, shadowBlur:14, shadowColor:mc.scatterDone }, zlevel:2, animationDelay:idx=>idx*50 },
      { type:'scatter', coordinateSystem:'geo', data:undone.map(u=>({ name:u.name, value:[u.lng,u.lat], unitId:u.id })), symbolSize:8,
        itemStyle:{ color:mc.scatterUndone, opacity:0.9, borderColor:mc.scatterUndoneBorder, borderWidth:1.5 } },
    ],
  }
}

function render() { if (!chart||!chinaReady) return; chart.setOption(buildOption(drilled.value?'province':'china'), true) }

// 滚轮缩放/拖拽期间跳过数据更新，避免散点与地图脱节（"分离" bug）
let isRoaming = false, roamTimer = null
function updateData() {
  if (!chart||!chinaReady || isRoaming) return
  const {done,undone} = splitPoints()
  chart.setOption({ geo:{ regions:regionList().map(r=>({ name:r.name, itemStyle:{ areaColor:r.color } })) },
    series:[{ data:done.map(u=>({ name:u.name, value:[u.lng,u.lat], unitId:u.id })) },{ data:undone.map(u=>({ name:u.name, value:[u.lng,u.lat], unitId:u.id })) }] })
}

// Re-render when theme changes
watch(() => store.theme, () => { if (chart && chinaReady) { chart.setOption(buildOption(drilled.value ? 'province' : 'china'), true) } })

const SCS_NAMES = ['南海诸岛','南海诸岛及其它','南沙群岛','中沙群岛','东沙群岛','西沙群岛','九段线']
function filterSouthChinaSea(geojson) {
  return { ...geojson, features: geojson.features.filter(f => !SCS_NAMES.includes(f.properties?.name)) }
}

async function loadChina() {
  try {
    const json = await fetch('/china.json').then(r => r.json())
    echarts.registerMap('china', filterSouthChinaSea(json))
    chinaReady = true; render()
  } catch(e) {
    console.warn('China map load failed', e)
    chinaReady = true
  }
}

async function drillTo(name) {
  const adcode = provinceAdcode[name]; if (!adcode) return
  try {
    let json
    try { json = await fetch(`/geojson/${adcode}.json`).then(r=>r.json()) } catch(e){/* try CDN */}
    if (!json) json = await fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`).then(r=>r.json())
    echarts.registerMap('province', filterSouthChinaSea(json))
    drilled.value = name
    render()
  } catch(e) { console.warn('Province map load failed', name, e) }
}

function back() { drilled.value=null; render() }

function attachEvents() {
  chart.on('click', p => {
    if (p.componentType==='geo' && !drilled.value && p.name && provinceAdcode[p.name]) drillTo(p.name)
    else if (p.componentType==='series' && p.data && p.data.unitId) selectUnit(p.data.unitId)
  })
  // 跟踪缩放/拖拽状态，防止 updateData 在交互期间触发散点脱节
  chart.on('geoRoam', () => {
    isRoaming = true
    clearTimeout(roamTimer)
    roamTimer = setTimeout(() => { isRoaming = false }, 600)
  })
}

let _resizeHandler = null
onMounted(async () => { chart=echarts.init(el.value,null,{renderer:'canvas'}); attachEvents(); await loadChina(); _resizeHandler = ()=>chart&&chart.resize(); window.addEventListener('resize',_resizeHandler) })
onBeforeUnmount(() => { if(_resizeHandler) window.removeEventListener('resize',_resizeHandler); if(chart)chart.dispose(); chart=null })

watch(()=>store.progress, updateData, {deep:true})
watch(()=>store.units.length, ()=>render())
watch(()=>store.currentPeriod, ()=>{ drilled.value=null; render() })

let lastHl=null
watch(()=>store.selectedUnitId, id => {
  if(!chart||!chinaReady||!id){lastHl=null;return}
  if(lastHl)chart.dispatchAction({type:'downplay',seriesIndex:lastHl.si,dataIndex:lastHl.di})
  const opt=chart.getOption();let found=null;
  (opt.series||[]).forEach((s,si)=>{(s.data||[]).forEach((d,di)=>{if(d&&d.unitId===id)found={si,di}})})
  if(found){
    chart.dispatchAction({type:'highlight',seriesIndex:found.si,dataIndex:found.di})
    chart.dispatchAction({type:'showTip',seriesIndex:found.si,dataIndex:found.di})
    lastHl=found
    // Zoom to unit then restore after 3s
    const u=store.units.find(x=>x.id===id)
    if(u){
      chart.setOption({geo:{center:[u.lng,u.lat],zoom:5}})
      setTimeout(()=>chart.setOption({geo:{center:undefined,zoom:drilled.value?1:1.2}}),3000)
    }
  }else lastHl=null
})

watch(()=>store.pulseUnitId, id => {
  if(!id||!chart||!chinaReady)return
  const opt=chart.getOption();let found=null;
  (opt.series||[]).forEach((s,si)=>{(s.data||[]).forEach((d,di)=>{if(d&&d.unitId===id)found={si,di}})})
  if(found){chart.dispatchAction({type:'highlight',seriesIndex:found.si,dataIndex:found.di});chart.dispatchAction({type:'showTip',seriesIndex:found.si,dataIndex:found.di})}
})

function onToggle() { if (store.selectedUnitId) toggleUnit(store.selectedUnitId) }
function fmtTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>
