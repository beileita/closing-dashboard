<template>
  <div class="h-full flex flex-col relative z-10">
    <ParticleBg v-if="isDesktop && webgl" />

    <!-- Compact Top Bar -->
    <header class="relative z-10 flex items-center gap-3 px-4 py-2.5">
      <div class="flex items-center gap-2 shrink-0">
        <span class="w-1 h-6 rounded-full" style="background:#008A4C;box-shadow:0 0 10px rgba(0,138,76,0.5)"></span>
        <span class="text-sm font-bold text-white tracking-tight">青岛啤酒财务共享中心</span>
      </div>

      <div :class="['flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs', cdBg]">
        <span class="text-gray-500 text-[10px]">截止</span>
        <span v-if="cd.overdue" class="text-red-400 font-bold text-xs">已超期</span>
        <template v-else>
          <span class="tabular-nums font-bold text-white">{{ cd.days }}</span><span class="text-gray-500">天</span>
          <span class="tabular-nums font-bold text-white">{{ cd.hours }}</span><span class="text-gray-500">:</span>
          <span class="tabular-nums font-bold text-white">{{ cd.mins }}</span><span class="text-gray-500">:</span>
          <span class="tabular-nums font-bold text-white">{{ cd.secs }}</span>
        </template>
      </div>

      <div class="flex-1"></div>

      <nav class="flex card p-0.5">
        <button v-for="n in nav" :key="n.key" @click="setView(n.key)"
          :class="['px-3 py-1.5 text-xs rounded-lg transition font-medium', store.view===n.key?'bg-green-700/15 text-green-400':'text-gray-500 hover:text-gray-300']">
          {{ n.label }}
        </button>
      </nav>

      <span class="flex items-center gap-1 text-xs text-green-400 ml-1"><span class="w-1.5 h-1.5 rounded-full live-dot" style="background:#008A4C"></span></span>
      <select v-if="store.view==='dashboard'" v-model="store.currentPeriod" @change="onPeriodChange"
        class="card px-2.5 py-1.5 text-xs text-gray-300 outline-none cursor-pointer">
        <option v-for="p in store.periods" :key="p" :value="p" class="bg-gray-800">{{ p }}</option>
      </select>
    </header>

    <main class="flex-1 flex flex-col min-h-0 relative z-10 overflow-hidden">
      <Dashboard v-if="store.view==='dashboard'" />
      <Manage v-else-if="store.view==='manage'" />
    </main>

    <div v-if="store.flash>0" :key="'flash'+store.flash" class="flash-overlay"></div>
    <div class="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
      <transition-group name="toast">
        <div v-for="t in store.toasts" :key="t.id" class="card-elevated px-4 py-2 text-sm text-white font-medium" style="box-shadow:0 0 16px rgba(0,138,76,0.25)">{{ t.msg }}</div>
      </transition-group>
    </div>
    <div v-if="banner" :key="banner" class="fixed top-1/3 left-1/2 z-50 text-center pointer-events-none" style="transform:translate(-50%,0);animation:bannerIn 0.5s ease-out">
      <div class="text-2xl md:text-4xl font-bold text-green-400">{{ banner }}</div>
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

const nav = [{ key:'dashboard',label:'看板' },{ key:'manage',label:'管理' }]

const isDesktop = ref(true), webgl = ref(false)
function onResize() { isDesktop.value = window.matchMedia('(min-width:768px)').matches }
onMounted(() => { onResize(); webgl.value = hasWebGL(); window.addEventListener('resize',onResize); init() })
onBeforeUnmount(() => { window.removeEventListener('resize',onResize); clearInterval(_t) })

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
watch(done, n => {
  if (prevDone===null){prevDone=n;return}
  if (n>prevDone && store.currentPeriod===store.realCurrentPeriod) {
    for(const m of[50,75,100]){ const thr=Math.ceil((total.value*m)/100); if(n>=thr&&prevDone<thr&&lastMilestone<m){lastMilestone=m;celebrate(m)} }
  }
  prevDone=n
})
watch(()=>store.currentPeriod,()=>{ prevDone=done.value;lastMilestone=0; for(const m of[50,75,100]){if(done.value>=Math.ceil((total.value*m)/100))lastMilestone=m} })
function celebrate(m){
  confetti({particleCount:140,spread:75,origin:{y:0.6},colors:['#008A4C','#22c55e','#fbbf24']})
  if(m===100){confetti({particleCount:260,spread:140,origin:{y:0.5},colors:['#008A4C','#22c55e','#fbbf24']});banner.value='🏆 本月结账全部完成!'}
  else if(m===75)banner.value='🔥 已完成 75%!'
  else banner.value='⚡ 已完成 50%!'
  setTimeout(()=>banner.value=null,4000)
}
async function onPeriodChange(){await loadPeriod(store.currentPeriod)}
</script>
