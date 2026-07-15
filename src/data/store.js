import { reactive } from 'vue'
import { backend, startSimulation } from './backend'

export const store = reactive({
  units: [],
  progress: {}, // unitId -> { done, doneAt, operator, device }
  realCurrentPeriod: '',
  currentPeriod: '',
  periods: [],
  selectedUnitId: null,
  selectedTab: 'all',
  expanded: new Set(),
  loading: true,
  deadline: null, // 结账截止时间戳

  view: 'dashboard', // dashboard | maintenance | admin
  logs: [],
  adminAuthed: false,

  toasts: [],
  flash: 0,
  pulseUnitId: null,
  mobileView: 'map', // map | list(仅移动端)
})

function monthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

let toastSeq = 0
export function addToast(msg, type = 'ok') {
  const id = ++toastSeq
  store.toasts.push({ id, msg, type })
  setTimeout(() => {
    store.toasts = store.toasts.filter((t) => t.id !== id)
  }, 3200)
}

export async function init() {
  store.units = await backend.getUnits()
  const now = new Date()
  store.realCurrentPeriod = monthStr(now)
  store.currentPeriod = store.realCurrentPeriod
  store.periods = [store.realCurrentPeriod, monthStr(new Date(now.getFullYear(), now.getMonth() - 1, 1))]
  store.deadline = await backend.getDeadline()
  await loadPeriod(store.currentPeriod)
  // 订阅实时变更(模拟 CloudBase watch)
  backend.watch(store.realCurrentPeriod, (period, changes) => {
    if (period !== store.currentPeriod) return
    for (const c of changes) {
      store.progress[c.unitId] = { done: c.done, doneAt: c.doneAt, operator: c.operator, device: c.device }
      if (c.done) {
        const u = store.units.find((x) => x.id === c.unitId)
        addToast(`✓ ${u ? u.name : '单位'} 已完成结账`, 'ok')
        store.flash++
        store.pulseUnitId = c.unitId
      }
    }
  })
  startSimulation(store.realCurrentPeriod)
  store.loading = false
}

export async function loadPeriod(period) {
  store.currentPeriod = period
  store.selectedUnitId = null
  const archive = period !== store.realCurrentPeriod
  store.progress = await backend.getProgress(period, archive)
}

export async function toggleUnit(unitId) {
  if (store.currentPeriod !== store.realCurrentPeriod) return
  const wasDone = isDone(unitId)
  const rec = await backend.toggle(unitId, store.currentPeriod)
  store.progress[unitId] = rec
  if (!wasDone && rec.done) {
    const u = store.units.find((x) => x.id === unitId)
    addToast(`✓ ${u ? u.name : '单位'} 已完成结账`, 'ok')
    store.flash++
    store.pulseUnitId = unitId
  }
}

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

// ---- 维护 ----
export async function refreshUnits() {
  store.units = await backend.getUnits()
}
export async function addUnit(data) {
  await backend.addUnit(data)
  await refreshUnits()
  addToast('单位已新增', 'ok')
}
export async function updateUnit(id, data) {
  await backend.updateUnit(id, data)
  await refreshUnits()
  addToast('单位已更新', 'ok')
}
export async function deleteUnit(id) {
  await backend.deleteUnit(id)
  await refreshUnits()
  addToast('单位已删除', 'ok')
}

// ---- 管理 ----
export async function loadLogs() {
  store.logs = await backend.getLogs()
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
export async function resetPeriod() {
  await backend.resetPeriod(store.currentPeriod)
  store.progress = await backend.getProgress(store.currentPeriod, false)
  await loadLogs()
  addToast('当前周期已重置', 'ok')
}
