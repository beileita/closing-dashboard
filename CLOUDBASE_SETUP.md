# CloudBase 安全规则配置指南

## 问题诊断

删除/编辑单位返回 `{"updated":0}` 的根因是 **CloudBase 数据库安全规则限制了匿名用户的写操作**。

### 原理

CloudBase 匿名登录为每个浏览器/设备生成唯一的 `_openid`。默认安全规则通常是：

```json
{ "read": "auth.openid == doc._openid", "write": "auth.openid == doc._openid" }
```

这意味着：**只有创建文档的设备才能修改/删除它**。

设备 A 创建了单位 → 设备 B 尝试删除 → `_openid` 不匹配 → 写入被**静默拒绝** → 返回 `updated: 0`。

## 修复步骤

### 1. 登录 CloudBase 控制台

打开 https://console.cloud.tencent.com/tcb

选择环境：`ysy-server-d7gwidmgv14f8da68`

### 2. 为每个集合设置安全规则

进入：**数据库** → 点击集合名称 → **权限设置** → 切换到 **安全规则** 标签

对以下 **4 个集合** 分别设置：

```json
{
  "read": "auth != null",
  "write": "auth != null"
}
```

| 集合 | 作用 |
|------|------|
| `units` | 单位 CRUD |
| `progress` | 完成状态标记 |
| `config` | 代际/resetGen/deadline/password |
| `logs` | 操作日志 |

### 3. 验证

设置完成后，在不同浏览器/设备上测试：
1. 新增/编辑/删除单位 → 应成功
2. 标记完成 → 应实时同步到其他设备
3. 刷新页面 → 数据不丢失

## 安全说明

当前规则允许任何匿名登录用户操作所有数据。对于内部财务看板是可接受的。如需更高安全性，可关闭匿名登录改用微信/手机号登录。
