<template>
  <div class="relative w-full h-full">
    <div ref="el" class="w-full h-full"></div>
    <!-- 面包屑 + 任意坐标提示 -->
    <div class="absolute top-3 left-3 z-10 flex items-center gap-0.5 text-xs">
      <button v-for="(lv, i) in stack" :key="i" @click="goto(i)"
        :class="['px-2 py-1 rounded card', i===stack.length-1?'text-green-400':'text-gray-400 hover:text-gray-200']">
        {{ lv.label }}<span v-if="i<stack.length-1" class="ml-1 text-gray-600">›</span>
      </button>
    </div>
    <div class="absolute bottom-3 left-3 z-10 text-xs text-gray-400 card rounded px-2.5 py-1 pointer-events-none">
      {{ hint }}
    </div>
  </div>
</template>

<script setup>
// 下钻拾取器: 全国→省→市→区。任意级别点击空白直接拾取坐标
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import { provinceAdcode } from '../data/adcode'

const props = defineProps({ lng:Number, lat:Number })
const emit = defineEmits(['pick'])
const el = ref(null)
let chart = null, ready = false

const stack = ref([{ label:'全国', mapKey:'china', adcode:null, nameMap:Object.fromEntries(Object.entries(provinceAdcode).map(([n,a])=>[n,{adcode:a,center:null}])) }])
const hint = ref('点击省份下钻 · 点击空白拾取坐标')

function cur() { return stack.value[stack.value.length-1] }

function markerData() {
  return props.lng!=null && props.lat!=null ? [{value:[props.lng,props.lat]}] : []
}

function render() {
  if (!chart||!ready) return
  const c = cur()
  chart.setOption({
    geo: {
      map:c.mapKey, roam:true, zoom:c.adcode?1:1.2,
      label:{ show:!!c.adcode, color:'#9ca3af', fontSize:10 },
      itemStyle:{ areaColor:'#1e2435', borderColor:'rgba(156,163,175,0.18)', borderWidth:1 },
      emphasis:{ itemStyle:{ areaColor:'#252d3f', borderColor:'#008A4C', borderWidth:1.5 }, label:{ color:'#22c55e' } },
    },
    series:[{ type:'scatter', coordinateSystem:'geo', data:markerData(), symbolSize:16, itemStyle:{ color:'#008A4C', shadowBlur:16, shadowColor:'#008A4C' } }],
  }, true)
  if (!c.adcode) hint.value = '点击省份下钻 · 点击空白拾取坐标'
  else if (stack.value.length===2) hint.value = '点击城市下钻 · 点击空白拾取坐标'
  else if (stack.value.length===3) hint.value = '点击区/县填充地址 · 点击空白微调坐标'
  else hint.value = '点击空白微调坐标'
}

async function loadMap(adcode, mapKey) {
  const json = await fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`).then(r=>r.json())
  echarts.registerMap(mapKey, json)
  const nameMap = {}
  for(const f of json.features) {
    nameMap[f.properties.name] = { adcode:f.properties.adcode, center:f.properties.center||f.properties.centroid||null }
  }
  return nameMap
}

async function drill(name) {
  const c = cur()
  const info = c.nameMap[name]
  if (!info||!info.adcode) return
  try {
    const nameMap = await loadMap(info.adcode, 'pk_'+info.adcode)
    stack.value.push({ label:name, mapKey:'pk_'+info.adcode, adcode:info.adcode, nameMap })
    render()
  } catch(e){}
}

// 点击区域: 下钻或选择区并填充省市区
function selectDistrict(name) {
  const c = cur()
  const info = c.nameMap[name]||{}
  const province = stack.value[1]?stack.value[1].label:null
  const city = stack.value[2]?stack.value[2].label:null
  emit('pick', { province, city, district:name, lng:info.center?+info.center[0].toFixed(4):props.lng, lat:info.center?+info.center[1].toFixed(4):props.lat })
}

// 点击空白: 任意坐标拾取
function pickPoint(e) {
  if (!chart) return
  const pt = chart.convertFromPixel({ geoIndex:0 }, [e.offsetX, e.offsetY])
  if (pt && pt[0] && pt[1] && Math.abs(pt[0])<180 && Math.abs(pt[1])<90) {
    const province = stack.value[1]?stack.value[1].label:null
    const city = stack.value[2]?stack.value[2].label:null
    emit('pick', { lng:+pt[0].toFixed(4), lat:+pt[1].toFixed(4), province, city })
  }
}

function goto(i) {
  if (i===stack.value.length-1) return
  stack.value = stack.value.slice(0, i+1)
  render()
}

let lastRegionTs = 0

onMounted(async () => {
  chart = echarts.init(el.value)
  const json = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json').then(r=>r.json())
  echarts.registerMap('china', json)
  ready = true; render()

  // 点击区域 → 下钻 or 选择区
  chart.on('click', p => {
    if ((p.componentType==='geo'||p.seriesType==='map') && p.name) {
      lastRegionTs = Date.now()
      if (stack.value.length < 3) drill(p.name)
      else selectDistrict(p.name)
    }
  })

  // 点击空白 → 任意坐标拾取 (延迟避开区域点击)
  chart.getZr().on('click', e => {
    setTimeout(() => {
      if (Date.now() - lastRegionTs > 150) pickPoint(e)
    }, 160)
  })

  window.addEventListener('resize', () => chart&&chart.resize())
})

watch(()=>[props.lng, props.lat], render, {deep:true})

onBeforeUnmount(() => {
  window.removeEventListener('resize', ()=>{})
  if(chart) chart.dispose(); chart=null
})
</script>
