# 业务线账号与数据权限隔离 设计文档

日期：2026-08-17
状态：已确认（用户逐段审批通过）

## 背景与目标

系统目前只有一个 `admin@mediakit.local`（ADMIN）账号，所有业务数据挂在 admin 名下。
业务线（BusinessLine，6 条：FT/SM/CX/DG/KN/DM）已作为独立字典表存在，但与用户无关联。

目标：**每个业务线一个用户账号**，实现业务线级数据可见性隔离：

- 业务线账号只看到本业务线的数据（Campaign、数据管理记录、项目/报告）
- ADMIN 账号不受限，看全部
- 模板/方案等全局共享资产不做隔离

## 已确认的决策

| 决策点 | 结论 |
|---|---|
| 权限边界 | 数据可见性隔离（不做功能/页面隔离） |
| 隔离机制 | 沿用现有 `ownerId` 机制（业务数据划归到各业务线账号名下） |
| 存量数据 | 按业务线字段自动划归（一次性迁移） |
| 账号管理 | seed 脚本自动生成，不建管理 UI |
| Creator 数据 | 留 admin + 业务线账号共享读（方案 A） |
| 前端业务线下拉 | 业务线账号锁定为本业务线，ADMIN 不受限 |

## 1. 数据模型与账号

### User 模型

```prisma
model User {
  // ...现有字段不变
  businessLineCode String?  // ADMIN 为 NULL = 不限；USER 填 code（如 'DG'）
}
```

- 存 **code 而非 cuid FK**：与 `Campaign.businessLineCode`、`ReportScheme.businessLineCode`、
  `Project.meta.businessLine` 的既有约定一致，JWT/查询/划归免查表。
- 加索引；`Role` 枚举不变（ADMIN/USER）。

### 账号生成（seed）

新建 `prisma/seed-users.ts` 并入 `db:seed` 主链：

- 遍历库中 `BusinessLine`，按 email upsert：`{code小写}@mediakit.local`
  （如 `dg@mediakit.local`），role `USER`，`businessLineCode: bl.code`，name 取业务线名
- 统一初始密码 `mediakit123`（scrypt 哈希，复用 `utils/hash.ts`）
- 业务线被删时仅告警不删账号——User 删除会级联删除其名下 Campaign/Project 等数据，自动清理有毁数据风险；幂等可重跑

### JWT 与鉴权链路

- JWT access payload 增加 `bl: string | null`（`token.ts` 签发/验签同步）
- `req.user` → `{ id, role, businessLineCode }`（`types/express.d.ts` 的 `AuthPayload` 同步）
- `toPublicUser`（server）与 shared `User` type（`packages/shared/src/types/auth.ts`）加
  `businessLineCode`，登录响应与 `/auth/me` 自然带出，前端 auth store 无需额外改动

## 2. 存量数据划归（一次性迁移）

### 执行顺序

**先跑 seed-users（建账号）→ 再 `migrate deploy`（划归 SQL）**，UPDATE JOIN 依赖账号存在。
dev 库用户无 CREATE DATABASE 权限，沿用惯例：**手写 migration SQL + `migrate deploy`**（不用
`migrate dev`，避免 P3014）。

### Migration SQL

1. `ALTER TABLE User ADD COLUMN businessLineCode VARCHAR(191) NULL` + 索引
2. 划归（幂等，可重跑）：

```sql
-- Campaign：按 businessLineCode
UPDATE Campaign c
JOIN User u ON u.businessLineCode = c.businessLineCode AND u.role = 'USER'
SET c.ownerId = u.id;

-- DataRecord(CAMPAIGN)：data->>'$.businessLine'
UPDATE DataRecord d
JOIN User u ON u.businessLineCode = JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.businessLine'))
SET d.ownerId = u.id
WHERE d.kind = 'CAMPAIGN';

-- Project：meta->>'$.businessLine'（业务线为 NULL 的留 admin）
UPDATE Project p
JOIN User u ON u.businessLineCode = JSON_UNQUOTE(JSON_EXTRACT(p.meta, '$.businessLine'))
SET p.ownerId = u.id;
```

- **不划归**：DataRecord(CREATOR)（12 条，跨业务线共享）、ReportScheme（businessLineCode 为
  NULL）、Template——均留 admin
- 两个现存测试账号 `db@x.com` / `cascade@x.com`（USER，businessLineCode NULL）不动；
  它们将看不到任何业务数据（ownerId 无匹配），符合预期

### 划归结果（按 2026-08-17 数据推演）

| 账号 | Campaign | Project | Creator | ReportScheme |
|---|---|---|---|---|
| ft@ | 1 | 8 | 0（共享读） | 0 |
| sm@ | 1 | 0 | 0 | 0 |
| cx@ | 1 | 1 | 0 | 0 |
| dg@ | 1 | 8 | 0 | 0 |
| kn@ | 1 | 0 | 0 | 0 |
| dm@ | 1 | 9 | 0 | 0 |
| admin | 0 | 1（NULL 业务线） | 12 | 1 |

### 报告生成不受影响

ai-generate / recipe 服务内部按 campaignId 取数不走 controller 鉴权层，划归后照常工作。
报告列表读 Project（已按 ownerId 隔离）。

## 3. 服务端查询隔离

原则：**ADMIN 不受限；USER 强制 ownerId 过滤**（ownerId 已指向业务线账号）。

| 模块 | 改动 |
|---|---|
| campaigns | 无（已 ownerId 隔离）；**新增**：create/update 校验 `body.businessLineCode === viewer.businessLineCode`，不符 403（ADMIN 除外） |
| projects | 无（已隔离） |
| data（数据管理） | `list(kind)` → `list(kind, viewer)`：非 ADMIN 且 kind ≠ CREATOR 时加 `ownerId` 过滤；`get` 补 owner 校验（CREATOR 除外） |
| lookup | GET 端点**加 authenticate**（消除匿名面）；返回内容不变（字典全局可见） |
| templates / schemes / html-templates | 读取维持全局（共享资产，写入本就 ADMIN-only） |
| users 管理 | 无（ADMIN-only 不变；schema 顺手支持 businessLineCode 字段，不建 UI） |

### data.service.list 签名

```ts
list(kind: DataRecordKind, viewer: { id: string; role: Role }) {
  const where: Prisma.DataRecordWhereInput = { kind };
  if (kind === 'CREATOR') {
    // 共享字典：所有登录用户可读
  } else if (viewer.role !== 'ADMIN') {
    where.ownerId = viewer.id;
  }
  return prisma.dataRecord.findMany({ where, ... });
}
```

注：COLLABORATION 类 DataRecord 与 CAMPAIGN 同规则（非 ADMIN 按 ownerId 过滤），
reportPeriod/CpsDaily 派生数据不单独隔离——它们经 campaign 关联读取，随 campaign 隔离。

## 4. 前端

1. **身份透出**：shared User type + auth store 加 `businessLineCode`；Layout 顶栏业务线账号
   显示 code 徽章（如 `[DG]`），与现有 ADMIN 徽章并列
2. **CreateProjectDialog**：`user.businessLineCode` 非空时业务线下拉 disabled + 默认选中
   本业务线；ADMIN 不变
3. **数据管理页**：后端隔离即可，前端无改动；Creator 编辑/删除不做按钮隐藏（server 端
   owner 校验兜底，403 提示已够）
4. **路由守卫**：无改动（ADMIN 页面写入本就 requireRole，导航按钮已按角色隐藏）

## 5. 测试策略

**server（vitest）**
- data.service：USER 只见自己 ownerId 的 CAMPAIGN、CREATOR 全量、ADMIN 全量
- token/auth：bl claim 签发与验签；旧 token（无 bl）验签不炸
- campaigns create：跨业务线 403
- 划归 SQL：测试库从零重放（沿用既有机制）

**web（jsdom + RTL）**
- CreateProjectDialog：业务线账号下拉锁定
- auth store：/me 返回 businessLineCode 入 store

**手动验证**
- seed 后 `dg@mediakit.local` 登录 → 只见 DG 数据；admin 登录 → 全部

## 6. 错误处理

- **旧 token 无 bl claim**：验签时视为 NULL；受影响的只有 admin（本来就全量），安全。
  access token 15 分钟自然过期，无需强制重登
- **businessLineCode 脏数据（不在 BusinessLine 表）**：登录正常，匹配不上只是看不到数据，
  不崩溃
- **跨业务线创建**：403 + 中文错误信息

## 非目标（本期不做）

- 用户管理 UI（创建/改密/删账号走 seed 或 SQL）
- 同一业务线多账号共享数据（当前 ownerId 语义下互不可见）
- Creator 的业务线归属/拆分
- 功能级权限（页面/按钮隐藏按角色细化）
- 首登强制改密（系统无改密功能）
