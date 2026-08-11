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
          :class="['px-4 py-2 text-sm rounded-xl font-medium transition', sub===t.key?'bg-green-700/15 text-green-400':'card text-gray-500 hover:text-gray-300']">
          {{ t.label }}
        </button>
      </div>

      <!-- Unit maintenance -->
      <div v-if="sub==='units'" class="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-hidden">
        <div class="card flex flex-col w-full md:w-[380px] shrink-0 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-700/20 flex items-center justify-between">
            <span class="text-white font-medium">单位 <span class="text-gray-500 text-xs">({{ store.units.length }})</span></span>
            <button @click="openAdd" class="btn btn-primary !py-1">+ 新增</button>
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            <div v-for="u in store.units" :key="u.id" class="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-700/20 group">
              <span class="flex-1 truncate text-sm text-white">{{ u.name }}</span>
              <span class="text-xs text-gray-500 hidden sm:inline truncate max-w-[110px]">{{ u.province }}·{{ u.city }}</span>
              <button @click="openEdit(u)" class="text-xs text-gray-500 hover:text-green-400 transition">编辑</button>
              <button @click="onDel(u)" class="text-xs text-gray-500 hover:text-red-400 transition">删除</button>
            </div>
          </div>
        </div>

        <!-- Right: empty state or instructions -->
        <div class="flex-1 card flex items-center justify-center min-h-0 overflow-hidden">
          <div class="text-center text-gray-500">
            <div class="text-4xl mb-3 opacity-30">🗺️</div>
            <div class="text-sm">点击「新增」按钮打开地图选址</div>
            <div class="text-xs mt-1 text-gray-600">支持省/市/区级下钻 · 任意坐标拾取</div>
          </div>
        </div>
      </div>

      <!-- Modal -->
      <UnitFormModal v-if="showModal" :unit="editingUnit" @close="closeModal" @saved="closeModal" />

      <!-- System management -->
      <div v-else class="flex-1 overflow-y-auto">
        <div class="grid md:grid-cols-2 gap-4">
          <div class="card p-4">
            <div class="text-white font-medium mb-3">周期管理</div>
            <div class="text-sm text-gray-400 mb-3">当前会计期:<span class="text-white font-mono ml-1">{{ store.realCurrentPeriod }}</span>
              <span v-if="store.currentPeriod!==store.realCurrentPeriod" class="text-xs text-yellow-400/80 ml-2">正在查看归档: {{ store.currentPeriod }}</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <button @click="onOpenNext" class="btn btn-primary">打开下一会计期 ({{ nextPeriod }})</button>
              <button @click="onReset" class="btn btn-ghost">重置当前周期</button>
            </div>
            <p class="text-xs text-gray-600 mt-2">打开下一会计期：上一会计期进度自动归档（只读保留），新月份从零开始</p>
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
import { ref, watch, computed } from 'vue'
import { store, deleteUnit, verifyAdmin, resetPeriod, changePwd, loadLogs, setDeadline, openNextPeriod, nextMonthOf } from '../data/store'
import UnitFormModal from './UnitFormModal.vue'

const subs = [{ key:'units', label:'单位维护' },{ key:'system', label:'系统管理' }]
const sub = ref('units')

const pwd = ref(''), err = ref(false)
async function onLogin() { err.value = !(await verifyAdmin(pwd.value)); if(store.adminAuthed) await loadLogs() }

// Modal state
const showModal = ref(false)
const editingUnit = ref(null)
function openAdd() { editingUnit.value = null; showModal.value = true }
function openEdit(u) { editingUnit.value = u; showModal.value = true }
function closeModal() { showModal.value = false; editingUnit.value = null }

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
const nextPeriod = computed(() => nextMonthOf(store.realCurrentPeriod))
async function onOpenNext() {
  if (!confirm(`确认打开下一会计期 ${nextPeriod.value}？\n当前会计期 ${store.realCurrentPeriod} 的进度将归档为只读，\n新周期所有单位从零开始。`)) return
  await openNextPeriod()
}
async function onReset() { if(confirm('重置当前周期?所有完成标记将被清空。')) await resetPeriod() }
async function onChangePwd() {
  if(!newPwd.value){ alert('请输入新密码'); return }
  const ok = await changePwd(oldPwd.value, newPwd.value)
  if(ok){ oldPwd.value=''; newPwd.value='' } else { alert('原密码错误') }
}

const labels = { check:'标记完成', uncheck:'取消标记', reset:'周期重置', addUnit:'新增单位', editUnit:'编辑单位', delUnit:'删除单位', changePwd:'修改密码', setDeadline:'设置截止', openNextPeriod:'打开下一会计期' }
function actionLabel(a) { return labels[a]||a }
function actionColor(a) {
  const m={ check:'text-green-400', uncheck:'text-gray-500', reset:'text-yellow-400', addUnit:'text-green-400', editUnit:'text-green-300', delUnit:'text-red-400', changePwd:'text-yellow-400', setDeadline:'text-green-400', openNextPeriod:'text-yellow-400' }
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
