// CloudBase 数据层：动态加载 SDK，失败自动降级 mock
import { getApp, ensureLogin, db } from '../utils/cloudbase.js'
import { mockUnits, mockInitialDone } from './mock.js'

/* ======== Local fallback ======== */
let localUnits = mockUnits.map(u => ({ ...u }))
let nextSeq = 100
const localProgress = {}, localLogs = []
const localConfig = {
  adminPwd: 'admin123',
  deadline: (() => { const d = new Date(); const last = new Date(d.getFullYear(), d.getMonth()+1,0); last.setHours(18,0,0,0); return last.getTime() })()
}

function device() {
  let id = localStorage.getItem('closing_dev_id')
  if (!id) { id = 'dev_'+Math.random().toString(36).slice(2,10); localStorage.setItem('closing_dev_id', id) }
  return id
}
function localSeed(period, archive) {
  if (localProgress[period]) return
  const map = {}
  for (const u of localUnits) map[u.id] = archive
    ? { done:false, doneAt:null, operator:null, device:null }
    : { done:mockInitialDone.includes(u.id), doneAt:Date.now(), operator:'local', device:device() }
  localProgress[period] = map
}
function localLog(action, extra={}) { localLogs.unshift({ action, ts:Date.now(), operator:'me', device:device(), ...extra }) }

/* ======== CloudBase helpers ======== */
let cloudReady = null
async function cb() {
  if (cloudReady) return cloudReady
  try {
    getApp()
    await ensureLogin()
    cloudReady = db()
    console.log('CloudBase connected')
    return cloudReady
  } catch (e) {
    console.warn('CloudBase unavailable, local mode', e.message)
    return null
  }
}

/* ======== Public API ======== */
const watchers = new Set()

export const backend = {
  async getUnits() {
    const d = await cb()
    if (d) { try { const { data } = await d.collection('units').orderBy('createdAt','asc').get(); if (data?.length) return data } catch(e){} }
    return localUnits.map(u => ({ ...u }))
  },
  async addUnit(data) {
    const doc = { ...data, createdAt: Date.now() }
    const d = await cb()
    if (d) { try { const { id } = await d.collection('units').add(doc); localLog('addUnit',{unitId:id}); return { id, ...doc } } catch(e){} }
    const u = { id: 'u'+nextSeq++, ...doc }; localUnits.push(u); localLog('addUnit',{unitId:u.id}); return u
  },
  async updateUnit(id, data) {
    const d = await cb(); if (d) { try { await d.collection('units').doc(id).update(data) } catch(e){} }
    const u = localUnits.find(x => x.id===id); if (u) Object.assign(u, data)
    localLog('editUnit',{unitId:id})
  },
  async deleteUnit(id) {
    const d = await cb(); if (d) { try { await d.collection('units').doc(id).remove() } catch(e){} }
    localUnits = localUnits.filter(x => x.id!==id); localLog('delUnit',{unitId:id})
  },
  async getProgress(period, archive) {
    const d = await cb()
    if (d) { try { const { data } = await d.collection('progress').where({period}).get(); if (data?.length) { const map={}; for(const r of data) map[r.unitId]={done:r.done,doneAt:r.doneAt,operator:r.operator,device:r.device}; return map } } catch(e){} }
    localSeed(period, archive); return JSON.parse(JSON.stringify(localProgress[period]))
  },
  async toggle(unitId, period) {
    const d = await cb(), dev = device()
    if (d) {
      try {
        const { data } = await d.collection('progress').where({unitId,period}).get()
        let next
        if (data?.length) {
          const doc = data[0]
          next = doc.done ? { done:false, doneAt:null, operator:'me', device:dev } : { done:true, doneAt:Date.now(), operator:'me', device:dev }
          await d.collection('progress').doc(doc._id).update(next)
        } else {
          next = { unitId, period, done:true, doneAt:Date.now(), operator:'me', device:dev }
          await d.collection('progress').add(next)
        }
        localLog(next.done?'check':'uncheck',{period,unitId})
        goLocal(period, unitId, next); emit(period,[{unitId,...next}])
        return next
      } catch(e) {}
    }
    localSeed(period, false)
    const cur = localProgress[period][unitId] || { done:false }
    const next = cur.done ? { done:false, doneAt:null, operator:'me', device:dev } : { done:true, doneAt:Date.now(), operator:'me', device:dev }
    localProgress[period][unitId] = next; localLog(next.done?'check':'uncheck',{period,unitId}); emit(period,[{unitId,...next}])
    return next
  },
  watch(period, cb) {
    watchers.add(cb)
    cb().then(d => {
      if (!d) return
      d.collection('progress').where({period}).watch({
        onChange: snap => {
          const changes = []; for (const doc of snap.docChanges) { if (doc.data?.unitId) changes.push({unitId:doc.data.unitId,done:doc.data.done,doneAt:doc.data.doneAt,operator:doc.data.operator,device:doc.data.device}) }
          if (changes.length) cb(period, changes)
        },
        onError: e => console.warn('Watch error', e.message),
      })
    }).catch(()=>{})
    return () => watchers.delete(cb)
  },
  async getLogs() {
    const d = await cb(); if (d) { try { const { data } = await d.collection('logs').orderBy('ts','desc').limit(200).get(); return (data||[]).map(r=>({action:r.action,ts:r.ts,operator:r.operator,device:r.device,unitId:r.unitId,period:r.period})) } catch(e){} }
    return localLogs.slice()
  },
  async getDeadline() {
    const d = await cb(); if (d) { try { const { data } = await d.collection('config').where({key:'deadline'}).get(); if (data?.length) return data[0].value } catch(e){} }
    return localConfig.deadline
  },
  async setDeadline(ts) {
    const d = await cb()
    if (d) { try { const { data } = await d.collection('config').where({key:'deadline'}).get(); if (data?.length) await d.collection('config').doc(data[0]._id).update({value:ts}); else await d.collection('config').add({key:'deadline',value:ts}) } catch(e){} }
    localConfig.deadline = ts; localLog('setDeadline',{deadline:ts}); return ts
  },
  async verifyAdmin(pwd) {
    const d = await cb(); if (d) { try { const { data } = await d.collection('config').where({key:'adminPwd'}).get(); if (data?.length) return data[0].value===pwd } catch(e){} }
    return pwd===localConfig.adminPwd
  },
  async changePwd(old, nu) {
    if (!await backend.verifyAdmin(old)) return false
    const d = await cb(); if (d) { try { const { data } = await d.collection('config').where({key:'adminPwd'}).get(); if (data?.length) await d.collection('config').doc(data[0]._id).update({value:nu}); else await d.collection('config').add({key:'adminPwd',value:nu}) } catch(e){} }
    localConfig.adminPwd = nu; localLog('changePwd'); return true
  },
  async resetPeriod(period) {
    const d = await cb()
    if (d) { try { const { data } = await d.collection('progress').where({period}).get(); for (const r of (data||[])) await d.collection('progress').doc(r._id).update({done:false,doneAt:null,operator:null,device:null}) } catch(e){} }
    if (localProgress[period]) for (const uid of Object.keys(localProgress[period])) localProgress[period][uid] = { done:false, doneAt:null, operator:null, device:null }
    localLog('reset',{period})
  },
}

function goLocal(period, unitId, next) {
  if (!localProgress[period]) localSeed(period, false)
  localProgress[period][unitId] = next
}
function emit(period, changes) { watchers.forEach(cb => cb(period, changes)) }

/* Simulation */
let simTimer = null
export function startSimulation(period) {
  stopSimulation()
  const tick = () => {
    if (!localProgress[period]) return
    const undone = localUnits.filter(u => !localProgress[period][u.id]?.done)
    if (undone.length) {
      const u = undone[Math.floor(Math.random()*undone.length)]
      localProgress[period][u.id] = { done:true, doneAt:Date.now(), operator:'anon', device:'sim' }
      emit(period, [{unitId:u.id,...localProgress[period][u.id]}])
    }
    simTimer = setTimeout(tick, 8000+Math.random()*10000)
  }
  simTimer = setTimeout(tick, 5000)
}
export function stopSimulation() { if (simTimer) clearTimeout(simTimer); simTimer=null }
