<template>
  <div
    :data-uid="unit.id"
    @click="onSelect"
    :class="[
      'flex items-center gap-2 pl-8 pr-2 py-1.5 rounded cursor-pointer transition border-l-2',
      selected ? 'bg-tech-green/10 border-tech-green' : 'border-transparent hover:bg-tech-green/5',
    ]"
  >
    <button
      @click.stop="onToggle"
      :disabled="!canToggle"
      :title="canToggle ? (done ? '取消标记' : '标记完成') : '历史周期不可修改'"
      :class="[
        'w-3 h-3 rounded-full shrink-0 transition',
        done ? 'bg-tech-green dot-done' : 'bg-tech-dim border border-tech-border',
        !canToggle && 'opacity-50 cursor-not-allowed',
      ]"
    ></button>
    <span class="flex-1 text-sm truncate" :class="done ? 'text-tech-green/90' : 'text-tech-fg'">{{ unit.name }}</span>
    <span v-if="done" class="font-mono text-xs text-tech-muted shrink-0">{{ time }}</span>
  </div>
</template>

<script setup>
import { computed, watch, nextTick } from 'vue'
import { store, selectUnit, toggleUnit, isDone } from '../data/store'

const props = defineProps({ unit: Object })

const done = computed(() => isDone(props.unit.id))
const selected = computed(() => store.selectedUnitId === props.unit.id)
const canToggle = computed(() => store.currentPeriod === store.realCurrentPeriod)

const time = computed(() => {
  const rec = store.progress[props.unit.id]
  if (!rec || !rec.doneAt) return ''
  const d = new Date(rec.doneAt)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
})

function onSelect() {
  selectUnit(props.unit.id)
}
function onToggle() {
  if (canToggle.value) toggleUnit(props.unit.id)
}

// 联动:被选中时滚动到可视区
watch(selected, async (s) => {
  if (!s) return
  await nextTick()
  const node = document.querySelector(`[data-uid="${props.unit.id}"]`)
  if (node) node.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
})
</script>
