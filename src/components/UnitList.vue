<template>
  <div class="flex flex-col h-full">
    <!-- 三个子标签 -->
    <div class="flex border-b border-tech-border">
      <button
        v-for="t in tabs"
        :key="t.key"
        @click="setTab(t.key)"
        :class="[
          'flex-1 py-3 text-sm transition relative',
          store.selectedTab === t.key ? 'text-tech-green neon' : 'text-tech-muted hover:text-tech-green',
        ]"
      >
        {{ t.label }}
        <span class="ml-1 text-xs opacity-70">({{ countFor(t.key) }})</span>
        <span v-if="store.selectedTab === t.key" class="absolute bottom-0 left-0 right-0 h-0.5 bg-tech-green shadow-glowsoft"></span>
      </button>
    </div>

    <div ref="scrollEl" class="flex-1 overflow-y-auto p-2">
      <!-- 全部:省/市可折叠树 -->
      <template v-if="store.selectedTab === 'all'">
        <div v-for="g in groupsAll" :key="g.province" class="mb-0.5">
          <button
            @click="toggle('p:' + g.province)"
            class="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-tech-green/5"
          >
            <span class="flex items-center gap-1.5 text-sm">
              <span class="text-tech-green text-[10px] w-3">{{ expanded('p:' + g.province) ? '▼' : '▶' }}</span>
              <span :class="g.done === g.total ? 'text-tech-green' : 'text-tech-fg'">{{ g.province }}</span>
            </span>
            <span class="font-mono text-xs" :class="g.done === g.total ? 'text-tech-green' : 'text-tech-muted'">{{ g.done }}/{{ g.total }}</span>
          </button>
          <div v-show="expanded('p:' + g.province)">
            <div v-for="c in g.cities" :key="c.city" class="ml-3">
              <button
                @click="toggle('c:' + g.province + ':' + c.city)"
                class="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-tech-green/5"
              >
                <span class="flex items-center gap-1.5 text-xs text-tech-muted">
                  <span class="text-[10px] w-3">{{ expanded('c:' + g.province + ':' + c.city) ? '▼' : '▶' }}</span>
                  {{ c.city }}
                </span>
                <span class="font-mono text-xs text-tech-muted">{{ c.done }}/{{ c.total }}</span>
              </button>
              <div v-show="expanded('c:' + g.province + ':' + c.city)">
                <UnitRow v-for="u in c.units" :key="u.id" :unit="u" />
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 已完成 / 未完成:默认展开,按省分组 -->
      <template v-else>
        <div v-for="g in groupsFiltered" :key="g.province" class="mb-1">
          <div class="px-2 py-1 text-xs text-tech-green/80 font-medium flex items-center justify-between">
            <span>{{ g.province }}</span>
            <span class="text-tech-muted">({{ g.units.length }})</span>
          </div>
          <UnitRow v-for="u in g.units" :key="u.id" :unit="u" />
        </div>
        <div v-if="groupsFiltered.length === 0" class="text-center text-tech-muted text-sm py-10">暂无单位</div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { store, setTab, isDone } from '../data/store'
import UnitRow from './UnitRow.vue'

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'done', label: '已完成' },
  { key: 'undone', label: '未完成' },
]

const groupsAll = computed(() => {
  const map = {}
  for (const u of store.units) {
    ;(map[u.province] = map[u.province] || {})[u.city] = (map[u.province][u.city] || []).concat(u)
  }
  return Object.keys(map)
    .sort()
    .map((province) => {
      const cities = Object.keys(map[province])
        .sort()
        .map((city) => {
          const units = map[province][city]
          return { city, units, total: units.length, done: units.filter((u) => isDone(u.id)).length }
        })
      return {
        province,
        cities,
        total: cities.reduce((s, c) => s + c.total, 0),
        done: cities.reduce((s, c) => s + c.done, 0),
      }
    })
})

const groupsFiltered = computed(() => {
  const wantDone = store.selectedTab === 'done'
  const map = {}
  for (const u of store.units) {
    if (isDone(u.id) !== wantDone) continue
    ;(map[u.province] = map[u.province] || []).push(u)
  }
  return Object.keys(map)
    .sort()
    .map((province) => ({ province, units: map[province] }))
})

function countFor(tab) {
  if (tab === 'all') return store.units.length
  if (tab === 'done') return store.units.filter((u) => isDone(u.id)).length
  return store.units.filter((u) => !isDone(u.id)).length
}

function expanded(key) {
  return store.expanded.has(key)
}
function toggle(key) {
  if (store.expanded.has(key)) store.expanded.delete(key)
  else store.expanded.add(key)
}

// 选中单位时(如从地图点选)自动展开其省/市
watch(
  () => store.selectedUnitId,
  (id) => {
    if (!id) return
    const u = store.units.find((x) => x.id === id)
    if (!u) return
    store.expanded.add('p:' + u.province)
    store.expanded.add('c:' + u.province + ':' + u.city)
  }
)
</script>
