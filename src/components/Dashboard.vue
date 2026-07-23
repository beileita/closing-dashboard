<template>
  <div class="flex-1 flex flex-col min-h-0 px-4 pb-4">
    <div class="md:hidden flex card p-1 mb-3">
      <button @click="setMobileView('map')" :class="['flex-1 py-1.5 text-xs rounded-lg transition', store.mobileView==='map'?'bg-green-700/15 text-green-400':'text-gray-500']">🗺 地图</button>
      <button @click="setMobileView('list')" :class="['flex-1 py-1.5 text-xs rounded-lg transition', store.mobileView==='list'?'bg-green-700/15 text-green-400':'text-gray-500']">📋 列表</button>
    </div>

    <div class="flex-1 flex gap-4 min-h-0">
      <!-- Left: stats + list -->
      <div :class="['flex flex-col gap-3 w-full md:w-[340px] md:shrink-0', store.mobileView==='list'?'flex':'hidden md:flex']">
        <!-- Compact stats -->
        <div class="card px-4 py-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium tracking-wide uppercase" :style="{color:'var(--text-secondary)'}">Progress</span>
            <span class="text-xs" :style="{color:'var(--text-muted)'}">{{ nowStr }}</span>
          </div>
          <div class="flex items-center gap-4">
            <div class="relative w-12 h-12 shrink-0">
              <svg class="w-full h-full -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" :stroke="store.theme==='dark'?'rgba(156,163,175,0.12)':'rgba(0,0,0,0.06)'" stroke-width="5" />
                <circle cx="32" cy="32" r="28" fill="none" :stroke="store.theme==='dark'?'#00c26e':'#008A4C'" stroke-width="5" stroke-linecap="round"
                  :stroke-dasharray="2*Math.PI*28" :stroke-dashoffset="2*Math.PI*28*(1-pctNum/100)"
                  class="transition-[stroke-dashoffset] duration-1000 ease-out"
                  :style="{filter:store.theme==='dark'?'drop-shadow(0 0 6px rgba(0,194,110,0.35))':'drop-shadow(0 0 4px rgba(0,138,76,0.2))'}" />
              </svg>
              <span class="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums" :style="{color:'var(--accent)'}">{{ pctNum }}%</span>
            </div>
            <div class="flex-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
              <div class="text-[11px]" :style="{color:'var(--text-secondary)'}">已完成</div><div class="text-[11px] text-right" :style="{color:'var(--text-secondary)'}">进行中</div>
              <div class="text-lg font-bold tabular-nums" :style="{color:'var(--accent)'}">{{ done }}</div>
              <div class="text-lg font-bold tabular-nums text-right" :style="{color:'var(--text-muted)'}">{{ undone }}</div>
              <div class="text-[10px] col-span-2 mt-0.5" :style="{color:'var(--text-muted)'}">总计 {{ total }} 单位</div>
            </div>
          </div>
          <div class="mt-2.5 h-1.5 rounded-full overflow-hidden" :style="{background:store.theme==='dark'?'#1e293b':'#e2e6ed'}">
            <div class="h-full rounded-full transition-all duration-700 ease-out"
              :style="{width:pctNum+'%',background:store.theme==='dark'?'linear-gradient(90deg,#00c26e,#22c55e)':'linear-gradient(90deg,#008A4C,#16a34a)',boxShadow:store.theme==='dark'?'0 0 6px rgba(0,194,110,0.25)':'0 0 4px rgba(0,138,76,0.15)'}"></div>
          </div>
        </div>

        <!-- Unit list -->
        <div class="card flex-1 overflow-hidden flex flex-col min-h-0">
          <UnitList />
        </div>
      </div>

      <!-- Map -->
      <div :class="['flex-1 card-map overflow-hidden relative min-h-[400px]', store.mobileView==='map'?'flex':'hidden md:flex']">
        <ChinaMap />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { store, isDone, setMobileView } from '../data/store'
import UnitList from './UnitList.vue'
import ChinaMap from './ChinaMap.vue'

const nowTs = ref(Date.now())
let _timer = null
onMounted(() => { _timer = setInterval(() => { nowTs.value = Date.now() }, 1000) })
onBeforeUnmount(() => { clearInterval(_timer) })

const nowStr = computed(() => {
  const d = new Date(nowTs.value)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
})

const done = computed(() => store.units.filter(u=>isDone(u.id)).length)
const total = computed(() => store.units.length)
const undone = computed(() => total.value-done.value)
const pctNum = computed(() => total.value?Math.round((done.value/total.value)*100):0)
</script>
