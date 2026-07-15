<template>
  <div class="flex-1 flex flex-col min-h-0 px-4 pb-4 overflow-hidden">
    <!-- Auth gate -->
    <div v-if="!store.adminAuthed" class="max-w-sm mx-auto mt-20">
      <div class="card-elevated p-8 text-center">
        <div class="text-3xl mb-3">🔒</div>
        <div class="text-white font-bold text-lg mb-1">管理员验证</div>
        <p class="text-gray-400 text-sm mb-5">需要管理员密码才能进入管理后台</p>
        <input v-model="pwd" type="password" class="ipt mb-3" placeholder="管理员密码 (演示: admin123)" @keyup.enter="onLogin" />
        <button @click="onLogin" class="btn btn-primary w-full">进入管理后台</button>
        <p v-if="err" class="text-red-400 text-xs mt-3">密码错误，请重试</p>
      </div>
    </div>

    <template v-else>
      <!-- Subtabs -->
      <div class="flex gap-1.5 py-3">
        <button v-for="t in subs" :key="t.key" @click="sub=t.key"
          :class="['px-4 py-2 text-sm rounded-xl font-medium transition', sub===t.key?'bg-blue-500/15 text-green-400':'card text-gray-500 hover:text-gray-300']">
          {{ t.label }}
        </button>
      </div>

      <!-- Unit maintenance -->
      <div v-if="sub==='units'" class="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-hidden">
        <div class="card flex flex-col w-full md:w-[380px] shrink-0 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-700/20 flex items-center justify-between">
            <span class="text-white font-medium">单位 <span class="text-gray-500 text-xs">({{ store.units.length }})</span></span>
            <button @click="startAdd" class="btn btn-primary !py-1">+ 新增</button>
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            <div v-for="u in store.units" :key="u.id" class="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-700/20 group">
              <span class="flex-1 truncate text-sm text-white">{{ u.name }}</span>
              <span class="text-xs text-gray-500 hidden sm:inline truncate max-w-[110px]">{{ u.province }}·{{ u.city }}</span>
              <button @click="startEdit(u)" class="text-xs text-gray-500 hover:text-green-400 transition">编辑</button>
              <button @click="onDel(u)" class="text-xs text-gray-500 hover:text-red-400 transition">删除</button>
            </div>
          </div>
        </div>

        <div class="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto md:overflow-visible">
          <div class="card p-4">
            <div class="text-white font-medium mb-3">{{ form.id?'编辑单位':'新增单位' }}</div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div class="col-span-2 md:col-span-3 flex flex-col gap-1"><label class="text-xs text-gray-400">单位名称</label><input v-model="form.name" class="ipt" placeholder="如:上海陆家嘴中心" /></div>
              <div class="flex flex-col gap-1"><label class="text-xs text-gray-400">省</label><input v-model="form.province" class="ipt" list="prov-list" /></div>
              <div class="flex flex-col gap-1"><label class="text-xs text-gray-400">市</label><input v-model="form.city" class="ipt" /></div>
              <div class="flex flex-col gap-1"><label class="text-xs text-gray-400">区/县</label><input v-model="form.district" class="ipt" /></div>
              <div class="flex flex-col gap-1"><label class="text-xs text-gray-400">负责人</label><input v-model="form.owner" class="ipt" /></div>
              <div class="flex flex-col gap-1"><label class="text-xs text-gray-400">经度</label><input v-model.number="form.lng" type="number" step="0.0001" class="ipt" /></div>
              <div class="flex flex-col gap-1"><label class="text-xs text-gray-400">纬度</label><input v-model.number="form.lat" type="number" step="0.0001" class="ipt" /></div>
            </div>
            <div class="flex gap-2 mt-4"><button @click="save" class="btn btn-primary">保存</button><button @click="resetForm" class="btn btn-ghost">清空</button></div>
            <datalist id="prov-list"><option v-for="p in provinces" :key="p" :value="p"></option></datalist>
          </div>
          <div class="card flex-1 overflow-hidden relative min-h-[240px]">
            <div class="absolute top-3 left-3 z-10 text-xs text-gray-400 card px-2.5 py-1 pointer-events-none">点击地图拾取经纬度</div>
            <UnitPickerMap :lng="form.lng" :lat="form.lat" @pick="onPick" />
          </div>
        </div>
      </div>

      <!-- System management -->
      <div v-else class="flex-1 overflow-y-auto">
        <div class="grid md:grid-cols-2 gap-4">
          <div class="card p-4">
            <div class="text-white font-medium mb-3">周期管理</div>
            <div class="text-sm text-gray-400 mb-3">当前周期:<span class="text-white font-mono ml-1">{{ store.currentPeriod }}</span></div>
            <button @click="onReset" class="btn btn-primary">重置当前周期</button>
            <p class="text-xs text-gray-600 mt-2">将清空当前周期所有完成标记，便于月末重新开账</p>
          </div>
          <div class="card p-4">
            <div class="text-white font-medium mb-3">结账截止时间</div>
            <p class="text-xs text-gray-400 mb-3">用于看板倒计时，提示结账截止节点</p>
            <input v-model="dlDate" type="date" class="ipt mb-2" />
            <input v-model="dlTime" type="time" class="ipt mb-3" />
            <button @click="onSetDeadline" class="btn btn-primary">更新截止时间</button>
            <p v-if="dlSaved" class="text-xs text-green-400 mt-2">✓ 截止时间已更新</p>
          </div>
        </div>

        <div class="grid md:grid-cols-1 gap-4 mt-4">
          <div class="card p-4">
            <div class="text-white font-medium mb-3">修改管理员密码</div>
            <div class="flex gap-2">
              <input v-model="oldPwd" type="password" class="ipt" placeholder="当前密码" />
              <input v-model="newPwd" type="password" class="ipt" placeholder="新密码" />
              <button @click="onChangePwd" class="btn btn-primary shrink-0">修改</button>
            </div>
          </div>
        </div>

        <div class="card p-4 mt-4">
          <div class="flex items-center justify-between mb-3">
            <span class="text-white font-medium">操作日志 <span class="text-gray-500 text-xs">({{ store.logs.length }})</span></span>
            <button @click="exportCsv" class="btn btn-ghost">导出 CSV</button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-gray-400 text-xs"><tr class="text-left"><th class="py-2 pr-3">时间</th><th class="pr-3">操作</th><th class="pr-3">对象</th><th class="pr-3">设备</th></tr></thead>
              <tbody>
                <tr v-for="(l,i) in store.logs" :key="i" class="border-t border-gray-700/20">
                  <td class="py-1.5 pr-3 font-mono text-xs text-gray-500 whitespace-nowrap">{{ fmt(l.ts) }}</td>
                  <td class="pr-3 whitespace-nowrap"><span :class="actionColor(l.action)">{{ actionLabel(l.action) }}</span></td>
                  <td class="pr-3 text-white font-mono text-xs">{{ l.unitId||l.period||'-' }}</td>
                  <td class="pr-3 font-mono text-xs text-gray-500">{{ l.device }}</td>
                </tr>
                <tr v-if="store.logs.length===0"><td colspan="4" class="py-6 text-center text-gray-500 text-sm">暂无操作记录</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { store, addUnit, updateUnit, deleteUnit, verifyAdmin, resetPeriod, changePwd, loadLogs, setDeadline } from '../data/store'
import { provinceAdcode } from '../data/adcode'
import UnitPickerMap from './UnitPickerMap.vue'

const subs = [{ key:'units', label:'单位维护' },{ key:'system', label:'系统管理' }]
const sub = ref('units')

const pwd = ref(''), err = ref(false)
async function onLogin() { err.value = !(await verifyAdmin(pwd.value)); if(store.adminAuthed) await loadLogs() }

const provinces = Object.keys(provinceAdcode)
const form = reactive({ id:null, name:'', province:'', city:'', district:'', owner:'', lng:null, lat:null })
function resetForm() { Object.assign(form, { id:null, name:'', province:'', city:'', district:'', owner:'', lng:null, lat:null }) }
function startAdd() { resetForm() }
function startEdit(u) { Object.assign(form, { id:u.id, name:u.name, province:u.province, city:u.city, district:u.district||'', owner:u.owner||'', lng:u.lng, lat:u.lat }) }
function onPick(p) { if(p.lng!=null) form.lng=p.lng; if(p.lat!=null) form.lat=p.lat; if(p.province) form.province=p.province; if(p.city) form.city=p.city; if(p.district) form.district=p.district }
async function save() {
  if(!form.name||!form.province||!form.city||form.lng==null||form.lat==null) { alert('请填写名称/省/市，并在地图上拾取经纬度'); return }
  const data = { name:form.name, province:form.province, city:form.city, district:form.district, owner:form.owner, lng:form.lng, lat:form.lat }
  if(form.id) await updateUnit(form.id, data); else await addUnit(data); resetForm()
}
async function onDel(u) { if(confirm(`删除「${u.name}」?`)) await deleteUnit(u.id) }

const oldPwd=ref(''), newPwd=ref(''), dlDate=ref(''), dlTime=ref('18:00'), dlSaved=ref(false)
watch(()=>store.deadline, ts => {
  if(ts){ const d=new Date(ts); dlDate.value=d.toISOString().slice(0,10); dlTime.value=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
}, { immediate:true })
async function onSetDeadline() {
  if(!dlDate.value){ alert('请选择日期'); return }
  const d=new Date(dlDate.value); const [hh,mm]=(dlTime.value||'18:00').split(':'); d.setHours(+hh,+mm,0,0)
  await setDeadline(d.getTime()); dlSaved.value=true; setTimeout(()=>dlSaved.value=false,2500)
}
async function onReset() { if(confirm('重置当前周期?所有完成标记将被清空。')) await resetPeriod() }
async function onChangePwd() {
  if(!newPwd.value){ alert('请输入新密码'); return }
  const ok = await changePwd(oldPwd.value, newPwd.value)
  if(ok){ oldPwd.value=''; newPwd.value='' } else { alert('原密码错误') }
}

const labels = { check:'标记完成', uncheck:'取消标记', reset:'周期重置', addUnit:'新增单位', editUnit:'编辑单位', delUnit:'删除单位', changePwd:'修改密码', setDeadline:'设置截止' }
function actionLabel(a) { return labels[a]||a }
function actionColor(a) {
  const m={ check:'text-green-400', uncheck:'text-gray-500', reset:'text-yellow-400', addUnit:'text-green-400', editUnit:'text-green-300', delUnit:'text-red-400', changePwd:'text-yellow-400', setDeadline:'text-green-400' }
  return m[a]||'text-white'
}
function fmt(ts) { const d=new Date(ts); return `${d.getMonth()+1}-${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
function exportCsv() {
  const rows=[['时间','操作','对象','设备','操作人']]
  for(const l of store.logs) rows.push([new Date(l.ts).toLocaleString(),labels[l.action]||l.action,l.unitId||l.period||'',l.device,l.operator])
  const csv='﻿'+rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n')
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}), a=document.createElement('a')
  a.href=URL.createObjectURL(blob); a.download=`logs-${store.currentPeriod}.csv`; a.click(); URL.revokeObjectURL(a.href)
}
</script>
