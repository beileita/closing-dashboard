<template>
  <div class="flex-1 flex flex-col min-h-0 px-4 md:px-6 pb-4 md:pb-6 overflow-hidden">
    <!-- 密码 gate -->
    <div v-if="!store.adminAuthed" class="max-w-sm mx-auto mt-10 md:mt-20 glass rounded-xl p-6">
      <div class="text-tech-green font-medium mb-3 flex items-center gap-2">🔒 管理员验证</div>
      <input v-model="pwd" type="password" class="ipt mb-3" placeholder="管理员密码(演示:admin123)" @keyup.enter="onLogin" />
      <button @click="onLogin" class="btn btn-primary w-full">进入</button>
      <p v-if="err" class="text-red-400 text-xs mt-2">密码错误,请重试</p>
    </div>

    <template v-else>
      <!-- 子标签 -->
      <div class="flex gap-2 py-3">
        <button
          v-for="t in subs"
          :key="t.key"
          @click="sub = t.key"
          :class="['px-3 py-1.5 text-sm rounded-lg transition', sub === t.key ? 'bg-tech-green/20 text-tech-green' : 'glass text-tech-muted hover:text-tech-green']"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- 单位维护 -->
      <div v-if="sub === 'units'" class="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-hidden">
        <div class="glass rounded-xl flex flex-col w-full md:w-[380px] shrink-0 overflow-hidden">
          <div class="px-4 py-3 border-b border-tech-border flex items-center justify-between">
            <span class="text-tech-green font-medium">单位 <span class="text-tech-muted text-xs">({{ store.units.length }})</span></span>
            <button @click="startAdd" class="btn btn-primary !py-1">+ 新增</button>
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            <div v-for="u in store.units" :key="u.id" class="flex items-center gap-2 px-2 py-2 rounded hover:bg-tech-green/5 group">
              <span class="flex-1 truncate text-sm text-tech-fg">{{ u.name }}</span>
              <span class="text-xs text-tech-muted hidden sm:inline truncate max-w-[110px]">{{ u.province }}·{{ u.city }}</span>
              <button @click="startEdit(u)" class="text-xs text-tech-muted hover:text-tech-green">编辑</button>
              <button @click="onDel(u)" class="text-xs text-tech-muted hover:text-red-400">删除</button>
            </div>
          </div>
        </div>

        <div class="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto md:overflow-visible">
          <div class="glass rounded-xl p-4">
            <div class="text-tech-green font-medium mb-3">{{ form.id ? '编辑单位' : '新增单位' }}</div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div class="col-span-2 md:col-span-3 flex flex-col gap-1">
                <label class="text-xs text-tech-muted">单位名称</label>
                <input v-model="form.name" class="ipt" placeholder="如:上海陆家嘴中心" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-tech-muted">省</label>
                <input v-model="form.province" class="ipt" list="prov-list" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-tech-muted">市</label>
                <input v-model="form.city" class="ipt" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-tech-muted">区/县</label>
                <input v-model="form.district" class="ipt" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-tech-muted">负责人</label>
                <input v-model="form.owner" class="ipt" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-tech-muted">经度</label>
                <input v-model.number="form.lng" type="number" step="0.0001" class="ipt" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-tech-muted">纬度</label>
                <input v-model.number="form.lat" type="number" step="0.0001" class="ipt" />
              </div>
            </div>
            <div class="flex gap-2 mt-4">
              <button @click="save" class="btn btn-primary">保存</button>
              <button @click="resetForm" class="btn btn-ghost">清空</button>
            </div>
            <datalist id="prov-list">
              <option v-for="p in provinces" :key="p" :value="p"></option>
            </datalist>
          </div>
          <div class="glass rounded-xl flex-1 overflow-hidden relative min-h-[240px]">
            <div class="absolute top-3 left-3 z-10 text-xs text-tech-muted glass rounded px-2 py-1 pointer-events-none">点击地图拾取经纬度</div>
            <UnitPickerMap :lng="form.lng" :lat="form.lat" @pick="onPick" />
          </div>
        </div>
      </div>

      <!-- 系统管理 -->
      <div v-else class="flex-1 overflow-y-auto">
        <div class="grid md:grid-cols-2 gap-4">
          <div class="glass rounded-xl p-4">
            <div class="text-tech-green font-medium mb-3">周期管理</div>
            <div class="text-sm text-tech-muted mb-3">当前周期:<span class="text-tech-fg font-mono">{{ store.currentPeriod }}</span></div>
            <button @click="onReset" class="btn btn-primary">重置当前周期</button>
            <p class="text-xs text-tech-dimtext mt-2">将清空当前周期所有完成标记,便于月末重新开账</p>
          </div>
          <div class="glass rounded-xl p-4">
            <div class="text-tech-green font-medium mb-3">修改管理员密码</div>
            <input v-model="oldPwd" type="password" class="ipt mb-2" placeholder="当前密码" />
            <input v-model="newPwd" type="password" class="ipt mb-3" placeholder="新密码" />
            <button @click="onChangePwd" class="btn btn-primary">修改密码</button>
          </div>
        </div>

        <div class="glass rounded-xl p-4 mt-4">
          <div class="flex items-center justify-between mb-3">
            <span class="text-tech-green font-medium">操作日志 <span class="text-tech-muted text-xs">({{ store.logs.length }})</span></span>
            <button @click="exportCsv" class="btn btn-ghost">导出 CSV</button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-tech-muted text-xs">
                <tr class="text-left">
                  <th class="py-2 pr-3">时间</th>
                  <th class="pr-3">操作</th>
                  <th class="pr-3">对象</th>
                  <th class="pr-3">设备</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(l, i) in store.logs" :key="i" class="border-t border-tech-border/50">
                  <td class="py-1.5 pr-3 font-mono text-xs text-tech-muted whitespace-nowrap">{{ fmt(l.ts) }}</td>
                  <td class="pr-3 whitespace-nowrap"><span :class="actionColor(l.action)">{{ actionLabel(l.action) }}</span></td>
                  <td class="pr-3 text-tech-fg font-mono text-xs">{{ l.unitId || l.period || '-' }}</td>
                  <td class="pr-3 font-mono text-xs text-tech-muted">{{ l.device }}</td>
                </tr>
                <tr v-if="store.logs.length === 0">
                  <td colspan="4" class="py-6 text-center text-tech-muted text-sm">暂无操作记录</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { store, addUnit, updateUnit, deleteUnit, verifyAdmin, resetPeriod, changePwd, loadLogs } from '../data/store'
import { provinceAdcode } from '../data/adcode'
import UnitPickerMap from './UnitPickerMap.vue'

const subs = [
  { key: 'units', label: '单位维护' },
  { key: 'system', label: '系统管理' },
]
const sub = ref('units')

// ---- 密码 gate ----
const pwd = ref('')
const err = ref(false)
async function onLogin() {
  err.value = !(await verifyAdmin(pwd.value))
  if (store.adminAuthed) await loadLogs()
}

// ---- 单位维护 ----
const provinces = Object.keys(provinceAdcode)
const form = reactive({ id: null, name: '', province: '', city: '', district: '', owner: '', lng: null, lat: null })
function resetForm() {
  Object.assign(form, { id: null, name: '', province: '', city: '', district: '', owner: '', lng: null, lat: null })
}
function startAdd() {
  resetForm()
}
function startEdit(u) {
  Object.assign(form, { id: u.id, name: u.name, province: u.province, city: u.city, district: u.district || '', owner: u.owner || '', lng: u.lng, lat: u.lat })
}
function onPick(p) {
  form.lng = p.lng
  form.lat = p.lat
}
async function save() {
  if (!form.name || !form.province || !form.city || form.lng == null || form.lat == null) {
    alert('请填写名称/省/市,并在地图上拾取经纬度')
    return
  }
  const data = { name: form.name, province: form.province, city: form.city, district: form.district, owner: form.owner, lng: form.lng, lat: form.lat }
  if (form.id) await updateUnit(form.id, data)
  else await addUnit(data)
  resetForm()
}
async function onDel(u) {
  if (confirm(`删除「${u.name}」?`)) await deleteUnit(u.id)
}

// ---- 系统管理 ----
const oldPwd = ref('')
const newPwd = ref('')
async function onReset() {
  if (confirm('重置当前周期?所有完成标记将被清空。')) await resetPeriod()
}
async function onChangePwd() {
  if (!newPwd.value) {
    alert('请输入新密码')
    return
  }
  const ok = await changePwd(oldPwd.value, newPwd.value)
  if (ok) {
    oldPwd.value = ''
    newPwd.value = ''
  } else {
    alert('原密码错误')
  }
}

const labels = { check: '标记完成', uncheck: '取消标记', reset: '周期重置', addUnit: '新增单位', editUnit: '编辑单位', delUnit: '删除单位', changePwd: '修改密码' }
function actionLabel(a) {
  return labels[a] || a
}
function actionColor(a) {
  const m = { check: 'text-tech-green', uncheck: 'text-tech-muted', reset: 'text-tech-teal', addUnit: 'text-tech-green', editUnit: 'text-tech-teal', delUnit: 'text-red-400', changePwd: 'text-tech-teal' }
  return m[a] || 'text-tech-fg'
}
function fmt(ts) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function exportCsv() {
  const rows = [['时间', '操作', '对象', '设备', '操作人']]
  for (const l of store.logs) {
    rows.push([new Date(l.ts).toLocaleString(), labels[l.action] || l.action, l.unitId || l.period || '', l.device, l.operator])
  }
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `logs-${store.currentPeriod}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>
