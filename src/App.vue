<template>
  <div class="h-full flex flex-col relative z-10">
    <!-- 粒子背景(仅桌面 + 支持 WebGL) -->
    <ParticleBg v-if="isDesktop && webgl" />

    <!-- 顶部导航 -->
    <header class="flex items-center justify-between px-4 md:px-6 py-3 glass border-b border-tech-border relative z-10">
      <div class="flex items-center gap-3">
        <div class="w-1 h-8 md:h-9 bg-tech-green rounded shadow-glow"></div>
        <div>
          <h1 class="text-base md:text-lg font-semibold neon text-tech-green tracking-wide">财务共享中心 · 结账进度看板</h1>
          <p class="hidden md:block text-[11px] text-tech-muted tracking-wider">FINANCIAL SHARED SERVICE CENTER · CLOSING PROGRESS</p>
        </div>
      </div>
      <div class="flex items-center gap-2 md:gap-4">
        <nav class="flex glass rounded-lg p-0.5">
          <button
            v-for="n in nav"
            :key="n.key"
            @click="setView(n.key)"
            :class="['px-3 md:px-4 py-1.5 text-xs md:text-sm rounded transition', store.view === n.key ? 'bg-tech-green/20 text-tech-green' : 'text-tech-muted hover:text-tech-green']"
          >
            {{ n.label }}
          </button>
        </nav>
        <div class="hidden sm:flex items-center gap-1.5 text-xs text-tech-green">
          <span class="w-1.5 h-1.5 rounded-full bg-tech-green live-dot"></span>实时
        </div>
        <select
          v-if="store.view === 'dashboard'"
          v-model="store.currentPeriod"
          @change="onPeriodChange"
          class="bg-tech-panel border border-tech-border rounded-md px-2 py-1.5 text-sm text-tech-green outline-none focus:border-tech-green"
        >
          <option v-for="p in store.periods" :key="p" :value="p" class="bg-tech-panel">{{ p }}</option>
        </select>
      </div>
    </header>

    <!-- 主体视图 -->
    <main class="flex-1 flex flex-col min-h-0 relative z-10 overflow-hidden">
      <Dashboard v-if="store.view === 'dashboard'" />
      <Manage v-else-if="store.view === 'manage'" />
    </main>

    <!-- 完成闪光 -->
    <div v-if="store.flash > 0" :key="'flash' + store.flash" class="flash-overlay"></div>

    <!-- toast -->
    <div class="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
      <transition-group name="toast">
        <div v-for="t in store.toasts" :key="t.id" class="glass rounded-lg px-4 py-2 text-sm text-tech-green neon shadow-glowsoft whitespace-nowrap">
          {{ t.msg }}
        </div>
      </transition-group>
    </div>

    <!-- 里程碑横幅 -->
    <div
      v-if="banner"
      :key="banner"
      class="fixed top-1/3 left-1/2 z-50 text-center pointer-events-none"
      style="transform: translate(-50%, 0); animation: bannerIn 0.5s ease-out"
    >
      <div class="text-2xl md:text-4xl font-bold text-tech-green neon drop-shadow">{{ banner }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import confetti from 'canvas-confetti'
import { store, init, loadPeriod, isDone, setView } from './data/store'
import { hasWebGL } from './utils/webgl'
import ParticleBg from './components/ParticleBg.vue'
import Dashboard from './components/Dashboard.vue'
import Manage from './components/Manage.vue'

const nav = [
  { key: 'dashboard', label: '看板' },
  { key: 'manage', label: '管理' },
]

const isDesktop = ref(window.matchMedia('(min-width: 768px)').matches)
const webgl = ref(hasWebGL())
function onResize() {
  isDesktop.value = window.matchMedia('(min-width: 768px)').matches
}
onMounted(() => {
  init()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

const done = computed(() => store.units.filter((u) => isDone(u.id)).length)
const total = computed(() => store.units.length)

const banner = ref(null)
let prevDone = null
let lastMilestone = 0

watch(done, (n) => {
  if (prevDone === null) {
    prevDone = n
    return
  }
  if (n > prevDone && store.currentPeriod === store.realCurrentPeriod) {
    for (const m of [50, 75, 100]) {
      const thr = Math.ceil((total.value * m) / 100)
      if (n >= thr && prevDone < thr && lastMilestone < m) {
        lastMilestone = m
        celebrate(m)
      }
    }
  }
  prevDone = n
})

watch(
  () => store.currentPeriod,
  () => {
    prevDone = done.value
    lastMilestone = 0
    for (const m of [50, 75, 100]) {
      if (done.value >= Math.ceil((total.value * m) / 100)) lastMilestone = m
    }
  }
)

function celebrate(m) {
  const colors = ['#00FF9C', '#10F5A0', '#00C9B6']
  confetti({ particleCount: 130, spread: 72, origin: { y: 0.6 }, colors })
  if (m === 100) {
    confetti({ particleCount: 220, spread: 130, origin: { y: 0.5 }, colors })
    banner.value = '🏆 本月结账全部完成!'
  } else {
    banner.value = `已完成 ${m}%! 继续冲刺 💪`
  }
  setTimeout(() => (banner.value = null), 3600)
}

async function onPeriodChange() {
  await loadPeriod(store.currentPeriod)
}
</script>
