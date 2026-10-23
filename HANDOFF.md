# 交接文档 · closing-dashboard

> **交接日期：2026-10-22** · 给接手本项目的下一位开发者 / AI 智能体。
> 本文聚焦「部署推送 + 版本管理 + 数据运维 + 当前状态」。项目本身的全貌请读 `CLAUDE.md`（必读）→ `ARCHITECTURE.md` → `TECHNICAL_ROADMAP.md` → `CLOUDBASE_SETUP.md`。

---

## 1. 项目一句话

青岛啤酒财务共享中心 · 结账进度看板：每月末全国 40+ 业务单位完成财务结账后网页勾选 → 中国地图对应位置点亮（仪式感 + 老板看进度）。Vue 3 + Vite + Tailwind + ECharts，后端腾讯云 CloudBase（数据库 + 实时推送 + 静态托管）。

| 项 | 值 |
|----|-----|
| 线上地址 | https://ysy-server-d7gwidmgv14f8da68-1377434139.tcloudbaseapp.com |
| 代码仓库 | https://github.com/beileita/closing-dashboard.git（唯一分支 `main`） |
| CloudBase env | `ysy-server-d7gwidmgv14f8da68`（上海 ap-shanghai，匿名登录） |
| 集合 | `units` `progress` `config` `logs` |
| 安全规则 | 全部 `{"read":"auth!=null","write":"auth!=null"}`（见 CLOUDBASE_SETUP.md） |

## 2. 接手第一件事

```bash
# 方式 A：从 GitHub 克隆
git clone https://github.com/beileita/closing-dashboard.git
cd closing-dashboard

# 方式 B：从本交接包离线恢复（含全部提交历史）
git clone closing-dashboard.bundle closing-dashboard

npm install
npm run dev        # → http://localhost:5173
```

- 项目是 ESM（`package.json` 的 `"type":"module"`），临时脚本要写 `.cjs`
- 改代码前先读完 `CLAUDE.md`（自称"读完即可完全掌握项目"，是真的）
- 无路由/Vuex/Pinia：`store.view` 手动切视图，状态全在 `src/data/store.js` 一个 reactive 对象

## 3. 版本管理（git）

- **仓库**：`https://github.com/beileita/closing-dashboard.git`，唯一分支 `main`，截至 2026-10-23 本地与 origin 同步；最近功能提交 `ef7354e`（排行榜 v1）
- **`dist/` 有意纳入 git**（部署方便，构建产物随代码走）
- `.gitignore`：`node_modules` `.DS_Store` `*.local` `.vite`
- **提交规范**（看历史即可）：中文 message，conventional 前缀 `feat:` / `fix:` / `docs:` / `baseline:`
- 未跟踪的 `.claude/`、`.codex/` 是本地 AI 工具目录，**不要提交**

## 4. 部署（推送上线）

### 前置

1. tcb CLI 已全局安装（本机路径）：
   ```
   C:\Users\Administrator\AppData\Roaming\npm\node_modules\@cloudbase\cli\bin\tcb
   ```
   （也可用 `npx tcb`，但会临时下载）
2. **登录授权**：首次使用会打开浏览器授权页（设备码流程），完成后凭据缓存在本机用户目录。换机器/换系统用户需重新 `tcb login`
3. deploy.sh 是 bash 脚本，Windows 下用 **Git Bash** 跑

### 发布流程

```bash
# 推荐：一键构建 + 部署（自动从 cloudbaserc.json / .env 读 envId）
bash deploy.sh            # 加 --dry-run 可预览，-e <envId> 可覆盖

# 或手动：
npm run build
npx tcb hosting deploy dist -e ysy-server-d7gwidmgv14f8da68
```

- envId 读取优先级：`-e` 参数 > `cloudbaserc.json` > `.env`
- 部署只上传静态文件到 CDN，**不碰数据库**；数据库变更需单独执行（见 §5）
- 部署后验证：打开线上地址 → 单位列表数字应为 42 → 等 10 秒 watch 推送后仍为 42

## 5. 数据库访问（运维 / 排查）

⚠️ **`config` 集合存有管理员密码（明文 `localConfig.adminPwd`），不要整集合拉取**，只按需查单个 key。

### 查库命令（已实测可用，2026-10-22）

CLI 3.6.2 起 `--command` 必须是 **MgoCommands JSON 数组**（旧版 MongoDB 字符串语法已失效）。**用 Git Bash 执行**——PowerShell 原生参数传递会弄坏内嵌引号的 JSON。

```bash
TCB="C:/Users/Administrator/AppData/Roaming/npm/node_modules/@cloudbase/cli/bin/tcb"
ENV=ysy-server-d7gwidmgv14f8da68

# 计数：有效单位（42 预期）
node "$TCB" db nosql execute --json --command \
'[{"TableName":"units","CommandType":"COMMAND","Command":"{\"count\":\"units\",\"query\":{\"deleted\":{\"$ne\":true}}}"}]' \
-e $ENV

# 聚合：某周期按 gen 统计 total/done（排查进度）
node "$TCB" db nosql execute --json --command \
'[{"TableName":"progress","CommandType":"COMMAND","Command":"{\"aggregate\":\"progress\",\"pipeline\":[{\"$match\":{\"period\":\"2026-10\"}},{\"$group\":{\"_id\":\"$gen\",\"total\":{\"$sum\":1},\"done\":{\"$sum\":{\"$cond\":[{\"$eq\":[\"$done\",true]},1,0]}}}}],\"cursor\":{}}"}]' \
-e $ENV

# 最近操作日志
node "$TCB" db nosql execute --json --command \
'[{"TableName":"logs","CommandType":"QUERY","Command":"{\"find\":\"logs\",\"sort\":{\"ts\":-1},\"limit\":6}"}]' \
-e $ENV
```

QUERY / INSERT / UPDATE / DELETE 模板见 `tcb db nosql execute --help`。

### 数据模型速记

| 集合 | 关键字段 | 说明 |
|------|---------|------|
| `units` | `name` `coords` `deleted` `createdAt` | 软删除 `deleted:true`；总数 76 = 42 有效 + 34 已删 |
| `progress` | `period "YYYY-MM"` `gen` `unitId` `done` `doneAt` `operator` `device` | 每单位每周期一条，惰性创建（首次 toggle 时落库） |
| `config` | `key:"resetGen"` / `currentPeriod` / `adminPwd` 等 | 代际 + 周期 + 管理员密码 |
| `logs` | `action` `ts` `device` `period` `unitId` | 操作审计 |

- **周期自动滚动**：`init()` 按 `new Date()` 计算 `realCurrentPeriod`，刷新页面即切换；`gen`（代际）只在「打开下一会计期」时递增，旧 gen 文档自动不可见
- 单位列表数量 = `store.units.length`（getUnits 初始化 → watch 快照替换），无其他计数来源

## 6. 关键坑位（本项目的血泪史）

1. **软删除过滤必须 `.where({deleted: d.command.neq(true)})`**，不能用 `{deleted:false}` —— 2026-07-15/16 批量创建的 6 个历史单位文档缺 `deleted` 字段（软删除 7/23 才引入）。语义不一致曾导致 42→36 计数 bug（`d9cf087` 修复，2026-08-12）
2. **CloudBase 实时 watch 单查询上限 100 条**（超限报 `EC_ERR_PARAM_INVALID`）。progress watch 按 `{period, gen}` 过滤，安全；units watch 已服务端过滤 `neq(true)`，但已删文档仍在库里累积（现 34），总数逼近 100 前要加归档策略（`40e1602` 有 hitCap 兜底）
3. **删除/编辑单位返回 `updated:0`** → 安全规则是默认的 `auth.openid == doc._openid`，改为 `auth != null`（详见 CLOUDBASE_SETUP.md）
4. **地图散点分离** → `geoRoam` 期间调 setOption 导致投影参数不一致；roam 期间 `isRoaming=true`，600ms 无操作后恢复
5. **tailwind.config.js 改动不生效** → 重启 `npm run dev`（JIT 不热更配置）
6. watch 异常时自动降级 3 秒轮询；控制台有 `[store]` / `[watch:*]` 前缀日志可排查

## 7. 当前状态快照（2026-10-23 核查）

- **代码**：main 与 origin 同步，最近功能提交 `ef7354e`（排行榜 v1），工作区干净（仅未跟踪 `.claude/` `.codex/`）
- **线上**：已部署排行榜 v1 + 2026-10-23 首屏性能优化，units 42 有效 + 34 已删（与 8 月修复后一致）
- **排行榜**：单位完成时间榜，顶栏/手机标题栏入口；≥1280 停靠 380px，768–1279 浮层，<768 全屏
- **性能**：首屏阻塞 gzip 约 243KB（vue 31.5 + cloudbase 189.8 + 业务 16.2 + css 5.8）；echarts 169KB 异步、three 173.6KB 空闲加载
- **2026-10 周期**：42/42 全部完成 ✅（11:36 用户批量重新勾选，完成时间均为当天）
- **2026-09 周期**：仅 1 条进度记录 —— 9 月看板几乎没被使用（原因未确认）
- **最近操作**：10/21 17:10、10/12 15:53（北京时间）各有 check/uncheck 成对操作，最终均已勾选，属正常使用
- **待办**（TECHNICAL_ROADMAP.md 有更多）：企微/飞书 OAuth、云函数定时提醒、微信模板消息、自定义域名、单元测试、CloudBase SDK 拆分

## 8. 交接包内容

| 文件 | 说明 |
|------|------|
| `HANDOFF.md` | 本文件（已随仓库提交） |
| `closing-dashboard.bundle` | git bundle 全历史：`git clone closing-dashboard.bundle` 即可恢复完整仓库 |
| `closing-dashboard-src.zip` | 源码快照（不含 node_modules / .git / .claude / .codex） |

> 三选一恢复项目即可：GitHub 克隆 / bundle / zip。改完后按 §3 提交、§4 部署。
