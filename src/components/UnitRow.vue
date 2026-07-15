<template>
  <div :data-uid="unit.id" @click="onSelect"
    :class="['flex items-center gap-2 pl-8 pr-2 py-1.5 rounded-lg cursor-pointer transition-all duration-200 border-l-2 mx-0.5',
      selected?'bg-green-700/10 border-green-500':'border-transparent hover:bg-gray-700/20']">
    <!-- 快速勾选按钮 -->
    <button @click.stop="onToggle" :disabled="!canToggle"
      :title="canToggle?(done?'取消标记':'标记完成'):'历史周期不可修改'"
      :class="['w-4 h-4 rounded-full shrink-0 transition-all duration-300 flex items-center justify-center',
        done?'bg-green-500 dot-done text-white':'border-2 border-gray-500 hover:border-green-500',
        !canToggle&&'opacity-30 cursor-not-allowed']">
      <span v-if="done" class="text-[10px] leading-none">✓</span>
    </button>
    <span class="flex-1 text-xs truncate font-medium" :class="done?'text-green-400':'text-white'">{{ unit.name }}</span>
    <span v-if="done" class="font-mono text-[10px] text-gray-400 shrink-0 bg-gray-900/60 px-1.5 py-0.5 rounded">{{ time }}</span>
    <span v-else class="text-[10px] text-gray-600 shrink-0">{{ unit.city }}</span>
  </div>
</template>

<script setup>
import { computed, watch, nextTick } from 'vue'
import { store, selectUnit, toggleUnit, isDone } from '../data/store'

const props = defineProps({ unit:Object })
const done = computed(() => isDone(props.unit.id))
const selected = computed(() => store.selectedUnitId===props.unit.id)
const canToggle = computed(() => store.currentPeriod===store.realCurrentPeriod)
const time = computed(() => {
  const rec = store.progress[props.unit.id]
  if(!rec||!rec.doneAt) return ''
  const d = new Date(rec.doneAt)
  return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
})

function onSelect() { selectUnit(props.unit.id) }
function onToggle() { if(canToggle.value) toggleUnit(props.unit.id) }

watch(selected, async s => {
  if(!s) return; await nextTick()
  const node = document.querySelector(`[data-uid="${props.unit.id}"]`)
  if(node) node.scrollIntoView({ behavior:'smooth', block:'nearest' })
})
</script>
