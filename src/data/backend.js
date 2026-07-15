// CloudBase 数据层：匿名登录 + 实时同步
import cloudbase from '@cloudbase/js-sdk'
import { mockUnits, mockInitialDone } from './mock.js'

const ENV_ID = 'ysy-server-d7gwidmgv14f8da68'

const app = cloudbase.init({ env: ENV_ID })
const auth = app.auth({ persistence: 'local' })
const db = app.database()
const _ = db.command

let ready = false

async function ensureReady() {
  if (ready) return
  try {
    await auth.anonymousAuthProvider().signIn()
    ready = true
  } catch (e) {
    console.warn('CloudBase auth fallback to local', e)
  }
}

function getDevice() {
  let id = localStorage.getItem('closing_dev_id')
  if (!id) { id = 'dev_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('closing_dev_id', id) }
  return id
}

/* ======== Units ======== */
async function getUnits() {
  await ensureReady()
  try {
    const { data } = await db.collection('units').orderBy('createdAt', 'asc').get()
    if (data && data.length) return data
  } catch (e) { /* fallback to seed */ }
  return seedUnits()
}

async function seedUnits() {
  try {
    for (const u of mockUnits) {
      await db.collection('units').add({ ...u, createdAt: Date.now() })
    }
    return mockUnits.map(u => ({ ...u }))
  } catch (e) { return mockUnits.map(u => ({ ...u })) }
}

async function addUnit(data) {
  await ensureReady()
  try {
    const doc = { ...data, createdAt: Date.now() }
    const { id } = await db.collection('units').add(doc)
    pushLog('addUnit', { unitId: id })
    return { id, ...doc }
  } catch (e) { return null }
}

async function updateUnit(id, data) {
  await ensureReady()
  try {
    await db.collection('units').doc(id).update(data)
    pushLog('editUnit', { unitId: id })
  } catch (e) { /* ignore */ }
}

async function deleteUnit(id) {
  await ensureReady()
  try {
    await db.collection('units').doc(id).remove()
    pushLog('delUnit', { unitId: id })
  } catch (e) { /* ignore */ }
}

/* ======== Progress ======== */
async function getProgress(period, archive) {
  await ensureReady()
  try {
    const { data } = await db.collection('progress').where({ period }).get()
    const map = {}
    for (const d of data) map[d.unitId] = { done: d.done, doneAt: d.doneAt, operator: d.operator, device: d.device }
    return map
  } catch (e) {
    // 本地 fallback
    const map = {}
    for (const u of mockUnits) {
      map[u.id] = archive
        ? { done: false, doneAt: null, operator: null, device: null }
        : { done: mockInitialDone.includes(u.id), doneAt: Date.now(), operator: 'local', device: getDevice() }
    }
    return map
  }
}

async function toggle(unitId, period) {
  await ensureReady()
  try {
    const { data } = await db.collection('progress').where({ unitId, period }).get()
    const dev = getDevice()
    if (data && data.length) {
      const doc = data[0]
      const next = doc.done
        ? { done: false, doneAt: null, operator: 'me', device: dev }
        : { done: true, doneAt: Date.now(), operator: 'me', device: dev }
      await db.collection('progress').doc(doc._id).update(next)
      pushLog(next.done ? 'check' : 'uncheck', { period, unitId })
      return next
    } else {
      const rec = { unitId, period, done: true, doneAt: Date.now(), operator: 'me', device: dev }
      await db.collection('progress').add(rec)
      pushLog('check', { period, unitId })
      return rec
    }
  } catch (e) { return { done: true, doneAt: Date.now(), operator: 'local', device: getDevice() } }
}

/* ======== Real-time Watch ======== */
function watch(period, cb) {
  ensureReady().then(() => {
    db.collection('progress')
      .where({ period })
      .watch({
        onChange: (snapshot) => {
          const changes = []
          for (const doc of snapshot.docChanges) {
            if (doc.data && doc.data.unitId) {
              changes.push({
                unitId: doc.data.unitId,
                done: doc.data.done,
                doneAt: doc.data.doneAt,
                operator: doc.data.operator,
                device: doc.data.device,
              })
            }
          }
          if (changes.length) cb(period, changes)
        },
        onError: (err) => console.warn('CloudBase watch error', err),
      })
  })
}

/* ======== Logs ======== */
async function getLogs() {
  await ensureReady()
  try {
    const { data } = await db.collection('logs').orderBy('ts', 'desc').limit(200).get()
    return (data || []).map(d => ({ action: d.action, ts: d.ts, operator: d.operator, device: d.device, unitId: d.unitId, period: d.period }))
  } catch (e) { return [] }
}

function pushLog(action, extra = {}) {
  ensureReady().then(() => {
    db.collection('logs').add({ action, ts: Date.now(), operator: 'me', device: getDevice(), ...extra }).catch(() => {})
  })
}

/* ======== Config ======== */
async function getDeadline() {
  await ensureReady()
  try {
    const { data } = await db.collection('config').where({ key: 'deadline' }).get()
    if (data && data.length) return data[0].value
  } catch (e) { /* ignore */ }
  const d = new Date(); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  last.setHours(18, 0, 0, 0)
  return last.getTime()
}

async function setDeadline(ts) {
  await ensureReady()
  try {
    const { data } = await db.collection('config').where({ key: 'deadline' }).get()
    if (data && data.length) await db.collection('config').doc(data[0]._id).update({ value: ts })
    else await db.collection('config').add({ key: 'deadline', value: ts })
    pushLog('setDeadline', { deadline: ts })
  } catch (e) { /* ignore */ }
  return ts
}

async function verifyAdmin(pwd) {
  await ensureReady()
  try {
    const { data } = await db.collection('config').where({ key: 'adminPwd' }).get()
    if (data && data.length) return data[0].value === pwd
  } catch (e) { return pwd === 'admin123' }
  return pwd === 'admin123'
}

async function changePwd(oldPwd, newPwd) {
  await ensureReady()
  const ok = await verifyAdmin(oldPwd)
  if (!ok) return false
  try {
    const { data } = await db.collection('config').where({ key: 'adminPwd' }).get()
    if (data && data.length) await db.collection('config').doc(data[0]._id).update({ value: newPwd })
    else await db.collection('config').add({ key: 'adminPwd', value: newPwd })
    pushLog('changePwd')
    return true
  } catch (e) { return false }
}

async function resetPeriod(period) {
  await ensureReady()
  try {
    const { data } = await db.collection('progress').where({ period }).get()
    for (const d of (data || [])) {
      await db.collection('progress').doc(d._id).update({ done: false, doneAt: null, operator: null, device: null })
    }
    pushLog('reset', { period })
  } catch (e) { /* ignore */ }
}

/* ======== Simulation (演示用，上线后可删除) ======== */
export function startSimulation(period) { /* 上线后不需要模拟 */ }
export function stopSimulation() {}

export const backend = {
  getUnits, getProgress, toggle, watch,
  addUnit, updateUnit, deleteUnit,
  getLogs, verifyAdmin, changePwd,
  getDeadline, setDeadline, resetPeriod,
}
