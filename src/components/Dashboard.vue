<template>
  <div class="flex-1 flex flex-col min-h-0 px-4 md:px-6 pb-4 md:pb-6">
    <!-- 进度条 -->
    <div class="py-3 flex items-center gap-3 md:gap-4">
      <span class="text-xs md:text-sm text-tech-muted whitespace-nowrap">当月结账进度</span>
      <div class="flex-1 h-2 md:h-2.5 bg-tech-panel rounded-full overflow-hidden border border-tech-border">
        <div class="h-full rounded-full transition-all duration-700" :style="{ width: pct + '%', background: 'linear-gradient(90deg,#00C9B6,#00FF9C)', boxShadow: '0 0 12px #00FF9C' }"></div>
      </div>
      <span class="font-mono text-tech-green neon text-xs md:text-sm whitespace-nowrap">{{ done }}/{{ total }} ({{ pct }}%)</span>
      <span class="hidden md:inline text-xs text-tech-muted whitespace-nowrap">截止 {{ store.currentPeriod }} 月末</span>
    </div>

    <!-- 移动端 地图/列表 切换 -->
    <div class="md:hidden flex glass rounded-lg p-1 mb-3">
      <button @click="setMobileView('map')" :class="['flex-1 py-1.5 text-sm rounded transition', store.mobileView === 'map' ? 'bg-tech-green/20 text-tech-green' : 'text-tech-muted']">🗺 地图</button>
      <button @click="setMobileView('list')" :class="['flex-1 py-1.5 text-sm rounded transition', store.mobileView === 'list' ? 'bg-tech-green/20 text-tech-green' : 'text-tech-muted']">📋 列表</button>
    </div>

    <!-- 主体 -->
    <div class="flex-1 flex gap-4 min-h-0">
      <div :class="['glass rounded-xl overflow-hidden flex flex-col w-full md:w-[360px] md:shrink-0', store.mobileView === 'list' ? 'flex' : 'hidden md:flex']">
        <UnitList />
      </div>
      <div :class="['flex-1 glass rounded-xl overflow-hidden relative min-h-[300px]', store.mobileView === 'map' ? 'flex' : 'hidden md:flex']">
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

const done = computed(() => store.units.filter((u) => isDone(u.id)).length)
const total = computed(() => store.units.length)
const pct = computed(() => (total.value ? Math.round((done.value / total.value) * 100) : 0))
</script>
