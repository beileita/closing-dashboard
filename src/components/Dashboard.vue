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
            <span class="text-xs text-gray-400 font-medium tracking-wide uppercase">Progress</span>
            <span class="text-xs text-gray-500">截止 {{ store.currentPeriod }} 月末</span>
          </div>
          <div class="flex items-center gap-4">
            <div class="relative w-12 h-12 shrink-0">
              <svg class="w-full h-full -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(156,163,175,0.12)" stroke-width="5" />
                <circle cx="32" cy="32" r="28" fill="none" stroke="#008A4C" stroke-width="5" stroke-linecap="round"
                  :stroke-dasharray="2*Math.PI*28" :stroke-dashoffset="2*Math.PI*28*(1-pctNum/100)"
                  class="transition-[stroke-dashoffset] duration-1000 ease-out"
                  style="filter:drop-shadow(0 0 6px rgba(0,138,76,0.35))" />
              </svg>
              <span class="absolute inset-0 flex items-center justify-center text-xs font-bold text-green-400 tabular-nums">{{ pct }}%</span>
            </div>
            <div class="flex-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
              <div class="text-[11px] text-gray-400">已完成</div><div class="text-[11px] text-gray-400 text-right">进行中</div>
              <div class="text-lg font-bold text-green-400 tabular-nums">{{ done }}</div>
              <div class="text-lg font-bold text-gray-500 tabular-nums text-right">{{ undone }}</div>
              <div class="text-[10px] text-gray-500 col-span-2 mt-0.5">总计 {{ total }} 单位</div>
            </div>
          </div>
          <div class="mt-2.5 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-700 ease-out"
              :style="{width:pctNum+'%',background:'linear-gradient(90deg,#008A4C,#22c55e)',boxShadow:'0 0 6px rgba(0,138,76,0.25)'}"></div>
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
import { computed } from 'vue'
import { store, isDone, setMobileView } from '../data/store'
import UnitList from './UnitList.vue'
import ChinaMap from './ChinaMap.vue'

const done = computed(() => store.units.filter(u=>isDone(u.id)).length)
const total = computed(() => store.units.length)
const undone = computed(() => total.value-done.value)
const pctNum = computed(() => total.value?Math.round((done.value/total.value)*100):0)
</script>
