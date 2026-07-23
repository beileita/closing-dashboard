<template>
  <teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4" style="background:rgba(0,0,0,0.75);backdrop-filter:blur(4px)">
      <div class="w-full max-w-5xl flex flex-col rounded-2xl overflow-hidden" :style="{height:'92vh',background:store.theme==='dark'?'#111827':'#ffffff',border:store.theme==='dark'?'1px solid rgba(156,163,175,0.12)':'1px solid rgba(0,0,0,0.08)',boxShadow:store.theme==='dark'?'0 24px 80px rgba(0,0,0,0.6)':'0 24px 80px rgba(0,0,0,0.15)'}">

        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3 shrink-0" :style="{borderBottom:store.theme==='dark'?'1px solid rgba(75,85,99,0.3)':'1px solid rgba(0,0,0,0.06)'}">
          <div class="flex items-center gap-2.5">
            <span class="w-1 h-5 rounded-full" :style="{background:mc.accent}"></span>
            <span class="font-bold text-sm" :style="{color:'var(--text-primary)'}">{{ props.unit ? '编辑单位' : '新增单位' }}</span>
          </div>
          <button @click="$emit('close')" class="hover:text-current text-lg leading-none transition p-1" :style="{color:'var(--text-muted)'}">✕</button>
        </div>

        <!-- Body -->
        <div class="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">

          <!-- Left: form -->
          <div class="w-full md:w-72 shrink-0 p-4 space-y-3 overflow-y-auto" :style="{borderRight:store.theme==='dark'?'1px solid rgba(75,85,99,0.2)':'1px solid rgba(0,0,0,0.05)'}">
            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-400">单位名称 <span class="text-red-400">*</span></label>
              <input v-model="form.name" class="ipt" placeholder="如：上海陆家嘴中心" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-400">负责人</label>
              <input v-model="form.owner" class="ipt" placeholder="选填" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-400">省</label>
              <input v-model="form.province" class="ipt" readonly placeholder="点击省份自动填充" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-400">市</label>
              <input v-model="form.city" class="ipt" placeholder="点击城市区域自动填充" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-400">经度</label>
                <input :value="form.lng != null ? form.lng.toFixed(4) : ''" class="ipt text-xs font-mono" :class="form.lng != null ? 'text-green-400' : 'text-gray-600'" readonly placeholder="双击地图选取" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-400">纬度</label>
                <input :value="form.lat != null ? form.lat.toFixed(4) : ''" class="ipt text-xs font-mono" :class="form.lat != null ? 'text-green-400' : 'text-gray-600'" readonly placeholder="双击地图选取" />
              </div>
            </div>
            <p v-if="err" class="text-xs text-red-400 bg-red-950/30 rounded-lg px-3 py-2">{{ err }}</p>
          </div>

          <!-- Right: map -->
          <div class="flex-1 flex flex-col min-h-0 relative">
            <!-- Breadcrumb -->
            <div class="absolute top-2.5 left-3 z-10 flex items-center gap-0.5 text-xs">
              <button v-for="(lv, i) in stack" :key="i" @click="goLevel(i)"
                :class="['px-2 py-1 rounded card transition', i === stack.length - 1 ? 'text-green-400' : 'text-gray-500 hover:text-gray-300']">
                {{ lv.label }}<span v-if="i < stack.length - 1" class="ml-1 text-gray-600">›</span>
              </button>
            </div>

            <!-- ECharts container -->
            <div ref="mapEl" class="flex-1 w-full" style="min-height:300px"></div>

            <!-- Hint bar -->
            <div class="px-3 py-1.5 text-xs flex items-center justify-between shrink-0" :style="{borderTop:store.theme==='dark'?'1px solid rgba(75,85,99,0.2)':'1px solid rgba(0,0,0,0.05)'}">
              <span class="text-gray-500">🖱️ 单击区域下钻 · 双击地图拾取坐标 · 滚轮缩放</span>
              <span v-if="form.lng != null" class="text-green-400 font-medium">✓ {{ form.lng.toFixed(4) }}, {{ form.lat.toFixed(4) }}</span>
              <span v-else class="text-gray-600">未标记坐标</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-2 px-5 py-3 shrink-0" :style="{borderTop:store.theme==='dark'?'1px solid rgba(75,85,99,0.3)':'1px solid rgba(0,0,0,0.06)'}">
          <button @click="$emit('close')" class="btn-ghost">取消</button>
          <button @click="onSave" class="btn-primary">保存</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { store, addUnit, updateUnit } from '../data/store'
import { provinceAdcode } from '../data/adcode'

const props = defineProps({ unit: { type: Object, default: null } })
const emit = defineEmits(['close', 'saved'])

// ---- Theme-aware map colors ----
const mc = computed(() => ({
  land: store.theme === 'dark' ? '#1a2030' : '#e8ecf2',
  border: store.theme === 'dark' ? 'rgba(156,163,175,0.16)' : 'rgba(0,0,0,0.15)',
  hoverLand: store.theme === 'dark' ? '#252d3f' : '#d5dbe3',
  accent: store.theme === 'dark' ? '#00c26e' : '#008A4C',
  labelColor: store.theme === 'dark' ? '#9ca3af' : '#556677',
}))

const SCS = ['南海诸岛','南海诸岛及其它','南沙群岛','中沙群岛','东沙群岛','西沙群岛','九段线']
function filterGeo(g) {
  if (!g || !g.features) return g
  return { ...g, features: g.features.filter(f => !SCS.includes(f.properties?.name)) }
}

const form = reactive({
  name: props.unit?.name || '',
  owner: props.unit?.owner || '',
  province: props.unit?.province || '',
  city: props.unit?.city || '',
  lng: props.unit?.lng ?? null,
  lat: props.unit?.lat ?? null,
})
const err = ref('')

// ---- Map state ----
const mapEl = ref(null)
let chart = null, mapReady = false
const stack = ref([{ label:'全国', mapKey:'china', adcode:null, nameMap:null }])
const marker = ref(null) // [lng, lat] or null
const dblclickTs = ref(0) // track last dblclick for hint flash

function cur() { return stack.value[stack.value.length - 1] }

// ---- Render map ----
function render() {
  if (!chart || !mapReady) return
  const c = cur()
  const hasMarker = marker.value != null
  const colors = mc.value
  chart.setOption({
    geo: {
      map: c.mapKey, roam: true,
      zoom: c.adcode ? 1 : 1.25,
      center: c.adcode ? undefined : [104.5, 37],
      scaleLimit: { min: 0.6, max: 20 },
      label: { show: !!c.adcode, color: colors.labelColor, fontSize: 10 },
      itemStyle: { areaColor: colors.land, borderColor: colors.border, borderWidth: 1 },
      emphasis: { itemStyle: { areaColor: colors.hoverLand, borderColor: colors.accent, borderWidth: 1.5 }, label: { color: colors.accent } },
    },
    series: [{
      type: 'effectScatter', coordinateSystem: 'geo',
      data: hasMarker ? [{ value: marker.value }] : [],
      symbolSize: 14,
      rippleEffect: { brushType: 'stroke', scale: 4.5, period: 3, color: colors.accent },
      itemStyle: { color: colors.accent, shadowBlur: 16, shadowColor: colors.accent },
      zlevel: 2,
    }],
  }, true)
}

// Re-render when theme changes
watch(() => store.theme, () => { if (chart && mapReady) render() })

// ---- Load GeoJSON ----
async function loadGeo(adcode, mapKey) {
  let json
  try { json = await fetch(`/geojson/${adcode}.json`).then(r => r.json()) } catch (e) { /* try CDN */ }
  if (!json) {
    try { json = await fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`).then(r => r.json()) } catch (e) { return null }
  }
  echarts.registerMap(mapKey, filterGeo(json))
  const nm = {}
  for (const f of json.features) {
    if (!f.properties?.name) continue
    nm[f.properties.name] = { adcode: f.properties.adcode, center: f.properties.center || f.properties.centroid || null }
  }
  return nm
}

// ---- Click region → drill down (全国→省→市，最多2级) ----
async function onRegionClick(name) {
  const c = cur()
  const info = c.nameMap?.[name]
  if (!info || !info.adcode) return

  if (stack.value.length === 1) {
    // 全国 → 省
    const mapKey = 'pk_' + info.adcode
    try {
      const nm = await loadGeo(info.adcode, mapKey)
      if (!nm) { console.warn('GeoJSON load failed for', name); return }
      stack.value.push({ label: name, mapKey, adcode: info.adcode, nameMap: nm })
      form.province = name
      render()
    } catch (e) { console.warn('Drill error', e) }
  } else if (stack.value.length === 2) {
    // 省 → 市：填充城市名并用城市中心作为默认坐标
    form.city = name
    if (info.center && Array.isArray(info.center) && info.center.length >= 2) {
      form.lng = +Number(info.center[0]).toFixed(4)
      form.lat = +Number(info.center[1]).toFixed(4)
      marker.value = [form.lng, form.lat]
    }
    render()
  }
}

// ---- Double-click → pick coordinates ----
function onDblClick(e) {
  if (!chart) return
  const evt = e.event || e
  const rect = mapEl.value.getBoundingClientRect()
  const x = (evt.clientX || 0) - rect.left
  const y = (evt.clientY || 0) - rect.top
  if (x <= 0 || y <= 0) return

  const pt = chart.convertFromPixel({ geoIndex: 0 }, [x, y])
  if (pt == null || pt[0] == null || pt[1] == null) return
  if (Math.abs(pt[0]) > 180 || Math.abs(pt[1]) > 90) return

  form.lng = +pt[0].toFixed(4)
  form.lat = +pt[1].toFixed(4)
  marker.value = [form.lng, form.lat]

  // Auto-fill province from drill context
  if (!form.province && stack.value[1]) form.province = stack.value[1].label
  if (!form.city && stack.value[2]) form.city = stack.value[2].label

  dblclickTs.value = Date.now()
  render()
}

// ---- Breadcrumb ----
function goLevel(i) {
  if (i === stack.value.length - 1) return
  stack.value = stack.value.slice(0, i + 1)
  render()
}

// ---- Save ----
async function onSave() {
  err.value = ''
  if (!form.name.trim()) { err.value = '请输入单位名称'; return }
  if (!form.province.trim()) { err.value = '请先点击地图省份下钻（单击省份区域）'; return }
  if (form.lng == null || form.lat == null) { err.value = '请双击地图确定坐标位置'; return }

  const data = {
    name: form.name.trim(), province: form.province.trim(),
    city: form.city.trim(), owner: form.owner.trim(),
    lng: form.lng, lat: form.lat,
  }
  try {
    if (props.unit) await updateUnit(props.unit.id, data)
    else await addUnit(data)
    emit('saved')
    emit('close')
  } catch (e) {
    err.value = '保存失败：' + (e.message || '未知错误')
  }
}

// ---- Lifecycle ----
let resizeHandler = null

onMounted(async () => {
  chart = echarts.init(mapEl.value)

  // Load china.json
  try {
    const json = await fetch('/china.json').then(r => r.json())
    const filtered = filterGeo(json)
    echarts.registerMap('china', filtered)
    const nm = {}
    for (const f of filtered.features) {
      if (!f.properties?.name) continue
      nm[f.properties.name] = {
        adcode: f.properties.adcode || provinceAdcode[f.properties.name],
        center: f.properties.center || f.properties.centroid || null,
      }
    }
    stack.value[0].nameMap = nm
    mapReady = true
  } catch (e) { console.warn('china.json load failed', e); mapReady = true }

  // Init marker if editing
  if (props.unit && props.unit.lng != null && props.unit.lat != null) {
    marker.value = [props.unit.lng, props.unit.lat]
  }

  // Auto-drill to province if editing
  if (props.unit?.province && provinceAdcode[props.unit.province]) {
    try {
      const adcode = provinceAdcode[props.unit.province]
      const nm = await loadGeo(adcode, 'pk_' + adcode)
      if (nm) stack.value.push({ label: props.unit.province, mapKey: 'pk_' + adcode, adcode, nameMap: nm })
    } catch (e) { /* stay national */ }
  }

  render()

  // Events
  chart.on('click', (p) => {
    if ((p.componentType === 'geo' || p.seriesType === 'map') && p.name) {
      onRegionClick(p.name)
    }
  })

  chart.getZr().on('dblclick', onDblClick)

  resizeHandler = () => { if (chart && !chart.isDisposed()) chart.resize() }
  window.addEventListener('resize', resizeHandler)
})

onBeforeUnmount(() => {
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  if (chart) { chart.dispose(); chart = null }
})
</script>

<style scoped>
.ipt {
  width: 100%; padding: 6px 10px; font-size: 13px;
  border-radius: 8px; outline: none; transition: border-color 0.2s;
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text-primary);
}
.ipt:focus { border-color: var(--accent); }
.ipt::placeholder { color: var(--text-muted); }
.ipt[readonly] { opacity: 0.7; cursor: default; }
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 6px;
}
.btn-primary {
  padding: 7px 20px; border-radius: 8px; font-size: 13px; font-weight: 500;
  background: var(--accent-dim); border: 1px solid var(--border-accent);
  color: var(--accent); cursor: pointer; transition: all 0.2s;
}
.btn-primary:hover { filter: brightness(1.2); }
.btn-primary:active { transform: scale(0.97); }
.btn-ghost {
  padding: 7px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
  background: transparent; border: 1px solid var(--border);
  color: var(--text-secondary); cursor: pointer; transition: all 0.2s;
}
.btn-ghost:hover { border-color: var(--text-muted); color: var(--text-primary); }
</style>
