<template>
  <div class="flex flex-col h-full">
    <div class="flex border-b border-gray-700/30 px-1">
      <button v-for="t in tabs" :key="t.key" @click="setTab(t.key)"
        :class="['flex-1 py-2.5 text-xs font-medium transition relative', store.selectedTab===t.key?'text-green-400':'text-gray-500 hover:text-gray-300']">
        {{ t.label }} <span class="ml-1 opacity-50 font-mono">({{ countFor(t.key) }})</span>
        <span v-if="store.selectedTab===t.key" class="absolute bottom-0 left-3 right-3 h-0.5 bg-green-500 rounded-full"></span>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-1.5">
      <template v-if="store.selectedTab==='all'">
        <div v-for="g in groupsAll" :key="g.province" class="mb-0.5">
          <button @click="toggle('p:'+g.province)" class="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-gray-700/20 transition">
            <span class="flex items-center gap-1.5 text-sm">
              <span class="text-gray-600 text-[10px] w-3">{{ expanded('p:'+g.province)?'▼':'▶' }}</span>
              <span :class="g.done===g.total?'text-green-400':'text-white'">{{ g.province }}</span>
            </span>
            <span class="font-mono text-xs" :class="g.done===g.total?'text-green-400':'text-gray-500'">{{ g.done }}/{{ g.total }}</span>
          </button>
          <div v-show="expanded('p:'+g.province)">
            <div v-for="c in g.cities" :key="c.city" class="ml-3">
              <button @click="toggle('c:'+g.province+':'+c.city)" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-gray-700/20">
                <span class="flex items-center gap-1.5 text-xs text-gray-400">
                  <span class="text-[10px] w-3 text-gray-600">{{ expanded('c:'+g.province+':'+c.city)?'▼':'▶' }}</span> {{ c.city }}
                </span>
                <span class="font-mono text-xs text-gray-500">{{ c.done }}/{{ c.total }}</span>
              </button>
              <div v-show="expanded('c:'+g.province+':'+c.city)"><UnitRow v-for="u in c.units" :key="u.id" :unit="u" /></div>
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <div v-for="g in groupsFiltered" :key="g.province" class="mb-1">
          <div class="px-2.5 py-1.5 text-xs text-gray-400 font-medium flex justify-between"><span>{{ g.province }}</span><span>({{ g.units.length }})</span></div>
          <UnitRow v-for="u in g.units" :key="u.id" :unit="u" />
        </div>
        <div v-if="groupsFiltered.length===0" class="text-center text-gray-500 text-sm py-10">暂无单位</div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { store, setTab, isDone } from '../data/store'
import UnitRow from './UnitRow.vue'

const tabs = [{ key:'all', label:'全部' },{ key:'done', label:'已完成' },{ key:'undone', label:'未完成' }]

const groupsAll = computed(() => {
  const map = {}
  for(const u of store.units) { (map[u.province]=map[u.province]||{})[u.city]=(map[u.province][u.city]||[]).concat(u) }
  return Object.keys(map).sort().map(province => {
    const cities = Object.keys(map[province]).sort().map(city => {
      const units = map[province][city]
      return { city, units, total:units.length, done:units.filter(u=>isDone(u.id)).length }
    })
    return { province, cities, total:cities.reduce((s,c)=>s+c.total,0), done:cities.reduce((s,c)=>s+c.done,0) }
  })
})

const groupsFiltered = computed(() => {
  const want = store.selectedTab==='done'
  const map = {}
  for(const u of store.units) { if(isDone(u.id)!==want) continue; (map[u.province]=map[u.province]||[]).push(u) }
  return Object.keys(map).sort().map(province => ({ province, units:map[province] }))
})

function countFor(tab) {
  if(tab==='all') return store.units.length
  if(tab==='done') return store.units.filter(u=>isDone(u.id)).length
  return store.units.filter(u=>!isDone(u.id)).length
}
function expanded(key) { return store.expanded.has(key) }
function toggle(key) { store.expanded.has(key) ? store.expanded.delete(key) : store.expanded.add(key) }

watch(()=>store.selectedUnitId, id => {
  if(!id) return; const u=store.units.find(x=>x.id===id)
  if(!u) return; store.expanded.add('p:'+u.province); store.expanded.add('c:'+u.province+':'+u.city)
})
</script>
