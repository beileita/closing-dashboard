<template>
  <div class="h-full flex flex-col relative z-10">
    <ParticleBg v-if="particlesReady && isDesktop && webgl" />

    <!-- Mobile: full-width title bar at top -->
    <div class="md:hidden relative z-10 px-4 pt-2.5 pb-1.5">
      <div class="card px-4 py-2 text-center relative">
        <span class="text-sm font-bold tracking-wider" :style="{color:'var(--text-primary)'}">青岛啤酒结账进度看板</span>
        <button @click="toggleLeaderboard" aria-label="排行榜" :aria-expanded="store.leaderboardOpen"
          :class="['absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-sm transition',
            store.leaderboardOpen ? 'bg-green-700/15 text-green-400' : 'text-gray-500']">🏆</button>
      </div>
    </div>

    <!-- Compact Top Bar -->
    <header class="relative z-10 flex items-center gap-3 px-4 py-2.5">
      <div class="flex items-center gap-2 shrink-0">
        <span class="w-1 h-6 rounded-full" :style="{background:store.theme==='dark'?'#00c26e':'#008A4C',boxShadow:store.theme==='dark'?'0 0 10px rgba(0,194,110,0.5)':'0 0 8px rgba(0,138,76,0.35)'}"></span>
        <span class="text-sm font-bold tracking-tight hidden md:inline" :style="{color:'var(--text-secondary)'}">青岛啤酒财务共享中心</span>
      </div>

      <div :class="['flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs shrink-0', cdBg]">
        <span class="text-gray-500 text-[10px]">截止</span>
        <span v-if="cd.overdue" class="text-red-400 font-bold text-xs">已超期</span>
        <template v-else>
          <span class="tabular-nums font-bold text-white">{{ cd.days }}</span><span class="text-gray-500">天</span>
          <span class="tabular-nums font-bold text-white">{{ cd.hours }}</span><span class="text-gray-500">:</span>
          <span class="tabular-nums font-bold text-white">{{ cd.mins }}</span><span class="text-gray-500">:</span>
          <span class="tabular-nums font-bold text-white">{{ cd.secs }}</span>
        </template>
      </div>

      <!-- Desktop: title in header -->
      <div class="flex-1 text-center hidden md:block">
        <span class="card px-4 py-1.5 text-sm md:text-base font-bold tracking-wider inline-block" :style="{color:'var(--text-primary)'}">青岛啤酒结账进度看板</span>
      </div>

      <!-- Mobile: spacer -->
      <div class="flex-1 md:hidden"></div>

      <!-- Theme toggle -->
      <button @click="onToggleTheme" class="theme-toggle" :title="store.theme==='dark'?'切换日间模式':'切换夜间模式'">
        {{ store.theme==='dark'?'☀️':'🌙' }}
      </button>

      <nav class="flex card p-0.5">
        <button v-for="n in nav" :key="n.key" @click="setView(n.key)"
          :class="['px-3 py-1.5 text-xs rounded-lg transition font-medium', store.view===n.key?'bg-green-700/15 text-green-400':'text-gray-500 hover:text-gray-300']">
          {{ n.label }}
        </button>
      </nav>

      <span class="flex items-center gap-1 text-xs ml-1" :style="{color:'var(--accent)'}"><span class="w-1.5 h-1.5 rounded-full live-dot" :style="{background:'var(--accent)'}"></span></span>
      <select v-if="store.view==='dashboard'" v-model="store.currentPeriod" @change="onPeriodChange"
        class="card px-2.5 py-1.5 text-xs text-gray-300 outline-none cursor-pointer">
        <option v-for="p in store.periods" :key="p" :value="p" class="bg-gray-800">{{ p }}</option>
      </select>

      <!-- 排行榜入口（桌面） -->
      <button @click="toggleLeaderboard" aria-label="排行榜" :aria-expanded="store.leaderboardOpen"
        :class="['hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition shrink-0',
          store.leaderboardOpen ? 'bg-green-700/15 text-green-400 border-green-600/30' : 'text-gray-500 border-transparent hover:text-green-400 hover:border-green-600/30']">
        <span class="text-sm leading-none">🏆</span>
        <span class="hidden xl:inline">排行榜</span>
      </button>
    </header>

    <div class="flex-1 flex min-h-0 relative z-10 overflow-hidden">
      <main class="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Dashboard v-if="store.view==='dashboard'" />
        <Manage v-else-if="store.view==='manage'" />
      </main>
      <Leaderboard v-if="store.leaderboardOpen" :mode="lbMode" />
    </div>

    <div v-if="store.flash>0" :key="'flash'+store.flash" class="flash-overlay"></div>
    <div class="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
      <transition-group name="toast">
        <div v-for="t in store.toasts" :key="t.id" class="card-elevated px-4 py-2 text-sm font-medium" :style="{color:'var(--text-primary)',boxShadow:store.theme==='dark'?'0 0 16px rgba(0,194,110,0.25)':'0 0 12px rgba(0,138,76,0.15)'}">{{ t.msg }}</div>
      </transition-group>
    </div>
    <div v-if="banner" :key="banner" class="fixed top-1/3 left-1/2 z-50 text-center pointer-events-none" style="transform:translate(-50%,0);animation:bannerIn 0.5s ease-out">
      <div class="text-2xl md:text-4xl font-bold" :style="{color:'var(--accent)'}">{{ banner }}</div>
    </div>

    <!-- Connection error -->
    <div v-if="store.connectError" class="fixed inset-0 z-[60] flex items-center justify-center connect-error-overlay">
      <div class="card-elevated p-8 max-w-md text-center">
        <div class="text-4xl mb-4">⚠️</div>
        <div class="text-lg font-bold mb-2" style="color:var(--text-primary)">连接失败</div>
        <div class="text-sm mb-1" style="color:var(--text-secondary)">{{ store.connectError }}</div>
        <div class="text-xs mt-3" style="color:var(--text-muted)">请确保 CloudBase 环境已正确配置<br/>检查 .env 中的 VITE_CLOUDBASE_ENV_ID</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, defineAsyncComponent } from 'vue'
import { store, init, loadPeriod, isDone, setView, dispose, toggleTheme, toggleLeaderboard } from './data/store'
import { hasWebGL } from './utils/webgl'
import Dashboard from './components/Dashboard.vue'

// 管理页、粒子背景、排行榜按需加载，不进入首屏包
const Manage = defineAsyncComponent(() => import('./components/Manage.vue'))
const ParticleBg = defineAsyncComponent(() => import('./components/ParticleBg.vue'))
const Leaderboard = defineAsyncComponent(() => import('./components/Leaderboard.vue'))

const nav = [{ key:'dashboard',label:'看板' },{ key:'manage',label:'管理' }]

const isDesktop = ref(true), webgl = ref(false), particlesReady = ref(false)
const viewportW = ref(typeof window !== 'undefined' ? window.innerWidth : 1440)
// ≥1280 停靠列；768–1279 浮层；<768 全屏
const lbMode = computed(() => viewportW.value >= 1280 ? 'dock' : viewportW.value >= 768 ? 'overlay' : 'full')
function onResize() {
  viewportW.value = window.innerWidth
  isDesktop.value = viewportW.value >= 768
}
onMounted(() => {
  onResize(); webgl.value = hasWebGL(); window.addEventListener('resize',onResize); init()
  // 装饰性粒子背景推迟到首屏空闲后再加载（Three.js ~174KB gzip）
  const start = () => { particlesReady.value = true }
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 3000 })
  else setTimeout(start, 1500)
})
onBeforeUnmount(() => { window.removeEventListener('resize',onResize); clearInterval(_t); dispose() })

const nowTs = ref(Date.now()), _t = setInterval(() => { nowTs.value = Date.now() }, 1000)

const cd = computed(() => {
  if (!store.deadline) return { days:'--',hours:'--',mins:'--',secs:'--',overdue:false }
  const r = store.deadline - nowTs.value
  if (r <= 0) return { days:'00',hours:'00',mins:'00',secs:'00',overdue:true }
  return { days:String(Math.floor(r/86400000)).padStart(2,'0'), hours:String(Math.floor((r%86400000)/3600000)).padStart(2,'0'), mins:String(Math.floor((r%3600000)/60000)).padStart(2,'0'), secs:String(Math.floor((r%60000)/1000)).padStart(2,'0'), overdue:false }
})
const cdBg = computed(() => {
  if (cd.value.overdue) return 'bg-red-950/30 border border-red-800/40'
  if (!store.deadline) return 'card'
  const r = store.deadline - nowTs.value
  if (r < 86400000) return 'bg-red-950/20 border border-red-800/30'
  if (r < 3*86400000) return 'bg-yellow-950/20 border border-yellow-800/30'
  return 'card'
})

const done = computed(() => store.units.filter(u=>isDone(u.id)).length), total = computed(() => store.units.length)
const banner = ref(null)
let prevDone = null, lastMilestone = 0
function syncMilestones() {
  prevDone = done.value
  lastMilestone = 0
  for (const m of [50,75,100]) {
    if (done.value >= Math.ceil((total.value*m)/100)) lastMilestone = m
  }
}
watch(done, n => {
  if (prevDone===null){prevDone=n;return}
  if (n>prevDone && store.currentPeriod===store.realCurrentPeriod) {
    for(const m of[50,75,100]){ const thr=Math.ceil((total.value*m)/100); if(n>=thr&&prevDone<thr&&lastMilestone<m){lastMilestone=m;celebrate(m)} }
  }
  prevDone=n
})
// 快照加载（初始化 / 切周期 / 重置）只重置基线，不算进度增长
watch(()=>store.progressRev, syncMilestones, { flush:'sync' })
watch(()=>store.currentPeriod, syncMilestones)
let confettiPromise = null
function loadConfetti() {
  if (!confettiPromise) confettiPromise = import('canvas-confetti').then(m => m.default)
  return confettiPromise
}
async function celebrate(m){
  let confetti = () => {}
  try { confetti = await loadConfetti() } catch (e) { console.warn('confetti load failed', e) }
  confetti({particleCount:140,spread:75,origin:{y:0.6},colors:store.theme==='dark'?['#00c26e','#22c55e','#fbbf24']:['#008A4C','#16a34a','#e8c547']})
  if(m===100){confetti({particleCount:260,spread:140,origin:{y:0.5},colors:store.theme==='dark'?['#00c26e','#22c55e','#fbbf24']:['#008A4C','#16a34a','#e8c547']});banner.value='🏆 本月结账全部完成!'}
  else if(m===75)banner.value='🔥 已完成 75%!'
  else banner.value='⚡ 已完成 50%!'
  setTimeout(()=>banner.value=null,4000)
}
async function onPeriodChange(){await loadPeriod(store.currentPeriod)}
function onToggleTheme(){toggleTheme()}
</script>
