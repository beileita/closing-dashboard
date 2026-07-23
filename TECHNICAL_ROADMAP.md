# 青岛啤酒财务共享中心 — 结账进度看板 技术路线

## 一、项目概述

### 1.1 业务背景

青岛啤酒财务共享中心每月末需要协调全国 30+ 个业务单位完成财务结账。需要一个**实时、跨设备同步**的进度看板，让管理层和各业务单位能直观看到结账进度。

### 1.2 核心需求

| 需求 | 描述 | 优先级 |
|------|------|--------|
| 中国地图可视化 | ECharts 中国地图 + 散点标注各单位位置，省份下钻 | P0 |
| 实时同步 | 多设备（电脑、手机）同时查看，状态实时一致 | P0 |
| 单位管理 | 增删改业务单位，含经纬度坐标拾取 | P1 |
| 周期管理 | 月度结账周期切换 + 一键重置 | P1 |
| 进度统计 | 完成率环形图、进度条、倒计时 | P2 |
| 操作日志 | 审计追踪：谁在什么设备上做了什么操作 | P2 |
| 管理后台 | 密码保护的管理面板 | P2 |

---

## 二、技术选型与理由

### 2.1 前端框架：Vue 3 Composition API + Vite

| 考量维度 | 选型理由 |
|----------|----------|
| 响应式系统 | `reactive()` 全局单例 store，跨组件自动更新，无需引入 Vuex/Pinia |
| 构建速度 | Vite 的 ESM 原生开发服务器，HMR 毫秒级 |
| 打包体积 | Tree-shaking 友好，按需加载 ECharts 模块 |
| 团队门槛 | Composition API 比 React Hooks 学习曲线平缓 |

### 2.2 图表库：ECharts 5

| 考量维度 | 选型理由 |
|----------|----------|
| 地图支持 | 原生 `geo` + `effectScatter`，内置 GeoJSON 注册机制 |
| 下钻能力 | `echarts.registerMap()` 动态注册省份 GeoJSON，无缝切换 |
| 性能 | Canvas 渲染器，30+ 散点 + 涟漪效果无压力 |
| 备选对比 | Mapbox/Leaflet 偏 GIS 瓦片地图，对业务看板过重；D3.js 需要手写投影和交互 |

**关键决策：为何不用瓦片地图？**

财务看板的地图是**示意性**的（展示业务单位分布），不需要街道级精度。GeoJSON 矢量地图离线可用、无 API 费用、样式完全可控。

### 2.3 后端服务：腾讯云 CloudBase

| 考量维度 | 选型理由 |
|----------|----------|
| 零运维 | 无服务器架构，无需管理数据库实例 |
| 实时推送 | `watch()` API 基于 WebSocket 长连接，延迟百毫秒级 |
| 认证 | 匿名登录开箱即用，无需自建用户系统 |
| 静态托管 | `tcb hosting deploy` 一键部署，自带 CDN |
| 免费额度 | 小型项目在免费额度内 |

**备选方案对比：**

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| CloudBase | 零运维、实时推送、免费 | 锁定腾讯云 | ✅ 选用 |
| Supabase | PostgreSQL、开源 | 国内访问慢、需自建或付费 | ❌ |
| 自建 Node.js + WebSocket | 完全可控 | 需要服务器运维、DDoS 防护 | ❌ |
| Firebase | 成熟稳定 | 国内不可用 | ❌ |

### 2.4 粒子背景：Three.js

仅在桌面端 WebGL 可用时加载。Canvas 2D 粒子在移动端性能不足，Three.js 利用 GPU 渲染 2000+ 粒子无压力。`echarts-gl` 依赖 Three.js，两个库共用一份。

---

## 三、架构设计

### 3.1 分层架构

```
┌───────────────────────────────────────────────────┐
│                    视图层 (Vue)                      │
│  App.vue → Dashboard / Manage                      │
│  ChinaMap.vue / UnitList.vue / UnitFormModal.vue   │
│  ParticleBg.vue (Three.js)                         │
├───────────────────────────────────────────────────┤
│                  状态层 (store.js)                   │
│  reactive() 全局单例                                │
│  乐观 UI + pending 防重复                            │
│  watch() 实时监听 / 轮询降级                          │
├───────────────────────────────────────────────────┤
│              数据层 (backend.js)                     │
│  CloudBase CRUD 封装                                │
│  watchProgress() / watchUnits() 监听器工厂           │
│  代际机制 (gen) + 软删除                             │
│  本地 mock 降级                                     │
├───────────────────────────────────────────────────┤
│           传输层 (cloudbase.js)                      │
│  @cloudbase/js-sdk 初始化                           │
│  匿名登录 + 数据库实例                               │
├───────────────────────────────────────────────────┤
│             CloudBase 云端                           │
│  集合: units / progress / config / logs             │
│  安全规则 + 静态托管                                 │
└───────────────────────────────────────────────────┘
```

### 3.2 数据流（完整链路）

```
用户点击「标记完成」
  │
  ├─→ UnitRow.onToggle() / ChinaMap.onToggle()
  │     │
  │     └─→ store.toggleUnit(unitId)
  │           │
  │           ├─→ 乐观更新 store.progress[unitId]  ← 立即反映到 UI
  │           ├─→ 设置 _pendingToggle 标记          ← 防止 watch 回推重复通知
  │           ├─→ addToast / store.flash++           ← 即时反馈
  │           │
  │           └─→ backend.toggle(unitId, period)
  │                 │
  │                 ├─→ ensureGen()                    ← 获取当前代际
  │                 ├─→ where({unitId, period, gen})  ← 查询是否已存在
  │                 ├─→ doc.update() / add()          ← CloudBase 写入
  │                 └─→ 返回 toggle 结果
  │
  └─→ CloudBase 数据库更新
        │
        └─→ watch() 推送 snapshot 到所有在线客户端
              │
              ├─→ 设备 A (发起者):
              │     onChange(progress, docChanges)
              │     → _pendingToggle 匹配 → 跳过通知
              │
              └─→ 设备 B/C (其他):
                    onChange(progress, docChanges)
                    → dataType === 'update'
                    → 检查 done 状态变化
                    → addToast + store.flash++
                    → store.progress 更新 → Vue 响应式 → UI 刷新
```

### 3.3 组件通信

```
store (全局单例 reactive)
  ├── App.vue
  │     ├── read: store.view, store.currentPeriod, store.deadline
  │     └── write: init(), loadPeriod(), setView()
  │
  ├── Dashboard.vue
  │     ├── read: store.units (computed: done/total)
  │     └── children: UnitList, ChinaMap
  │
  ├── UnitList.vue / UnitRow.vue
  │     ├── read: store.units, store.progress, store.selectedUnitId
  │     └── write: selectUnit(), toggleUnit(), setTab()
  │
  ├── ChinaMap.vue
  │     ├── read: store.units, store.progress, store.selectedUnitId
  │     ├── write: selectUnit(), toggleUnit()
  │     └── watch: store.progress → updateData()
  │
  ├── Manage.vue
  │     ├── read: store.units, store.logs, store.adminAuthed
  │     └── write: deleteUnit(), resetPeriod(), setDeadline()
  │
  └── UnitFormModal.vue
        ├── read: store (无直接依赖)
        └── write: addUnit(), updateUnit()
```

---

## 四、同步机制详解

### 4.1 v7 watch 实时推送

**原理：**

CloudBase 数据库的 `watch()` 基于 WebSocket 长连接。客户端订阅一个查询条件，当匹配的文档发生变化时，服务端主动推送 `snapshot`。

```
Client A ──write──▶ CloudBase DB ──push──▶ Client A (watcher)
                              ──push──▶ Client B (watcher)
                              ──push──▶ Client C (watcher)
```

**代码实现：**

```javascript
// backend.js — 监听器工厂
export function watchProgress(period, gen, onChange, onError) {
  const d = db()
  const watcher = d.collection('progress')
    .where({ period, gen })       // 只监听当前周期 + 当前 gen
    .limit(1000)
    .watch({
      onChange: (snapshot) => {
        // snapshot.docs = 完整结果集
        // snapshot.docChanges = 增量变更 [{dataType, doc, id}]
        const map = {}
        for (const doc of snapshot.docs) {
          map[doc.unitId] = { done: doc.done, doneAt: doc.doneAt, ... }
        }
        onChange(map, snapshot.docChanges)
      },
      onError: (err) => { /* 降级轮询 */ }
    })
  return watcher  // 调用方需 close()
}
```

**dataType 含义：**

| dataType | 触发时机 | 处理方式 |
|----------|----------|----------|
| `init` | 首次订阅，全量快照 | 静默设置 store，不弹通知 |
| `add` | 新文档进入查询范围 | 检查 done 状态 → 弹通知 |
| `update` | 已有文档字段变更 | 检查 done 状态变化 → 弹通知 |
| `remove` | 文档离开查询范围 | 清理本地状态 |

### 4.2 乐观 UI + 防重复

toggle 是最频繁的操作，需要即时反馈。但 watch 回推会造成"操作一次，通知两次"。

**解决方案：`_pendingToggle` 标记**

```javascript
// store.js
let _pendingToggle = null  // { unitId, timer }

export async function toggleUnit(unitId) {
  // 1. 乐观更新（立即反映）
  store.progress = { ...store.progress, [unitId]: { done: true, ... } }
  addToast('✓ 已完成结账', 'ok')

  // 2. 标记 pending（5 秒超时）
  _pendingToggle = { unitId, timer: setTimeout(() => _pendingToggle = null, 5000) }

  // 3. 写入 CloudBase
  await backend.toggle(unitId, period)
  // watch 回推时检查 _pendingToggle → 匹配则跳过通知
}
```

**时序图：**

```
时间轴 →

用户点击 ─┬─ 乐观 UI 更新 (t=0ms)
           ├─ toast + flash (t=0ms)
           ├─ CloudBase 写入 (t=50ms)
           │
watch 回推 ─┼─ 检查 _pendingToggle
           ├─ 匹配 → 跳过 (t=200ms)
           │
5秒超时 ───┼─ _pendingToggle = null (t=5000ms)
```

### 4.3 代际机制（Reset）

**为什么不用 `remove()` 批量删除？**

CloudBase 的 `remove()` 受最终一致性影响：删除操作可能在其他客户端的查询结果中延迟生效。这导致"重置完还有几个亮着"的问题。

**代际机制：**

```
progress 集合：
  { unitId: "u001", period: "2026-07", gen: 1000, done: true }   ← gen 1
  { unitId: "u001", period: "2026-07", gen: 2000, done: false }  ← gen 2

watch({period: "2026-07", gen: 2000}) → 只匹配 gen=2000 的文档
旧 gen 文档自动不可见 → 无需等待删除传播
```

**Reset 流程：**

```
resetPeriod()
  → incrementGen()                      config.resetGen = Date.now()
  → 关闭旧 progressWatcher
  → 启动新 progressWatcher(period, newGen)
  → store.progress = {}                 本地清空
  → 清理旧 gen 文档（best effort）
```

### 4.4 降级策略

```
watch() 尝试
  ├─ 成功 → 实时推送模式（延迟 < 1s）
  └─ 失败 → onError → fallbackToPolling()
              └─ setInterval(pollProgress, 3000)  ← v6 兼容模式
```

降级触发条件：WebSocket 被防火墙阻止、SDK 版本不支持、CloudBase 套餐限制。

---

## 五、数据库设计

### 5.1 集合 Schema

**units（业务单位）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | CloudBase 自动生成的主键 |
| `id` | string | 回写的 `_id`，方便 where 查询 |
| `name` | string | 单位名称 |
| `province` | string | 省（如"山东省"） |
| `city` | string | 市（如"青岛市"） |
| `district` | string | 区（可选，如"市南区"） |
| `lng` | number | 经度 |
| `lat` | number | 纬度 |
| `owner` | string | 负责人 |
| `createdAt` | number | 创建时间戳 |
| `deleted` | boolean | 软删除标记 |

**progress（结账进度）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 自动生成 |
| `unitId` | string | 关联 units._id |
| `period` | string | 周期，如 "2026-07" |
| `gen` | number | 代际，来自 config.resetGen |
| `done` | boolean | 是否已完成 |
| `doneAt` | number | 完成时间戳 |
| `operator` | string | 操作人标识 |
| `device` | string | 设备标识 |

**config（配置）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 自动生成 |
| `key` | string | 配置键：resetGen / deadline / adminPwd |
| `value` | any | 配置值 |

**logs（操作日志）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 自动生成 |
| `action` | string | check / uncheck / reset / addUnit / editUnit / delUnit |
| `ts` | number | 时间戳 |
| `operator` | string | 操作人 |
| `device` | string | 设备标识 |
| `unitId` | string | 关联单位 |
| `period` | string | 关联周期 |

### 5.2 索引建议

```
units:     _id (自动), createdAt (升序)
progress:  period + gen (复合), unitId + period + gen (复合)
config:    key (唯一)
logs:      ts (降序)
```

### 5.3 安全规则

所有 4 个集合统一设置：

```json
{
  "read": "auth != null",
  "write": "auth != null"
}
```

| 规则 | 含义 |
|------|------|
| `auth != null` | 任何已登录用户（含匿名）可操作 |
| `auth.openid == doc._openid` | 仅创建者可操作（**会导致跨设备失败**） |

---

## 六、地图技术方案

### 6.1 GeoJSON 数据源

| 级别 | 数据 | 来源 |
|------|------|------|
| 全国 | 34 省级行政区 | `public/china.json`（DataV 格式） |
| 省级 | 333 地级市 | `public/geojson/{adcode}.json` |

**DataV API（降级）：**
```
https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json
```

### 6.2 南海诸岛处理

DataV 格式的中国地图 GeoJSON 包含南海诸岛的 9 段线区域。全图渲染时这些区域会拉伸地图视野。处理方式：

```javascript
const SCS_NAMES = ['南海诸岛', '南海诸岛及其它', '南沙群岛', '中沙群岛', '东沙群岛', '西沙群岛', '九段线']

function filterSouthChinaSea(geojson) {
  return {
    ...geojson,
    features: geojson.features.filter(f => !SCS_NAMES.includes(f.properties?.name))
  }
}
```

### 6.3 散点与地图分离问题

**原因：** ECharts 在 `geoRoam`（缩放/拖拽）期间，如果调用 `setOption` 更新 series 数据，散点坐标基于旧的投影参数计算，导致与地图脱节。

**修复：** 跟踪 roam 状态，交互期间跳过数据更新：

```javascript
let isRoaming = false, roamTimer = null

chart.on('geoRoam', () => {
  isRoaming = true
  clearTimeout(roamTimer)
  roamTimer = setTimeout(() => { isRoaming = false }, 600)
})

function updateData() {
  if (isRoaming) return  // 交互期间跳过
  // ... setOption
}
```

### 6.4 坐标拾取（UnitFormModal 地图）

```
用户双击地图
  → zrender dblclick 事件
  → e.event.clientX/Y - mapEl.getBoundingClientRect()
  → chart.convertFromPixel([x, y])
  → [lng, lat] 经纬度数组
  → 绿色 effectScatter 标记
  → form.lng / form.lat 更新
```

---

## 七、部署与运维

### 7.1 构建部署

```bash
# 开发
npm run dev                    # http://localhost:5173

# 生产构建
npx vite build                 # → dist/

# 部署到 CloudBase
tcb hosting deploy dist -e ysy-server-d7gwidmgv14f8da68

# 访问
https://ysy-server-d7gwidmgv14f8da68-1377434139.tcloudbaseapp.com
```

### 7.2 环境变量

```
VITE_CLOUDBASE_ENV_ID=ysy-server-d7gwidmgv14f8da68
```

### 7.3 依赖版本

| 包 | 版本 | 用途 |
|----|------|------|
| vue | ^3.4.38 | 前端框架 |
| echarts | ^5.5.1 | 图表 + 地图 |
| echarts-gl | ^2.0.9 | 3D 扩展（Three.js 依赖） |
| three | ^0.165.0 | WebGL 粒子背景 |
| @cloudbase/js-sdk | ^3.6.2 | CloudBase 数据库 + 认证 |
| canvas-confetti | ^1.9.3 | 里程碑庆祝特效 |
| tailwindcss | ^3.4.10 | 原子化 CSS |
| vite | ^5.4.3 | 构建工具 |

### 7.4 CloudBase 配置

| 项 | 值 |
|----|-----|
| 环境 ID | `ysy-server-d7gwidmgv14f8da68` |
| 区域 | 上海 (ap-shanghai) |
| 认证 | 匿名登录 |
| 集合 | units, progress, config, logs |
| 静态托管 | 自定义域名 + CDN |

---

## 八、已知限制与改进方向

### 8.1 当前限制

| 限制 | 影响 | 改进方向 |
|------|------|----------|
| 匿名登录 | 无法区分用户身份 | 接入企业微信 OAuth |
| watch 文档数 ≤ 5000 | 单位数增长后的天花板 | 远未触及（30 单位） |
| 无云函数 | 复杂业务逻辑无法后端执行 | 数据库触发器 / 云函数 |
| 单环境 | 无开发/生产隔离 | 创建独立测试环境 |
| 无 HTTPS 证书管理 | 依赖 CloudBase 默认域名 | 绑定自定义域名 |

### 8.2 后续重构方向

1. **用户系统**：替换匿名登录为企业微信/飞书 OAuth
2. **云函数**：进度汇总统计、定时提醒、数据归档
3. **权限分级**：管理员 vs 普通用户（查看 vs 编辑）
4. **消息推送**：微信模板消息通知关键节点完成
5. **数据导出**：Excel 日报/月报生成
6. **单元测试**：Vitest + Vue Test Utils 覆盖核心逻辑
