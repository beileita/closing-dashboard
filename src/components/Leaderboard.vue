<template>
  <div :class="mode==='dock' ? (compact ? 'shrink-0 w-[340px] h-full' : 'shrink-0 w-[380px] h-full') : 'fixed inset-0 z-50'">
    <!-- 浮层 / 全屏模式的遮罩 -->
    <div v-if="mode!=='dock'" class="lb-backdrop absolute inset-0 bg-black/50" @click="closeLeaderboard"></div>

    <aside
      :role="mode==='dock' ? 'region' : 'dialog'"
      :aria-modal="mode!=='dock' ? 'true' : undefined"
      aria-label="排行榜"
      :class="['lb-panel flex flex-col h-full', mode==='dock'
        ? 'w-full border-l'
        : (mode==='overlay'
          ? 'absolute right-0 top-0 bottom-0 w-[360px] max-w-[92vw] border-l shadow-2xl'
          : 'absolute right-0 top-0 bottom-0 w-full border-l')]"
      :style="{ background:'var(--bg-card)', borderColor:'var(--border)' }">

      <!-- 标题 -->
      <div class="flex items-start justify-between gap-3 px-4 py-3 shrink-0" :style="{borderBottom:'1px solid var(--border)'}">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-base leading-none">🏆</span>
            <h2 class="text-sm font-bold" :style="{color:'var(--text-primary)'}">排行榜</h2>
            <span class="text-[10px] px-1.5 py-0.5 rounded-md font-mono" :style="{color:'var(--text-secondary)',background:'var(--bg-card-alt)',border:'1px solid var(--border)'}">{{ sourcePeriod }}</span>
          </div>
          <div class="text-[11px] mt-1" :style="{color:'var(--text-muted)'}">按完成时间先后排序 · 当前会计期</div>
        </div>
        <button @click="closeLeaderboard" aria-label="关闭排行榜"
          class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm transition hover:bg-gray-700/20"
          :style="{color:'var(--text-muted)'}">✕</button>
      </div>

      <!-- 看板停在归档月时的提示 -->
      <div v-if="isArchivedView" class="mx-3 mt-3 px-3 py-2 rounded-lg text-[11px] leading-relaxed shrink-0"
        :style="{background:'var(--accent-dim)',border:'1px solid var(--border-accent)',color:'var(--text-secondary)'}">
        看板正在查看 {{ store.currentPeriod }} 归档，排行榜仍为当前会计期 {{ store.realCurrentPeriod }}
      </div>

      <!-- 汇总 -->
      <div class="px-4 pt-3 pb-2 shrink-0">
        <div class="flex items-end justify-between mb-2">
          <div class="flex items-baseline gap-1 text-xs" :style="{color:'var(--text-secondary)'}">
            <span class="text-xl font-bold tabular-nums" :style="{color:'var(--accent)'}">{{ doneCount }}</span>
            <span class="tabular-nums">/ {{ total }}</span>
            <span class="ml-1">已完成</span>
          </div>
          <span class="font-mono text-xs" :style="{color:'var(--text-secondary)'}">{{ pct }}%</span>
        </div>
        <div class="h-1.5 rounded-full overflow-hidden" :style="{background:trackBg}">
          <div class="h-full rounded-full transition-all duration-500" :style="{width:pct+'%',background:barBg}"></div>
        </div>
      </div>

      <!-- 榜单 -->
      <div ref="listEl" class="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
        <div v-if="loading" class="text-center text-xs py-12" :style="{color:'var(--text-muted)'}">加载当前会计期数据…</div>
        <template v-else-if="rows.length">
          <transition-group name="lb-row" tag="div" class="relative">
            <button v-for="(row, i) in rows" :key="row.unit.id" :data-lbid="row.unit.id" @click="onRowClick(row.unit)"
              :class="['lb-row w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors duration-150',
                row.unit.id===store.selectedUnitId ? 'lb-selected' : 'hover:bg-gray-700/20',
                row.unit.id===flashId ? 'lb-flash' : '']">
              <span :class="['rank-badge', rankClass(i)]">{{ i + 1 }}</span>
              <span class="flex-1 min-w-0">
                <span class="block text-xs font-medium truncate" :title="row.unit.name" :style="{color:'var(--text-primary)'}">{{ row.unit.name }}</span>
                <span class="block text-[10px] truncate mt-0.5" :style="{color:'var(--text-muted)'}">{{ row.unit.province }} · {{ row.unit.city }}</span>
              </span>
              <span class="font-mono text-[10px] shrink-0" :style="{color:'var(--text-secondary)'}">{{ fmtTime(row.doneAt) }}</span>
            </button>
          </transition-group>
        </template>
        <div v-else class="text-center py-14">
          <div class="text-2xl mb-2 opacity-40">🏁</div>
          <div class="text-xs" :style="{color:'var(--text-muted)'}">本周期还没有单位完成结账</div>
        </div>
      </div>

      <!-- 底部 -->
      <div class="px-4 py-2.5 flex items-center justify-between text-[11px] shrink-0"
        :style="{borderTop:'1px solid var(--border)',color:'var(--text-muted)'}">
        <span>未完成 <span class="font-mono" :style="{color:'var(--text-secondary)'}">{{ undoneCount }}</span> 家</span>
        <span v-if="isArchivedView">当前会计期</span>
        <span v-else>共 {{ total }} 家单位</span>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {
  store, closeLeaderboard, fetchPeriodProgress, loadPeriod, selectUnit, setView, setMobileView,
} from '../data/store'

const props = defineProps({
  // dock: ≥1280 停靠列；overlay: 768–1279 浮层；full: <768 全屏
  mode: { type: String, default: 'dock' },
  // 1280–1439 停靠列收窄到 340px，给地图让空间
  compact: { type: Boolean, default: false },
})

const listEl = ref(null)
const flashId = ref(null)
let flashTimer = null

// ---- 数据源：当前会计期；看板停在归档月时单独拉快照 ----
const snapshot = ref(null)
const snapshotLoading = ref(false)
let snapshotToken = 0

const isArchivedView = computed(() => store.currentPeriod !== store.realCurrentPeriod)
const sourcePeriod = computed(() => store.realCurrentPeriod || store.currentPeriod)
const progressMap = computed(() => (isArchivedView.value ? (snapshot.value || {}) : store.progress))
const loading = computed(() => isArchivedView.value && snapshotLoading.value)

async function refreshSnapshot() {
  if (!isArchivedView.value) {
    snapshot.value = null
    return
  }
  const period = store.realCurrentPeriod
  if (!period) return
  const token = ++snapshotToken
  snapshotLoading.value = true
  try {
    const data = await fetchPeriodProgress(period)
    if (token === snapshotToken && period === store.realCurrentPeriod) snapshot.value = data
  } finally {
    if (token === snapshotToken) snapshotLoading.value = false
  }
}
watch(() => [store.currentPeriod, store.realCurrentPeriod], refreshSnapshot, { immediate: true })

// ---- 榜单：按 doneAt 升序，缺失时间的排最后 ----
const rows = computed(() => {
  const out = []
  for (const unit of store.units) {
    const rec = progressMap.value[unit.id]
    if (rec && rec.done) out.push({ unit, doneAt: rec.doneAt || null })
  }
  out.sort((a, b) => {
    if (a.doneAt && b.doneAt) return a.doneAt - b.doneAt
    if (a.doneAt) return -1
    if (b.doneAt) return 1
    return (a.unit.name || '').localeCompare(b.unit.name || '', 'zh-CN')
  })
  return out
})

const total = computed(() => store.units.length)
const doneCount = computed(() => rows.value.length)
const undoneCount = computed(() => Math.max(0, total.value - doneCount.value))
const pct = computed(() => (total.value ? Math.round((doneCount.value / total.value) * 100) : 0))

const trackBg = computed(() => (store.theme === 'dark' ? '#1e293b' : '#e2e6ed'))
const barBg = computed(() => (store.theme === 'dark'
  ? 'linear-gradient(90deg,#00c26e,#22c55e)'
  : 'linear-gradient(90deg,#008A4C,#16a34a)'))

function rankClass(i) {
  return i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-rest'
}
function fmtTime(ts) {
  if (!ts) return '时间未知'
  const d = new Date(ts)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ---- 交互 ----
async function onRowClick(unit) {
  if (store.view !== 'dashboard') setView('dashboard')
  // 归档月先切回当前会计期，保证地图状态与榜单一致
  if (isArchivedView.value) await loadPeriod(store.realCurrentPeriod)
  selectUnit(unit.id)
  // 窄屏（浮层/全屏）自动收起，宽屏停靠模式保留
  if (props.mode !== 'dock') {
    closeLeaderboard()
    if (props.mode === 'full') setMobileView('map')
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') closeLeaderboard()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(flashTimer)
})

// 实时更新：新完成的单位短暂高亮
watch(() => rows.value.map(r => r.unit.id), (ids, old) => {
  if (!old || !old.length || store.currentPeriod !== store.realCurrentPeriod) return
  const prev = new Set(old)
  const added = ids.find(id => !prev.has(id))
  if (!added) return
  flashId.value = added
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { flashId.value = null }, 1600)
})

// 选中单位时滚动到对应行
watch(() => store.selectedUnitId, async id => {
  if (!id) return
  await nextTick()
  const node = listEl.value?.querySelector(`[data-lbid="${id}"]`)
  if (node) node.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
})
</script>

<style scoped>
.lb-panel {
  animation: lbSlide 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes lbSlide {
  from { opacity: 0; transform: translateX(28px); }
  to { opacity: 1; transform: none; }
}
.lb-backdrop {
  animation: lbFade 0.2s ease-out;
}
@keyframes lbFade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.rank-badge {
  width: 22px; height: 22px;
  border-radius: 9999px;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.rank-1 {
  background: linear-gradient(135deg, #f6d365, #d99a1e);
  color: #3d2b00;
  box-shadow: 0 0 10px rgba(217, 154, 30, 0.3);
}
.rank-2 {
  background: linear-gradient(135deg, #e7edf4, #a8b5c4);
  color: #2b3540;
}
.rank-3 {
  background: linear-gradient(135deg, #e9b78d, #b87a44);
  color: #3a210f;
}
.rank-rest {
  background: var(--bg-card-alt);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.lb-selected {
  background: var(--accent-dim);
  box-shadow: inset 2px 0 0 var(--accent);
}
.lb-flash {
  animation: lbFlash 1.6s ease-out;
}
@keyframes lbFlash {
  0% { background: var(--accent-dim); }
  100% { background: transparent; }
}

/* 榜单重排动画 */
.lb-row-move { transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.lb-row-enter-active, .lb-row-leave-active { transition: opacity 0.25s ease; }
.lb-row-enter-from, .lb-row-leave-to { opacity: 0; }
.lb-row-leave-active { position: absolute; width: 100%; }
</style>
