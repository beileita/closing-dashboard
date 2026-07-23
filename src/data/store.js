// ============================================================
// 全局状态 + 同步架构 v7
//
// CloudBase watch() 实时推送替代轮询。
// Progress 和 Units 各有一个长连接监听器，
// 任意客户端写入 → CloudBase 推送到所有客户端 → 更新响应式 store。
//
// 关键设计：
//   1. Toggle：乐观 UI + _pendingToggle 防重复通知
//   2. Units CRUD：直接写入 CloudBase，watch 推送更新
//   3. Reset：递增 gen → 重启 progress watcher
//   4. 降级：watch() 失败时回退到 3 秒轮询
//
// 前置条件（用户需手动配置）：
//   CloudBase 控制台 → 数据库 → 所有集合 → 权限设置 →
//   {"read": "auth != null", "write": "auth != null"}
// ============================================================

import { reactive } from 'vue'
import {
  backend,
  watchProgress,
  watchUnits,
} from './backend'

// ---- 响应式全局 store ----
export const store = reactive({
  units: [],
  progress: {},
  realCurrentPeriod: '',
  currentPeriod: '',
  periods: [],
  selectedUnitId: null,
  selectedTab: 'all',
  expanded: new Set(),
  loading: true,
  deadline: null,
  connectError: null,
  view: 'dashboard',
  logs: [],
  adminAuthed: false,
  toasts: [],
  flash: 0,
  pulseUnitId: null,
  mobileView: 'map',
  theme: (localStorage.getItem('closing_theme') || 'dark'),
})

// ---- 主题切换 ----
export function toggleTheme() {
  store.theme = store.theme === 'dark' ? 'light' : 'dark'
  localStorage.setItem('closing_theme', store.theme)
  applyTheme()
}
export function applyTheme() {
  document.documentElement.setAttribute('data-theme', store.theme)
}

// ---- 工具函数 ----
function monthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

let toastSeq = 0
export function addToast(msg, type = 'ok') {
  const id = ++toastSeq
  store.toasts.push({ id, msg, type })
  setTimeout(() => {
    store.toasts = store.toasts.filter(t => t.id !== id)
  }, 3200)
}

// ---- 监听器引用 ----
let _progressWatcher = null
let _unitsWatcher = null
let _prevProgress = {}
let _initPhase = true
let _pendingToggle = null // { unitId, timer }

// ---- 轮询降级 ----
let _pollTimer = null

function fallbackToPolling() {
  if (_pollTimer) return
  console.log('[store] watch failed — falling back to 3s polling')
  _pollTimer = setInterval(pollProgress, 3000)
  // 立即执行一次
  pollProgress()
}

function stopPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer)
    _pollTimer = null
  }
}

async function pollProgress() {
  if (store.currentPeriod !== store.realCurrentPeriod) return
  try {
    const fresh = await backend.getProgress(store.realCurrentPeriod)
    for (const unitId of Object.keys(fresh)) {
      const was = _prevProgress[unitId]
      const now = fresh[unitId]
      if (now.done && (!was || !was.done)) {
        // 跳过自己的 pending toggle
        if (_pendingToggle && _pendingToggle.unitId === unitId) {
          _pendingToggle = null
          continue
        }
        store.flash++
        store.pulseUnitId = unitId
        const u = store.units.find(x => x.id === unitId)
        addToast(`✓ ${u ? u.name : '单位'} 已完成结账`, 'ok')
      }
    }
    _prevProgress = JSON.parse(JSON.stringify(fresh))
    store.progress = fresh
  } catch (e) {
    /* 静默重试 */
  }
}

// ---- Progress 实时监听 ----

function startProgressWatch(period, gen) {
  // 先关闭旧的
  if (_progressWatcher) {
    _progressWatcher.close()
    _progressWatcher = null
  }
  _initPhase = true

  _progressWatcher = watchProgress(
    period,
    gen,
    // onChange
    (progress, changes) => {
      const isInit =
        changes &&
        changes.length > 0 &&
        changes.every(c => c.dataType === 'init')

      // 更新 store
      store.progress = progress

      // 跳过 init 阶段的业务通知
      if (!isInit && !_initPhase && changes) {
        for (const change of changes) {
          if (change.dataType !== 'update' && change.dataType !== 'add') continue
          const uid = change.doc?.unitId
          if (!uid) continue

          // 检查是否是我们自己的 toggle（已通过乐观 UI 处理）
          if (_pendingToggle && _pendingToggle.unitId === uid) {
            clearTimeout(_pendingToggle.timer)
            _pendingToggle = null
            continue
          }

          // 其他设备标记完成 → 通知
          const was = _prevProgress[uid]
          const now = progress[uid]
          if (now && now.done && (!was || !was.done)) {
            store.flash++
            store.pulseUnitId = uid
            const u = store.units.find(x => x.id === uid)
            addToast(`✓ ${u ? u.name : '单位'} 已完成结账`, 'ok')
          }
        }
      }

      _prevProgress = JSON.parse(JSON.stringify(progress))
      if (_initPhase) _initPhase = false
    },
    // onError → 降级轮询
    (err) => {
      console.warn('[store] progress watch error:', err?.message || err)
      fallbackToPolling()
    }
  )
}

// ---- Units 实时监听 ----

function startUnitsWatch() {
  if (_unitsWatcher) {
    _unitsWatcher.close()
    _unitsWatcher = null
  }

  _unitsWatcher = watchUnits(
    // onChange — 直接更新 store.units
    (units) => {
      store.units = units
    },
    // onError
    (err) => {
      console.warn('[store] units watch error:', err?.message || err)
    }
  )
}

// ---- 初始化 ----

export async function init() {
  // 0. 应用主题
  applyTheme()

  // 1. 加载单位（初始快照）
  try {
    store.units = await backend.getUnits()
  } catch (e) {
    store.connectError = e.message || 'CloudBase 连接失败'
    store.loading = false
    return
  }

  // 2. 设置周期
  const now = new Date()
  store.realCurrentPeriod = monthStr(now)
  store.currentPeriod = store.realCurrentPeriod
  store.periods = [
    store.realCurrentPeriod,
    monthStr(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
  ]

  // 3. 加载截止时间
  try {
    store.deadline = await backend.getDeadline()
  } catch (e) {
    console.warn('Load deadline failed:', e.message)
  }

  // 4. 获取当前 gen 并启动实时监听
  try {
    const gen = await backend.getCurrentGen()
    const progress = await backend.getProgress(store.currentPeriod)
    store.progress = progress
    _prevProgress = JSON.parse(JSON.stringify(progress))

    // 启动 watcher（失败自动降级轮询）
    startProgressWatch(store.currentPeriod, gen)
  } catch (e) {
    console.warn('Progress init failed, using polling fallback:', e.message)
    fallbackToPolling()
  }

  // 5. 启动 units 监听
  try {
    startUnitsWatch()
  } catch (e) {
    console.warn('Units watch start failed:', e.message)
  }

  store.loading = false
}

// ---- 周期切换 ----

export async function loadPeriod(period) {
  stopPolling()
  if (_progressWatcher) {
    _progressWatcher.close()
    _progressWatcher = null
  }

  store.currentPeriod = period
  store.selectedUnitId = null

  try {
    const gen = await backend.getCurrentGen()
    const progress = await backend.getProgress(period)
    store.progress = progress
    _prevProgress = JSON.parse(JSON.stringify(progress))

    if (period === store.realCurrentPeriod) {
      // 切回当前周期 → 重启实时监听
      startProgressWatch(period, gen)
    }
    // 历史周期不需要实时监听
  } catch (e) {
    console.warn('Load period failed:', e.message)
  }
}

// ---- 切换单位状态（乐观 UI） ----

export async function toggleUnit(unitId) {
  if (store.currentPeriod !== store.realCurrentPeriod) return

  const was = store.progress[unitId]

  // 乐观更新：立即反映到 UI
  const optimistic = {
    done: !(was && was.done),
    doneAt: was && was.done ? null : Date.now(),
    operator: 'me',
    device: localStorage.getItem('closing_dev_id') || 'me',
  }
  store.progress = { ...store.progress, [unitId]: optimistic }

  // 如果标记完成 → 立即 toast + flash（乐观）
  if (optimistic.done) {
    const u = store.units.find(x => x.id === unitId)
    addToast(`✓ ${u ? u.name : '单位'} 已完成结账`, 'ok')
    store.flash++
    store.pulseUnitId = unitId
  }

  // 标记 pending：之后 watch 回推时跳过（避免重复通知）
  _pendingToggle = {
    unitId,
    timer: setTimeout(() => {
      _pendingToggle = null
    }, 5000), // 5 秒超时，防止网络延迟导致永久跳过
  }

  try {
    await backend.toggle(unitId, store.currentPeriod)
    // watch 会回推确认；这里不需要额外处理
  } catch (e) {
    // 写入失败 → 回滚
    clearTimeout(_pendingToggle.timer)
    _pendingToggle = null
    store.progress = {
      ...store.progress,
      [unitId]: was || { done: false, doneAt: null, operator: null, device: null },
    }
    addToast('操作失败：' + (e.message || '网络错误'), 'err')
  }
}

// ---- 单位选中 / 筛选 / 视图 ----

export function selectUnit(unitId) {
  store.selectedUnitId = unitId
}
export function setTab(tab) {
  store.selectedTab = tab
}
export function setView(v) {
  store.view = v
  if (v === 'manage') loadLogs()
}
export function setMobileView(v) {
  store.mobileView = v
}
export function isDone(unitId) {
  return !!(store.progress[unitId] && store.progress[unitId].done)
}

// ---- 单位 CRUD ----
// 写入 CloudBase，watch 推送更新到所有客户端（包括自己）

export async function addUnit(data) {
  try {
    const result = await backend.addUnit(data)
    // watch 会推送新单位到 store.units
    addToast('单位已新增', 'ok')
    return result
  } catch (e) {
    addToast('新增失败：' + (e.message || '未知错误'), 'err')
    throw e
  }
}

export async function updateUnit(id, data) {
  try {
    await backend.updateUnit(id, data)
    // watch 会推送更新到 store.units
    addToast('单位已更新', 'ok')
  } catch (e) {
    addToast('编辑失败：' + (e.message || '未知错误'), 'err')
    throw e
  }
}

export async function deleteUnit(id) {
  try {
    await backend.deleteUnit(id)
    // watch 会推送删除到 store.units（deleted 文档被过滤）
    addToast('单位已删除', 'ok')
  } catch (e) {
    addToast('删除失败：' + (e.message || '未知错误'), 'err')
    throw e
  }
}

// ---- 日志 / 配置 ----

export async function loadLogs() {
  try {
    store.logs = await backend.getLogs()
  } catch (e) {
    /* 静默 */
  }
}
export async function loadDeadline() {
  store.deadline = await backend.getDeadline()
}
export async function setDeadline(ts) {
  store.deadline = await backend.setDeadline(ts)
  addToast('截止时间已更新', 'ok')
}
export async function verifyAdmin(pwd) {
  store.adminAuthed = await backend.verifyAdmin(pwd)
  return store.adminAuthed
}
export async function changePwd(o, n) {
  const ok = await backend.changePwd(o, n)
  if (ok) {
    await loadLogs()
    addToast('密码已修改', 'ok')
  }
  return ok
}

// ---- 重置周期 ----

export async function resetPeriod() {
  try {
    // 递增 gen → 旧文档集体失效
    const newGen = await backend.resetPeriod(store.currentPeriod)
    addToast('当前周期已重置', 'ok')

    // 本地立即清空
    const fallback = {}
    for (const u of store.units) {
      fallback[u.id] = {
        done: false,
        doneAt: null,
        operator: null,
        device: null,
      }
    }
    store.progress = fallback
    _prevProgress = JSON.parse(JSON.stringify(fallback))

    // 重启 progress watcher（新 gen）
    startProgressWatch(store.currentPeriod, newGen)

    await loadLogs()
  } catch (e) {
    addToast('重置失败：' + (e.message || '未知错误'), 'err')
  }
}

// ---- 清理 ----

export function dispose() {
  stopPolling()
  if (_progressWatcher) {
    _progressWatcher.close()
    _progressWatcher = null
  }
  if (_unitsWatcher) {
    _unitsWatcher.close()
    _unitsWatcher = null
  }
}
