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
        <span class="w-2.5 h-2.5 rounded-full dot-done" style="background:#008A4C"></span>
        <span class="text-gray-300">已完成</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full border bg-gray-700 border-gray-600"></span>
        <span class="text-gray-500">未完成</span>
      </div>
      <div class="text-gray-600 pt-1 text-[10px]">点击省份下钻 · 点击点位详情</div>
    </div>

    <!-- Info card (no owner display) -->
    <transition name="fade">
      <div v-if="cardUnit" class="absolute top-3 right-3 card-elevated p-4 w-64 z-20">
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <div class="text-white font-bold text-sm truncate">{{ cardUnit.name }}</div>
            <div class="text-xs text-gray-400 mt-0.5">{{ cardUnit.province }} · {{ cardUnit.city }}{{ cardUnit.district ? ' · '+cardUnit.district : '' }}</div>
          </div>
          <button @click="selectUnit(null)" class="text-gray-500 hover:text-white ml-2 transition text-sm">✕</button>
        </div>
        <div class="mt-3 flex items-center justify-between text-sm">
          <span class="text-gray-400">状态</span>
          <span :class="cardDone?'text-green-400 font-medium':'text-gray-500'">{{ cardDone?'✓ 已完成':'○ 待结账' }}</span>
        </div>
        <div v-if="cardDone && store.progress[cardUnit.id]?.doneAt" class="flex items-center justify-between text-sm mt-1">
          <span class="text-gray-400">完成于</span>
          <span class="text-white font-mono text-xs">{{ fmtTime(store.progress[cardUnit.id].doneAt) }}</span>
        </div>
        <button @click="onToggle" :disabled="!canToggle"
          :class="['mt-4 w-full py-2 rounded-xl text-sm font-semibold transition-all duration-200',
            cardDone?'border border-gray-700 text-gray-400 hover:text-green-400 hover:border-green-600/30':'bg-green-700/15 border border-green-600/50 text-green-400 hover:bg-green-700/25 active:scale-[0.97]',
            !canToggle&&'opacity-40 cursor-not-allowed']">
          {{ cardDone?'取消标记':'✓ 标记完成' }}
        </button>
        <div v-if="!canToggle" class="text-xs text-gray-600 mt-1 text-center">历史周期不可修改</div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import { store, selectUnit, toggleUnit, isDone } from '../data/store'
import { provinceAdcode } from '../data/adcode'

const TSG = '#008A4C' // Tsingtao green

const el = ref(null)
let chart = null, chinaReady = false
const drilled = ref(null)

const cardUnit = computed(() => store.selectedUnitId ? store.units.find(u => u.id===store.selectedUnitId) : null)
const cardDone = computed(() => store.selectedUnitId ? isDone(store.selectedUnitId) : false)
const canToggle = computed(() => store.currentPeriod === store.realCurrentPeriod)

function ratioForProvince(name) {
  const us = store.units.filter(u => u.province===name)
  return us.length ? us.filter(u => isDone(u.id)).length / us.length : 0
}
function ratioForCity(province, city) {
  const us = store.units.filter(u => u.province===province && u.city===city)
  return us.length ? us.filter(u => isDone(u.id)).length / us.length : 0
}

function regionColor(r) {
  if (r <= 0) return '#1e2435'
  const a = 0.22 + r * 0.48
  return `rgba(${Math.round(r*120)},${Math.round(130+r*100)},${Math.round(r*70)},${a.toFixed(3)})`
}

function regionList() {
  if (drilled.value) {
    const cities = [...new Set(store.units.filter(u => u.province===drilled.value).map(u => u.city))]
    return cities.map(c => ({ name:c, ratio:ratioForCity(drilled.value,c), color:regionColor(ratioForCity(drilled.value,c)) }))
  }
  return Object.keys(provinceAdcode).map(name => {
    const r = ratioForProvince(name)
    return { name, ratio:r, color:regionColor(r) }
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
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger:'item', backgroundColor:'rgba(19,24,38,0.96)', borderColor:'rgba(0,138,76,0.3)', borderWidth:1, padding:[10,14], textStyle:{color:'#f0f2f5',fontSize:12}, formatter:tooltipFormatter() },
    geo: {
      map: mapName, roam: true, scaleLimit: { min:1, max:8 }, zoom: 1.2,
      label: { show: !!drilled.value, color: '#9ca3af', fontSize: 10 },
      itemStyle: { areaColor: '#1e2435', borderColor: 'rgba(156,163,175,0.18)', borderWidth: 1, shadowColor: 'rgba(0,0,0,0.5)', shadowBlur: 12 },
      emphasis: { itemStyle: { areaColor:'#252d3f', borderColor:TSG, borderWidth:1.5, shadowBlur:16, shadowColor:'rgba(0,138,76,0.15)' }, label: { color:'#22c55e' } },
      regions: regionList().map(r => ({ name:r.name, itemStyle:{ areaColor:r.color } })),
    },
    series: [
      { type:'effectScatter', coordinateSystem:'geo', data:done.map(u=>({ name:u.name, value:[u.lng,u.lat], unitId:u.id })), symbolSize:10,
        rippleEffect:{ brushType:'stroke', scale:4.5, period:3.5, color:TSG },
        itemStyle:{ color:TSG, shadowBlur:14, shadowColor:TSG }, zlevel:2, animationDelay:idx=>idx*50 },
      { type:'scatter', coordinateSystem:'geo', data:undone.map(u=>({ name:u.name, value:[u.lng,u.lat], unitId:u.id })), symbolSize:8,
        itemStyle:{ color:'#374151', opacity:0.9, borderColor:'rgba(156,163,175,0.15)', borderWidth:1.5 } },
    ],
  }
}

function render() { if (!chart||!chinaReady) return; chart.setOption(buildOption(drilled.value?'province':'china'), true) }

function updateData() {
  if (!chart||!chinaReady) return
  const {done,undone} = splitPoints()
  chart.setOption({ geo:{ regions:regionList().map(r=>({ name:r.name, itemStyle:{ areaColor:r.color } })) },
    series:[{ data:done.map(u=>({ name:u.name, value:[u.lng,u.lat], unitId:u.id })) },{ data:undone.map(u=>({ name:u.name, value:[u.lng,u.lat], unitId:u.id })) }] })
}

async function loadChina() {
  try { const json=await fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json').then(r=>r.json()); echarts.registerMap('china',json); chinaReady=true; render() } catch(e){ chinaReady=true }
}

async function drillTo(name) {
  const adcode = provinceAdcode[name]; if (!adcode) return
  try { const json=await fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`).then(r=>r.json()); echarts.registerMap('province',json); drilled.value=name; render() } catch(e){}
}

function back() { drilled.value=null; render() }

function attachEvents() {
  chart.on('click', p => {
    if (p.componentType==='geo' && !drilled.value && p.name && provinceAdcode[p.name]) drillTo(p.name)
    else if (p.componentType==='series' && p.data && p.data.unitId) selectUnit(p.data.unitId)
  })
}

onMounted(async () => { chart=echarts.init(el.value,null,{renderer:'canvas'}); attachEvents(); await loadChina(); window.addEventListener('resize',()=>chart&&chart.resize()) })
onBeforeUnmount(() => { window.removeEventListener('resize',()=>{}); if(chart)chart.dispose(); chart=null })

watch(()=>store.progress, updateData, {deep:true})
watch(()=>store.units.length, ()=>render())
watch(()=>store.currentPeriod, ()=>{ drilled.value=null; render() })

let lastHl=null
watch(()=>store.selectedUnitId, id => {
  if(!chart||!chinaReady||!id){lastHl=null;return}
  if(lastHl)chart.dispatchAction({type:'downplay',seriesIndex:lastHl.si,dataIndex:lastHl.di})
  const opt=chart.getOption();let found=null;
  (opt.series||[]).forEach((s,si)=>{(s.data||[]).forEach((d,di)=>{if(d&&d.unitId===id)found={si,di}})})
  if(found){chart.dispatchAction({type:'highlight',seriesIndex:found.si,dataIndex:found.di});chart.dispatchAction({type:'showTip',seriesIndex:found.si,dataIndex:found.di});lastHl=found}else lastHl=null
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
