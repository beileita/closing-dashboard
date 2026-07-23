// ============================================================
// CloudBase 数据层 v7 — 实时监听 + 代际机制 + 软删除
//
// 核心变更（v6→v7）：
//   1. watch() 实时推送替代 3 秒轮询
//   2. 所有集合安全规则需设为 {"read":"auth!=null","write":"auth!=null"}
//   3. 统一用 _id 定位文档，读时归一化为 id
// ============================================================

import { getApp, ensureLogin, db } from '../utils/cloudbase.js'
import { mockUnits, mockInitialDone } from './mock.js'

// ---- 本地降级数据（CloudBase 不可用时使用） ----
let localUnits = mockUnits.map(u => ({ ...u }))
const localProgress = {}
const localLogs = []
const localConfig = {
  adminPwd: 'admin123',
  deadline: (() => {
    const d = new Date()
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    last.setHours(18, 0, 0, 0)
    return last.getTime()
  })(),
}

function device() {
  let id = localStorage.getItem('closing_dev_id')
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2, 10)
    localStorage.setItem('closing_dev_id', id)
  }
  return id
}

function localSeed(period) {
  if (localProgress[period]) return
  const map = {}
  for (const u of localUnits) {
    map[u.id] = { done: mockInitialDone.includes(u.id), doneAt: Date.now(), operator: 'local', device: device() }
  }
  localProgress[period] = map
}

function localLog(action, extra = {}) {
  const entry = { action, ts: Date.now(), operator: 'me', device: device(), ...extra }
  localLogs.unshift(entry)
}

// ---- CloudBase 连接 ----
let cloudReady = null
let connectError = null

async function connect() {
  if (cloudReady) return cloudReady
  try {
    getApp()
    await ensureLogin()
    cloudReady = db()
    console.log('[backend] CloudBase connected')
    return cloudReady
  } catch (e) {
    connectError = e.message || 'CloudBase 连接失败'
    throw new Error('CloudBase 连接失败: ' + connectError)
  }
}

export function getConnectError() {
  return connectError
}

// ============================================================
// 实时监听（Watch）
// ============================================================

/**
 * 监听 progress 集合 — 当前周期 + 当前 gen
 *
 * @param {string} period  周期，如 "2026-07"
 * @param {number} gen     当前代际
 * @param {function} onChange   ({ [unitId]: {done,doneAt,...} }, docChanges) => void
 * @param {function} onError    (Error) => void
 * @returns {{ close: () => void }}
 */
export function watchProgress(period, gen, onChange, onError) {
  const d = db()
  const watcher = d
    .collection('progress')
    .where({ period, gen })
    .limit(1000)
    .watch({
      onChange: (snapshot) => {
        try {
          const map = {}
          for (const doc of snapshot.docs) {
            map[doc.unitId] = {
              done: !!doc.done,
              doneAt: doc.doneAt || null,
              operator: doc.operator || null,
              device: doc.device || null,
            }
          }
          onChange(map, snapshot.docChanges || [])
        } catch (e) {
          console.error('[watch:progress] onChange error', e)
        }
      },
      onError: (err) => {
        console.error('[watch:progress]', err)
        if (onError) onError(err)
      },
    })
  return watcher
}

/**
 * 监听 units 集合 — 全量（客户端过滤 deleted）
 *
 * @param {function} onChange   (Unit[], docChanges) => void
 * @param {function} onError    (Error) => void
 * @returns {{ close: () => void }}
 */
export function watchUnits(onChange, onError) {
  const d = db()
  const watcher = d
    .collection('units')
    .orderBy('createdAt', 'asc')
    .limit(1000)
    .watch({
      onChange: (snapshot) => {
        try {
          const units = snapshot.docs
            .filter(doc => !doc.deleted)
            .map(doc => ({ ...doc, id: doc._id }))
          onChange(units, snapshot.docChanges || [])
        } catch (e) {
          console.error('[watch:units] onChange error', e)
        }
      },
      onError: (err) => {
        console.error('[watch:units]', err)
        if (onError) onError(err)
      },
    })
  return watcher
}

// ============================================================
// 代际机制（progress reset）
// ============================================================

let _currentGen = 0

async function ensureGen() {
  if (_currentGen) return _currentGen
  try {
    const d = await connect()
    const { data } = await d.collection('config').where({ key: 'resetGen' }).get()
    if (data?.length) {
      _currentGen = data[0].value
    } else {
      _currentGen = Date.now()
      await d.collection('config').add({ key: 'resetGen', value: _currentGen })
    }
  } catch (e) {
    console.warn('[backend] ensureGen failed, using Date.now()', e)
    _currentGen = Date.now()
  }
  return _currentGen
}

async function incrementGen() {
  const d = await connect()
  _currentGen = Date.now()
  try {
    const { data } = await d.collection('config').where({ key: 'resetGen' }).get()
    if (data?.length) {
      await d.collection('config').doc(data[0]._id).update({ value: _currentGen })
    } else {
      await d.collection('config').add({ key: 'resetGen', value: _currentGen })
    }
  } catch (e) {
    console.warn('[backend] incrementGen write failed, gen in memory only', e)
  }
  return _currentGen
}

// ============================================================
// CRUD 操作
// ============================================================

export const backend = {
  // ---- Units ----

  /**
   * 全量获取单位（初始化用；运行时由 watchUnits 保持同步）
   */
  async getUnits() {
    try {
      const d = await connect()
      const { data } = await d.collection('units').orderBy('createdAt', 'asc').limit(1000).get()
      if (data?.length) {
        return data.filter(r => !r.deleted).map(r => ({ ...r, id: r._id }))
      }
    } catch (e) {
      console.warn('[backend] getUnits failed, using local data', e)
    }
    return localUnits.map(u => ({ ...u }))
  },

  /**
   * 新增单位
   * 创建文档后回写 id 字段，方便 where({id}) 查询
   */
  async addUnit(data) {
    const d = await connect()
    const doc = { ...data, createdAt: Date.now(), deleted: false }
    const result = await d.collection('units').add(doc)
    // 回写 id 字段（CloudBase 的 _id 也会自动存在）
    await d.collection('units').doc(result.id).update({ id: result.id })
    localLog('addUnit', { unitId: result.id })
    return { id: result.id, ...data }
  },

  /**
   * 编辑单位
   * 直接用 _id 定位文档（_id 是 CloudBase 的主键，不会变）
   */
  async updateUnit(id, data) {
    const d = await connect()
    // 只传需要更新的字段
    const patch = {}
    for (const key of ['name', 'province', 'city', 'district', 'lng', 'lat', 'owner']) {
      if (data[key] !== undefined) patch[key] = data[key]
    }
    if (Object.keys(patch).length === 0) return

    // 直接用 _id 定位更新
    await d.collection('units').doc(id).update(patch)
    localLog('editUnit', { unitId: id })
  },

  /**
   * 删除单位（软删除）
   * 同时清理关联的 progress 文档
   */
  async deleteUnit(id) {
    const d = await connect()
    // 软删除
    await d.collection('units').doc(id).update({ deleted: true })

    // 清理 progress（尽力而为）
    try {
      const { data: pdocs } = await d
        .collection('progress')
        .where({ unitId: id })
        .limit(1000)
        .get()
      if (pdocs?.length) {
        await Promise.all(
          pdocs.map(r => d.collection('progress').doc(r._id).remove().catch(() => {}))
        )
      }
    } catch (e) {
      /* 清理失败不影响删除 */
    }
    localLog('delUnit', { unitId: id })
  },

  // ---- Progress ----

  /**
   * 全量获取当前周期进度（初始化用；运行时由 watchProgress 保持同步）
   */
  async getProgress(period) {
    try {
      const d = await connect()
      const gen = await ensureGen()
      const { data } = await d
        .collection('progress')
        .where({ period, gen })
        .limit(1000)
        .get()
      if (data?.length) {
        const map = {}
        for (const r of data) {
          map[r.unitId] = {
            done: !!r.done,
            doneAt: r.doneAt || null,
            operator: r.operator || null,
            device: r.device || null,
          }
        }
        return map
      }
    } catch (e) {
      console.warn('[backend] getProgress failed', e)
    }
    // 降级到本地
    localSeed(period)
    return localProgress[period] || {}
  },

  /**
   * 切换单位完成状态
   * 存在 → toggle，不存在 → 创建（标记完成）
   */
  async toggle(unitId, period) {
    const dev = device()
    const d = await connect()
    const gen = await ensureGen()

    const { data } = await d
      .collection('progress')
      .where({ unitId, period, gen })
      .limit(1)
      .get()

    let next
    if (data?.length) {
      const doc = data[0]
      next = doc.done
        ? { done: false, doneAt: null, operator: 'me', device: dev }
        : { done: true, doneAt: Date.now(), operator: 'me', device: dev }
      await d.collection('progress').doc(doc._id).update(next)
    } else {
      next = {
        unitId,
        period,
        gen,
        done: true,
        doneAt: Date.now(),
        operator: 'me',
        device: dev,
      }
      await d.collection('progress').add(next)
    }

    localLog(next.done ? 'check' : 'uncheck', { period, unitId })
    return next
  },

  // ---- Reset ----

  /**
   * 重置周期：递增 gen，旧文档自然失效
   */
  async resetPeriod(period) {
    const oldGen = _currentGen
    const newGen = await incrementGen()

    // 清理旧 gen 文档（尽力而为）
    if (oldGen) {
      try {
        const d = await connect()
        const { data } = await d
          .collection('progress')
          .where({ period, gen: oldGen })
          .limit(1000)
          .get()
        if (data?.length) {
          await Promise.all(
            data.map(r => d.collection('progress').doc(r._id).remove().catch(() => {}))
          )
        }
      } catch (e) {
        /* 清理失败不影响 */
      }
    }

    localLog('reset', { period, oldGen, newGen })
    return newGen
  },

  /**
   * 获取当前 gen（外部需在 init 时调用）
   */
  async getCurrentGen() {
    return ensureGen()
  },

  // ---- Config ----

  async getDeadline() {
    try {
      const d = await connect()
      const { data } = await d.collection('config').where({ key: 'deadline' }).get()
      if (data?.length) return data[0].value
    } catch (e) {
      /* fall through */
    }
    return localConfig.deadline
  },

  async setDeadline(ts) {
    try {
      const d = await connect()
      const { data } = await d.collection('config').where({ key: 'deadline' }).get()
      if (data?.length) {
        await d.collection('config').doc(data[0]._id).update({ value: ts })
      } else {
        await d.collection('config').add({ key: 'deadline', value: ts })
      }
    } catch (e) {
      /* fall through */
    }
    localConfig.deadline = ts
    localLog('setDeadline', { deadline: ts })
    return ts
  },

  async verifyAdmin(pwd) {
    try {
      const d = await connect()
      const { data } = await d.collection('config').where({ key: 'adminPwd' }).get()
      if (data?.length) return data[0].value === pwd
    } catch (e) {
      /* fall through */
    }
    return pwd === localConfig.adminPwd
  },

  async changePwd(old, nu) {
    if (!(await backend.verifyAdmin(old))) return false
    try {
      const d = await connect()
      const { data } = await d.collection('config').where({ key: 'adminPwd' }).get()
      if (data?.length) {
        await d.collection('config').doc(data[0]._id).update({ value: nu })
      } else {
        await d.collection('config').add({ key: 'adminPwd', value: nu })
      }
    } catch (e) {
      /* fall through */
    }
    localConfig.adminPwd = nu
    localLog('changePwd')
    return true
  },

  // ---- Logs ----

  async getLogs() {
    try {
      const d = await connect()
      const { data } = await d.collection('logs').orderBy('ts', 'desc').limit(500).get()
      return (data || []).map(r => ({
        action: r.action,
        ts: r.ts,
        operator: r.operator,
        device: r.device,
        unitId: r.unitId,
        period: r.period,
      }))
    } catch (e) {
      return localLogs.slice()
    }
  },
}

// 模拟器占位（已禁用）
export function startSimulation() {
  /* disabled */
}
export function stopSimulation() {}
