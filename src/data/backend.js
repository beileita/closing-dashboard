// 可切换的数据层接口。当前为 mock 实现(内存 + 模拟实时同步)。
// 接入腾讯云开发 CloudBase 时,在此实现同接口的 cloudbase 版本并切换导出即可。
import { mockUnits, mockInitialDone } from './mock.js'

function hash(s) {
  let x = 0
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0
  return x
}

function getDevice() {
  let id = localStorage.getItem('closing_dev_id')
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2, 10)
    localStorage.setItem('closing_dev_id', id)
  }
  return id
}

let units = mockUnits.map((u) => ({ ...u }))
let nextSeq = 100
const state = { periods: {} } // period -> { unitId: { done, doneAt, operator, device } }
const logs = []

// 计算当月最后一天 18:00 作为默认截止时间
function defaultDeadline() {
  const d = new Date()
  // 当月最后一天
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  last.setHours(18, 0, 0, 0)
  return last.getTime()
}

const config = { adminPwd: 'admin123', deadline: defaultDeadline() } // 演示默认密码 admin123;实际上线存 bcrypt hash 到 CloudBase config

function pushLog(action, extra = {}) {
  logs.unshift({ action, ts: Date.now(), operator: 'me', device: getDevice(), ...extra })
}

function seed(period, archive) {
  const map = {}
  for (const u of units) {
    const done = archive ? hash(u.id + period) % 10 !== 0 : mockInitialDone.includes(u.id)
    map[u.id] = done
      ? { done: true, doneAt: Date.now() - (hash(u.id) % 72) * 3600000, operator: 'anon_arch', device: 'dev_arch' }
      : { done: false, doneAt: null, operator: null, device: null }
  }
  state.periods[period] = map
}

const watchers = new Set()
function emit(period, changes) {
  watchers.forEach((cb) => cb(period, changes))
}

export const backend = {
  async getUnits() {
    return units.map((u) => ({ ...u }))
  },
  async getProgress(period, archive = false) {
    if (!state.periods[period]) seed(period, archive)
    return JSON.parse(JSON.stringify(state.periods[period]))
  },
  async toggle(unitId, period) {
    if (!state.periods[period]) seed(period, false)
    const p = state.periods[period]
    const cur = p[unitId] || { done: false }
    const next = cur.done
      ? { done: false, doneAt: null, operator: 'me', device: getDevice() }
      : { done: true, doneAt: Date.now(), operator: 'me', device: getDevice() }
    p[unitId] = next
    pushLog(next.done ? 'check' : 'uncheck', { period, unitId })
    emit(period, [{ unitId, ...next }])
    return next
  },
  watch(period, cb) {
    watchers.add(cb)
    return () => watchers.delete(cb)
  },

  // ---- 单位维护 ----
  async addUnit(data) {
    const u = { id: 'u' + nextSeq++, createdAt: Date.now(), ...data }
    units.push(u)
    pushLog('addUnit', { unitId: u.id })
    return u
  },
  async updateUnit(id, data) {
    const u = units.find((x) => x.id === id)
    if (u) {
      Object.assign(u, data)
      pushLog('editUnit', { unitId: id })
    }
    return u
  },
  async deleteUnit(id) {
    units = units.filter((x) => x.id !== id)
    pushLog('delUnit', { unitId: id })
  },

  // ---- 管理 ----
  async getLogs() {
    return logs.slice()
  },
  async verifyAdmin(pwd) {
    return pwd === config.adminPwd
  },
  async changePwd(oldPwd, newPwd) {
    if (oldPwd !== config.adminPwd) return false
    config.adminPwd = newPwd
    pushLog('changePwd')
    return true
  },
  async getDeadline() {
    return config.deadline
  },
  async setDeadline(ts) {
    config.deadline = ts
    pushLog('setDeadline', { deadline: ts })
    return ts
  },
  async resetPeriod(period) {
    if (!state.periods[period]) seed(period, false)
    const p = state.periods[period]
    const changes = []
    for (const u of units) {
      p[u.id] = { done: false, doneAt: null, operator: null, device: null }
      changes.push({ unitId: u.id, ...p[u.id] })
    }
    pushLog('reset', { period })
    emit(period, changes)
  },
}

// 实时模拟:其他同事陆续完成结账(演示跨设备秒级同步点亮)
let simTimer = null
export function startSimulation(period) {
  stopSimulation()
  const tick = () => {
    const p = state.periods[period]
    if (p) {
      const undone = units.filter((u) => !p[u.id] || !p[u.id].done)
      if (undone.length) {
        const u = undone[Math.floor(Math.random() * undone.length)]
        p[u.id] = {
          done: true,
          doneAt: Date.now(),
          operator: 'anon_' + Math.random().toString(36).slice(2, 6),
          device: 'dev_' + Math.random().toString(36).slice(2, 6),
        }
        emit(period, [{ unitId: u.id, ...p[u.id] }])
      }
    }
    simTimer = setTimeout(tick, 7000 + Math.random() * 8000)
  }
  simTimer = setTimeout(tick, 5000)
}
export function stopSimulation() {
  if (simTimer) clearTimeout(simTimer)
  simTimer = null
}
