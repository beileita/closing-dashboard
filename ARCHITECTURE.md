# 青岛啤酒财务共享中心 — 结账进度看板

## 技术栈

| 项 | 值 |
|---|-----|
| 框架 | Vue 3 Composition API + Vite |
| 图表 | ECharts 5 (effectScatter + GeoJSON 地图) |
| CSS | Tailwind CSS 3 |
| 特效 | Three.js 粒子背景（WebGL，桌面端） |
| 后端 | 腾讯云 CloudBase（文档数据库 + 匿名登录 + 静态托管） |
| 实时同步 | CloudBase `watch()` 长连接推送 |
| 部署 | `tcb hosting deploy` 到 CloudBase 静态网站托管 |
| 配色 | 青啤绿 `#008A4C` · 背景 `#070b14` · 卡片 `#131826` |

## 组件树

```
App.vue
├── ParticleBg.vue              — Three.js 粒子背景
├── Dashboard.vue               — 看板主页
│   ├── UnitList.vue            — 左侧单位列表（全部/已完成/未完成分页签）
│   │   └── UnitRow.vue         — 单行：勾选按钮 + 名称 + 时间
│   └── ChinaMap.vue            — ECharts 中国地图 + 散点 + 省份下钻
└── Manage.vue                  — 管理面板
    └── UnitFormModal.vue       — 新增/编辑单位弹窗（内嵌 ECharts 坐标拾取地图）
```

## 数据流

```
CloudBase 数据库 (units / progress / logs / config)
        │
        │  watch() 长连接（实时推送）
        ├────────── 写入（用户操作）
        │
        ▼
backend.js           — 数据层：watch 监听 + CRUD + 代际机制 + 软删除
        │
        ▼
store.js             — Vue 3 reactive() 全局单例状态
        │
        ▼
组件 (App / Dashboard / ChinaMap / Manage / UnitFormModal)
```

## 同步架构（v7 — watch 实时推送）

### 核心原则

1. **CloudBase 是唯一数据源** — 所有状态变更通过 CloudBase 写入
2. **watch() 替代轮询** — 长连接推送，延迟从 3 秒降到百毫秒级
3. **乐观 UI + 防重复** — toggle 立即更新 UI，watch 回推时通过 pending 标记跳过重复通知
4. **代际机制** — reset 递增 gen，查询只读当前 gen，旧文档自然失效
5. **软删除** — 单位删除用 `update({deleted:true})` 代替 `remove()`

### 实时同步链路

```
设备 A 标记完成
  → store.toggleUnit(unitId)
    → 乐观 UI：store.progress[unitId] = {done:true}  ← 立即反映
    → backend.toggle() → CloudBase progress 集合写入
    → CloudBase watch 推送到所有客户端
      → 设备 A：_pendingToggle 匹配 → 跳过（已处理）
      → 设备 B/C：_pendingToggle 不匹配 → toast + flash
```

```
设备 A 新增单位
  → store.addUnit(data)
    → backend.addUnit() → CloudBase units 集合写入
    → CloudBase watch 推送到所有客户端
      → 所有设备：store.units 更新 → 列表 + 地图自动刷新
```

### 代际机制（progress 集合）

```
config 集合:  { key: "resetGen", value: 1690000000000 }

progress 集合:
  { unitId: "A", period: "2026-07", gen: 1690000000000, done: true }
  { unitId: "A", period: "2026-07", gen: 1680000000000, done: true }  ← 查不到

resetPeriod():
  1. incrementGen → config.resetGen = Date.now()
  2. 重启 progress watcher（where {period, gen: newGen}）
  3. 旧 gen 文档自然失效（新 watcher 查询条件不匹配）
  4. 清理旧文档（best effort，失败不影响）
```

### 降级策略

当 `watch()` 不可用时（网络限制、SDK 版本等），自动回退到 3 秒轮询：

```
watch() onError → fallbackToPolling() → setInterval(pollProgress, 3000)
```

## 安全规则（重要）

**所有 4 个集合必须设置为：**

```json
{"read": "auth != null", "write": "auth != null"}
```

如果使用默认规则（`auth.openid == doc._openid`），不同设备的匿名用户无法互相修改文档，导致删除/编辑返回 `updated: 0`。

详见 `CLOUDBASE_SETUP.md`。

## 单位 CRUD（软删除）

| 操作 | 方法 | 同步方式 |
|------|------|----------|
| 新增 | `collection('units').add(data)` → 回写 `id` | watch 推送到所有客户端 |
| 编辑 | `collection('units').doc(_id).update(patch)` | watch 推送到所有客户端 |
| 删除 | `collection('units').doc(_id).update({deleted:true})` | watch 推送 → 客户端过滤 `!deleted` |
| 查询 | `watchUnits()` 自动过滤 `r => !r.deleted` | 实时 |

### ID 处理

- CloudBase 文档使用 `_id` 作为主键（自动生成）
- `getUnits()` 和 `watchUnits()` 读取时归一化：`{ ...doc, id: doc._id }`
- CRUD 操作直接使用 `_id`，不再通过 `where({_id})` 二次查找

## 地图模块

### 数据源

| 级别 | 来源 |
|------|------|
| 全国 | `public/china.json`（DataV 格式，过滤南海诸岛） |
| 省份 | `public/geojson/{adcode}.json` |

### 防散点分离

`geoRoam` 事件跟踪缩放/拖拽状态，交互期间暂停 `updateData`：

```javascript
chart.on('geoRoam', () => {
  isRoaming = true
  clearTimeout(roamTimer)
  roamTimer = setTimeout(() => { isRoaming = false }, 600)
})
```

### 坐标拾取（UnitFormModal 内嵌地图）

- 单击区域 → 下钻（全国→省→市）
- 双击地图 → `convertFromPixel` 计算经纬度 → 绿色标记
- 面包屑导航可返回上级

## 部署

```bash
npx vite build
tcb hosting deploy dist -e ysy-server-d7gwidmgv14f8da68
```

| 配置 | 值 |
|------|-----|
| 环境 ID | `ysy-server-d7gwidmgv14f8da68` |
| 访问地址 | `https://ysy-server-d7gwidmgv14f8da68-1377434139.tcloudbaseapp.com` |
| 数据库集合 | `units`, `progress`, `logs`, `config` |
| 认证方式 | CloudBase 匿名登录 |

## 文件清单

```
src/
├── main.js
├── App.vue
├── data/
│   ├── store.js              — 全局状态 + v7 watch 同步逻辑
│   ├── backend.js            — CloudBase CRUD + watch 监听 + 代际机制
│   ├── adcode.js             — 省份名→行政区划代码映射
│   └── mock.js               — 本地 mock 数据（CloudBase 不可用时降级）
├── components/
│   ├── Dashboard.vue         — 看板主页（统计卡片 + 列表 + 地图）
│   ├── ChinaMap.vue          — ECharts 中国地图
│   ├── UnitList.vue          — 单位列表（分页签）
│   ├── UnitRow.vue           — 单位行
│   ├── Manage.vue            — 管理面板
│   ├── UnitFormModal.vue     — 新增/编辑单位弹窗 + 坐标拾取
│   └── ParticleBg.vue        — Three.js 粒子背景
└── utils/
    ├── cloudbase.js          — CloudBase SDK 初始化 + 匿名登录
    └── webgl.js              — WebGL 检测
```
