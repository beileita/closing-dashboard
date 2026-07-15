<template>
  <div class="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
    <!-- 密码 gate -->
    <div v-if="!store.adminAuthed" class="max-w-sm mx-auto mt-10 md:mt-16 glass rounded-xl p-6">
      <div class="text-tech-green font-medium mb-3 flex items-center gap-2">🔒 管理员验证</div>
      <input v-model="pwd" type="password" class="ipt mb-3" placeholder="管理员密码(演示:admin123)" @keyup.enter="onLogin" />
      <button @click="onLogin" class="btn btn-primary w-full">进入</button>
      <p v-if="err" class="text-red-400 text-xs mt-2">密码错误,请重试</p>
    </div>

    <template v-else>
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
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { store, verifyAdmin, resetPeriod, changePwd, loadLogs } from '../data/store'

const pwd = ref('')
const err = ref(false)
const oldPwd = ref('')
const newPwd = ref('')

async function onLogin() {
  err.value = !(await verifyAdmin(pwd.value))
  if (store.adminAuthed) await loadLogs()
}
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
