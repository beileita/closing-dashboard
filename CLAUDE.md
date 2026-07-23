# 青岛啤酒财务共享中心 · 结账进度看板

> **给接手开发的 AI：读完这个文件就能完全掌握项目全貌，无需翻代码历史。**

---

## 快速开始

```bash
# 克隆并安装
git clone https://github.com/beileita/closing-dashboard.git
cd closing-dashboard
npm install

# 开发
npm run dev          # → http://localhost:5173

# 构建 + 部署
npx vite build
npx tcb hosting deploy dist -e ysy-server-d7gwidmgv14f8da68

# 线上地址
# https://ysy-server-d7gwidmgv14f8da68-1377434139.tcloudbaseapp.com
```

---

## 项目是什么

**青岛啤酒财务共享中心**内部工具。每月末全国 30+ 业务单位需要完成财务结账，同事完成后来网页勾选 → 中国地图对应位置点亮（仪式感 + 老板看整体进度）。

**核心规则：**
- 中国地图 + 各省市业务单位散点，可下钻省份
- 实时同步（多设备同时看到同一状态）
- 免登录（CloudBase 匿名登录）、月度自动周期
- 左侧单位列表 + 右侧地图、左右联动
- 管理页：单位 CRUD（含地图坐标拾取）+ 周期重置 + 日志 + 改密

---

## 技术栈

| 层 | 技术 | 用途 |
|----|------|------|
| 框架 | Vue 3 Composition API + Vite | 前端 |
| 样式 | Tailwind CSS 3 | 原子化 CSS |
| 图表 | ECharts 5 + echarts-gl + Three.js | 2D/3D 地图 + 粒子背景 |
| 后端 | 腾讯云 CloudBase | 数据库 + 实时推送 + 静态托管 |
| 特效 | canvas-confetti | 里程碑庆祝 |
| 部署 | `tcb hosting deploy` | 一键部署到 CDN |

---

## 文件结构

```
closing-dashboard/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── cloudbaserc.json          # CloudBase 部署配置（envId）
├── .env                      # VITE_CLOUDBASE_ENV_ID
├── CLAUDE.md                 # ← 你正在读的文件
├── ARCHITECTURE.md           # 架构详解
├── TECHNICAL_ROADMAP.md      # 技术路线
├── CLOUDBASE_SETUP.md        # CloudBase 安全规则配置
│
├── public/
│   ├── china.json            # 中国 GeoJSON（DataV 格式）
│   └── geojson/
│       └── {adcode}.json     # 各省 GeoJSON（如 370000.json=山东）
│
├── dist/                     # 构建产物（已纳入 git，为部署方便）
│
└── src/
    ├── main.js               # 入口：createApp + 挂载 style.css
    ├── App.vue               # 根组件：头栏 + 倒计时 + 路由切换 + 里程碑
    ├── style.css             # 全局样式 + 双主题 CSS 变量 + Tailwind 组件类
    │
    ├── data/
    │   ├── store.js          # ★ 全局状态中心（最重要）
    │   ├── backend.js        # CloudBase CRUD + watch 监听 + 本地降级
    │   ├── mock.js           # 本地 mock 数据（CloudBase 不可用时降级）
    │   └── adcode.js         # 省份名 → 行政区划代码映射
    │
    ├── components/
    │   ├── Dashboard.vue     # 看板主页：统计卡片 + 列表 + 地图
    │   ├── ChinaMap.vue      # ★ ECharts 中国地图（散点 + 下钻 + 联动）
    │   ├── UnitList.vue      # 左侧单位列表（全部/已完成/未完成分页签）
    │   ├── UnitRow.vue       # 单行：勾选按钮 + 名称 + 时间
    │   ├── Manage.vue        # 管理面板（密码门 + 单位维护 + 系统管理）
    │   ├── UnitFormModal.vue # 新增/编辑单位弹窗（内嵌 ECharts 坐标拾取地图）
    │   └── ParticleBg.vue    # Three.js 粒子背景（桌面 WebGL）
    │
    └── utils/
        ├── cloudbase.js      # CloudBase SDK 初始化 + 匿名登录
        └── webgl.js          # WebGL 检测
```

---

## 架构核心：数据流

```
CloudBase 数据库
    │  watch() 长连接推送
    ▼
backend.js       — CRUD 封装 + watch 监听 + 代际机制 + 软删除 + 本地降级
    │
    ▼
store.js         — reactive() 全局单例状态，所有组件共享
    │
    ▼
组件树           — App → Dashboard → (UnitList + ChinaMap)
                            → Manage → UnitFormModal
```

**所有状态变更路径：**
- 用户操作 → store.toggleUnit() / addUnit() → 乐观更新 UI → backend 写入 CloudBase → watch 推送到所有客户端 → store 更新 → UI 自动响应
- **没有 Vue Router、Vuex/Pinia**。路由用 `store.view` 手动切换（dashboard/manage），状态全在 `store.js` 一个 `reactive()` 对象中

---

## 主题系统（v2.0 — 当前版本）

**双主题：** 夜间 `[data-theme="dark"]` / 日间 `[data-theme="light"]`

**工作机制：**
1. `style.css` 在 `:root` 定义暗色 CSS 变量，`[data-theme="light"]` 覆盖亮色
2. `[data-theme="light"]` 下大量覆写 Tailwind 工具类（如 `bg-gray-900 → #f0f2f5`），详见 style.css 中间段
3. `store.theme` 响应式状态，`toggleTheme()` 切换并写入 `localStorage`
4. ECharts 地图（ChinaMap.vue / UnitFormModal.vue）通过 `computed` 对象 `mapColors` / `mc` 返回当前主题色
5. Three.js 粒子颜色随主题变化

**修改配色只需改 style.css 中的 CSS 变量和 ChinaMap.vue 中的 `mapColors` getter。**

---

## 地图系统

### 数据源
- 全国：`public/china.json`（DataV GeoJSON，过滤了南海诸岛 9 段线）
- 省级：`public/geojson/{adcode}.json`（如 370000=山东）
- CDN 降级：`https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json`

### 关键实现 — ChinaMap.vue
- ECharts `geo` + `effectScatter`（已完成单位：绿色脉冲）/ `scatter`（未完成：灰色）
- 省份区域着色按完成率：`regionColor(r)` 函数计算 rgba
- **防散点分离：** `geoRoam` 期间暂停 `updateData()`，600ms 无操作后恢复
- **下钻：** 点击省份 → registerMap + 切换到省级 geojson → 按城市显示
- **左右联动：** 点击列表 → `chart.dispatchAction('highlight')` + 地图飞行动画；点击地图点 → 列表滚动到对应行 + 展开折叠

### UnitFormModal.vue 坐标拾取
- 全国→省→市逐级下钻（面包屑可回退）
- 双击地图 → `chart.convertFromPixel()` → 取得经纬度 → 绿色标记
- 点击市区域自动填充坐标（取 GeoJSON feature.center）

### 南海诸岛
- `filterSouthChinaSea()` 过滤 7 类南海相关 feature，保证地图视野在国内

---

## 数据层关键设计

### store.js（全局状态 — 最重要文件）
```js
reactive({
  units, progress, currentPeriod, selectedUnitId, selectedTab,
  expanded, deadline, view, logs, adminAuthed, toasts, flash,
  pulseUnitId, mobileView, theme, connectError, loading
})
```

- **toggleUnit():** 乐观 UI → 立即更新 store.progress + toast → backend 写入 → `_pendingToggle` 防 watch 回推重复通知（5 秒超时）
- **resetPeriod():** 递增 gen → 重启 progress watcher → 旧 gen 文档自动不可见（代际机制，避免 remove() 最终一致性问题）
- **init():** 加载单位 → 设置周期 → 获取 gen → 启动 watch（失败降级 3 秒轮询）

### backend.js — CloudBase v7
- **watchProgress():** `collection('progress').where({period, gen}).watch()` → onChange 回调
- **watchUnits():** `collection('units').watch()` → onChange 回调
- **代际机制：** config 集合存 `{key:"resetGen", value: timestamp}`，progress 文档含 gen 字段。watch 只查当前 gen → 旧文档自然失效
- **软删除：** 单位删除用 `update({deleted:true})` 而非 remove()，查询时过滤 `!deleted`
- **降级：** CloudBase 不可用 → 使用 `mock.js` 的本地内存数据（`process.env.NODE_ENV === 'development'` 且无 CloudBase 时）

### CloudBase 配置
| 项 | 值 |
|----|-----|
| 环境 ID | `ysy-server-d7gwidmgv14f8da68` |
| 区域 | 上海 (ap-shanghai) |
| 认证 | 匿名登录 |
| 集合 | `units`, `progress`, `config`, `logs` |
| 安全规则 | 所有集合 `{"read":"auth!=null","write":"auth!=null"}` |

---

## 常见问题 / 已踩坑

1. **删除/编辑单位返回 `updated:0`** → CloudBase 安全规则用了默认的 `auth.openid == doc._openid`，改为 `auth != null`。详见 `CLOUDBASE_SETUP.md`

2. **地图散点与地图分离** → `geoRoam` 期间调用 setOption 导致投影参数不一致。解法：roam 期间 `isRoaming=true`，600ms 超时后恢复更新

3. **页面不显示地图** → 可能 `china.json` 加载失败。检查 public 目录。3D 模式需 WebGL 支持，失败自动回退 2D

4. **watch 不工作、数据不同步** → watch() onError 自动降级 3 秒轮询。检查 CloudBase 安全规则和网络。控制台有 `[store]` 前缀日志

5. **新月份不自动切换** → 刷新页面。`init()` 中用 `new Date()` 计算 `realCurrentPeriod`。历史周期只读

6. **tailwind.config.js 改了不生效** → 重启 `npm run dev`（Tailwind JIT 不会热更新配置）

7. **管理员默认密码** → `admin123`，修改后在 config 集合存哈希（当前实际是明文 `localConfig.adminPwd`）

---

## 当前状态

### ✅ 已完成
- 中国地图看板（2D 默认 + 3D 切换按钮）
- 省份下钻 + 城市级显示
- CloudBase 实时同步（watch 长连接 + 降级轮询）
- 单位 CRUD + 地图坐标拾取
- 月度周期切换 + 历史归档只读
- 管理页面（密码门 + 单位维护 + 系统管理 + 日志 + 导出 CSV）
- 日夜模式切换
- 青啤主题配色
- canvas-confetti 里程碑（50%/75%/100%）
- Three.js 粒子背景
- 移动端适配（2D 降级 + 地图/列表切换）
- 实时时钟 + 倒计时

### 🔜 待做
- [ ] 接企业微信/飞书 OAuth 替代匿名登录
- [ ] 云函数：定时提醒、数据归档
- [ ] 微信模板消息通知
- [ ] 自定义域名
- [ ] 单元测试
- [ ] 性能优化（code-split echarts-gl/three）

---

## 常用命令

```bash
npm run dev              # 启动开发服务器 (localhost:5173)
npx vite build           # 生产构建 → dist/
npx tcb hosting deploy dist -e ysy-server-d7gwidmgv14f8da68  # 部署到 CloudBase
git push                 # 推送代码（dist/ 已纳入 git）
```

---

## 设计哲学

- **不引入 Vue Router/Vuex**：单页面应用，store.view 手动切换 + reactive 全局状态够用
- **不引入 UI 框架**：自建 Tailwind 组件保持"高级感"，不用 Element/Ant Design
- **乐观 UI + 防重复**：toggle 操作立即反映 UI，watch 回推跳过自己发起的变更
- **软删除 + 代际**：避免 CloudBase 最终一致性带来的数据不一致
- **CSS 变量 + 覆写 Tailwind**：双主题不靠 Tailwind dark: 前缀，而是 `[data-theme]` 选择器全局覆盖
