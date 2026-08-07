# CPS 每日明细补 spend/newCustomers 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 `CpsPerformance.daily` JSON 增加 `spend` + `newCustomers` 两个每日字段,并打通 `/import/cps-daily` 导入与导入 UI,为后续报告层按时间段重算备好数据。

**Architecture:** 纯增量、向后兼容。服务端只动 `importCpsDaily` 的每日记录组装(照搬现有 `dailyGmv`/`dailyCommission` 模式加两键);前端只动 `dataImport.ts` 两个字段定义数组(`CPS_DAILY_FIELDS` 控制解析、`PREVIEW_COLUMNS.cpsDaily` 控制预览,预览组件数据驱动无需改)。无 Prisma 迁移。新增 campaigns 模块首个单测。

**Tech Stack:** Node + Express + Prisma(Json 字段)、Vitest(prisma mock)、React + Vite(导入 UI)。

**Spec:** `docs/superpowers/specs/2026-08-07-cps-daily-spend-newcustomers-design.md`

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `apps/server/src/modules/campaigns/campaigns.service.ts` | `importCpsDaily` 把每日行组装成 daily 记录 | 改(line 525 方法内,约 555 行处的对象字面量加两键) |
| `apps/server/src/modules/campaigns/campaigns.service.test.ts` | importCpsDaily 单测(campaigns 模块首个测试) | 新建 |
| `apps/web/src/editor/dataImport.ts` | 导入字段定义(解析 + 预览列) | 改(`CPS_DAILY_FIELDS` line 85、`PREVIEW_COLUMNS.cpsDaily` line 133) |

---

## Task 1: 服务端 — `importCpsDaily` 收 `dailySpend`/`dailyNewCustomers`(TDD)

**Files:**
- Test: `apps/server/src/modules/campaigns/campaigns.service.test.ts`(新建)
- Modify: `apps/server/src/modules/campaigns/campaigns.service.ts`(`importCpsDaily`,line 525 起;改 ~555 行处的 `existingDaily.set(date, { ... })` 对象字面量)

- [ ] **Step 1: 写失败测试**

新建 `apps/server/src/modules/campaigns/campaigns.service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// campaigns.service 顶层 import prisma,这里 mock 掉避免碰 DB。
const prismaMock = vi.hoisted(() => ({
  campaignCreator: { findFirst: vi.fn() },
  cpsPerformance: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
}));

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { importService } from './campaigns.service';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.campaignCreator.findFirst.mockResolvedValue({ id: 'link_1' });
  prismaMock.cpsPerformance.findUnique.mockResolvedValue(null); // 默认走 create 路径
  prismaMock.cpsPerformance.create.mockResolvedValue({});
  prismaMock.cpsPerformance.update.mockResolvedValue({});
});

describe('importService.importCpsDaily — spend + newCustomers 每日字段', () => {
  it('dailySpend/dailyNewCustomers 落进 daily 记录(新建路径),spend 剥离 $', async () => {
    await importService.importCpsDaily('u', [
      {
        campaignId: 'c1', creatorId: 'cr1', contentType: 'post', date: '2026-08-01',
        dailyClicks: 10, dailyOrders: 2, dailyGmv: '$100',
        dailySpend: '$30', dailyNewCustomers: 5,
      },
    ]);

    expect(prismaMock.cpsPerformance.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.cpsPerformance.create.mock.calls[0][0].data;
    expect(data.campaignCreatorId).toBe('link_1');
    const daily = data.daily as Array<Record<string, unknown>>;
    expect(daily).toHaveLength(1);
    expect(daily[0].spend).toBe('30');          // $ 前缀剥离(同 dailyGmv)
    expect(daily[0].newCustomers).toBe('5');
    expect(daily[0].gmv).toBe('100');
  });

  it('不带 spend/newCustomers 的行不留空键(向后兼容)', async () => {
    await importService.importCpsDaily('u', [
      { campaignId: 'c1', creatorId: 'cr1', contentType: 'post', date: '2026-08-02', dailyClicks: 7 },
    ]);

    const daily = prismaMock.cpsPerformance.create.mock.calls[0][0].data.daily as Array<Record<string, unknown>>;
    expect(daily[0].clicks).toBe('7');
    expect(daily[0]).not.toHaveProperty('spend');
    expect(daily[0]).not.toHaveProperty('newCustomers');
  });

  it('已有 CPS 时走 update 路径,新字段同样落库', async () => {
    prismaMock.cpsPerformance.findUnique.mockResolvedValue({ daily: [] }); // existingCps 真值 → update
    await importService.importCpsDaily('u', [
      {
        campaignId: 'c1', creatorId: 'cr1', contentType: 'post', date: '2026-08-01',
        dailySpend: '$30', dailyNewCustomers: 5,
      },
    ]);

    expect(prismaMock.cpsPerformance.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.cpsPerformance.create).not.toHaveBeenCalled();
    const daily = prismaMock.cpsPerformance.update.mock.calls[0][0].data.daily as Array<Record<string, unknown>>;
    expect(daily[0].spend).toBe('30');
    expect(daily[0].newCustomers).toBe('5');
  });
});
```

- [ ] **Step 2: 跑测试,确认失败**

Run(从 `apps/server`):
```bash
cd apps/server && pnpm exec vitest run src/modules/campaigns/campaigns.service.test.ts
```
Expected: **FAIL** —— `daily[0].spend` 为 `undefined`(当前 importCpsDaily 不收 dailySpend)。3 个用例全挂。

- [ ] **Step 3: 最小实现 —— 在 importCpsDaily 的 daily 记录字面量加两键**

在 `apps/server/src/modules/campaigns/campaigns.service.ts` 的 `importCpsDaily` 方法内,找到组装每日记录的对象字面量(约 line 553-560):

```ts
          existingDaily.set(date, {
            date,
            ...('dailyClicks' in row && row.dailyClicks ? { clicks: String(row.dailyClicks) } : {}),
            ...('dailyImpressions' in row && row.dailyImpressions ? { impressions: String(row.dailyImpressions) } : {}),
            ...('dailyOrders' in row && row.dailyOrders ? { orders: String(row.dailyOrders) } : {}),
            ...('dailyGmv' in row && row.dailyGmv ? { gmv: String(row.dailyGmv).replace(/^[$]/, '') } : {}),
            ...('dailyCommission' in row && row.dailyCommission ? { commission: String(row.dailyCommission).replace(/^[$]/, '') } : {}),
          });
```

改成(在 `dailyCommission` 那行之后加两行,模式完全一致;`spend` 同 gmv/commission 去 `$`,`newCustomers` 是计数只 `String()`):

```ts
          existingDaily.set(date, {
            date,
            ...('dailyClicks' in row && row.dailyClicks ? { clicks: String(row.dailyClicks) } : {}),
            ...('dailyImpressions' in row && row.dailyImpressions ? { impressions: String(row.dailyImpressions) } : {}),
            ...('dailyOrders' in row && row.dailyOrders ? { orders: String(row.dailyOrders) } : {}),
            ...('dailyGmv' in row && row.dailyGmv ? { gmv: String(row.dailyGmv).replace(/^[$]/, '') } : {}),
            ...('dailyCommission' in row && row.dailyCommission ? { commission: String(row.dailyCommission).replace(/^[$]/, '') } : {}),
            ...('dailySpend' in row && row.dailySpend ? { spend: String(row.dailySpend).replace(/^[$]/, '') } : {}),
            ...('dailyNewCustomers' in row && row.dailyNewCustomers ? { newCustomers: String(row.dailyNewCustomers) } : {}),
          });
```

- [ ] **Step 4: 跑测试,确认通过**

Run(从 `apps/server`):
```bash
cd apps/server && pnpm exec vitest run src/modules/campaigns/campaigns.service.test.ts
```
Expected: **PASS** —— 3 个用例全过。

- [ ] **Step 5: server tsc 类型检查(CI gate)**

Run(从 `apps/server`):
```bash
cd apps/server && pnpm exec tsc -b --force
```
Expected: exit 0,无输出。

- [ ] **Step 6: 提交(只 add 这两个文件)**

```bash
git add apps/server/src/modules/campaigns/campaigns.service.ts apps/server/src/modules/campaigns/campaigns.service.test.ts
git commit -m "feat(campaigns): importCpsDaily 收 dailySpend/dailyNewCustomers 每日字段

CpsPerformance.daily JSON 增加可选 spend/newCustomers(无 Prisma 迁移),
照搬 dailyGmv/dailyCommission 模式;spend 剥 \$。配 campaigns 模块首个单测。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 前端 —— `dataImport.ts` 字段定义加两列

**Files:**
- Modify: `apps/web/src/editor/dataImport.ts`(`CPS_DAILY_FIELDS` line 85、`PREVIEW_COLUMNS.cpsDaily` line 133)

> 说明:`CPS_DAILY_FIELDS` 决定解析时从行里提取哪些列(不加则 `dailySpend`/`dailyNewCustomers` 不会进入 item,Task 1 的服务端读不到);`PREVIEW_COLUMNS.cpsDaily` 决定导入预览表头列(`ImportPreviewModal` 数据驱动渲染,`const columns = PREVIEW_COLUMNS[kind]`)。两处都加,预览组件本身不动。

- [ ] **Step 1: 改 `CPS_DAILY_FIELDS`(line 85)**

把:
```ts
export const CPS_DAILY_FIELDS = [
  'campaignId', 'creatorId', 'collabId', 'contentType', 'date',
  'dailyClicks', 'dailyImpressions', 'dailyOrders',
  'dailyGmv', 'dailyCommission',
] as const;
```
改成(末尾加 `'dailySpend', 'dailyNewCustomers'`):
```ts
export const CPS_DAILY_FIELDS = [
  'campaignId', 'creatorId', 'collabId', 'contentType', 'date',
  'dailyClicks', 'dailyImpressions', 'dailyOrders',
  'dailyGmv', 'dailyCommission',
  'dailySpend', 'dailyNewCustomers',
] as const;
```

- [ ] **Step 2: 改 `PREVIEW_COLUMNS.cpsDaily`(line 133)**

把:
```ts
  cpsDaily: ['campaignId', 'creatorId', 'collabId', 'contentType', 'date', 'dailyClicks', 'dailyOrders', 'dailyGmv'],
```
改成(末尾加两列):
```ts
  cpsDaily: ['campaignId', 'creatorId', 'collabId', 'contentType', 'date', 'dailyClicks', 'dailyOrders', 'dailyGmv', 'dailySpend', 'dailyNewCustomers'],
```

- [ ] **Step 3: web tsc 类型检查(CI gate)**

Run(从 `apps/web`):
```bash
cd apps/web && pnpm exec tsc -b --force
```
Expected: exit 0,无输出。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/editor/dataImport.ts
git commit -m "feat(web): cps-daily 导入支持 spend/newCustomers 列

CPS_DAILY_FIELDS 加两字段(解析提取)+ PREVIEW_COLUMNS.cpsDaily 加两列(预览)。
ImportPreviewModal 数据驱动,无需单独改。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 收尾验证

- [ ] **Step 1: 全量 server 测试无新回归**

Run(从 `apps/server`):
```bash
cd apps/server && pnpm exec vitest run src/modules/campaigns/
```
Expected: 新测试 3/3 过;不引入新的 campaigns 模块失败。

- [ ] **Step 2: 双端 tsc**

```bash
cd apps/server && pnpm exec tsc -b --force && cd ../web && pnpm exec tsc -b --force
```
Expected: 均 exit 0。

> 注:仓库更广的测试套件存在与本次无关的预存失败(未合 WIP 引起),不属本计划范围。

---

## Self-Review

**1. Spec coverage:**
- 「`CpsDaily` 加 spend?/newCustomers?」→ Task 1 Step 3(写入)+ Task 1 测试(验证)。✓
- 「`importCpsDaily` 收 dailySpend/dailyNewCustomers,spend 去 $」→ Task 1 Step 3。✓
- 「不动路由/Zod(无 validate 中间件)」→ 计划确实未动路由/schema。✓
- 「UI:`CPS_DAILY_FIELDS` + `PREVIEW_COLUMNS.cpsDaily` 各加两列,组件不动」→ Task 2 Step 1-2。✓
- 「新建 campaigns.service.test.ts,覆盖 有/无字段 + $ 剥离 + update 路径」→ Task 1 Step 1 三个用例。✓
- 「不动汇总字段、不动其它导入种类、无 Prisma 迁移」→ 计划未触及。✓

**2. Placeholder scan:** 无 TBD/TODO;所有代码块完整;命令带 expected 输出。✓

**3. Type consistency:** `spend`/`newCustomers` 在 spec、Task 1 实现、Task 1 测试、Task 2 字段名(`dailySpend`/`dailyNewCustomers` 为导入列名,落库键为 `spend`/`newCustomers`)全程一致;`dailySpend`→`spend`、`dailyNewCustomers`→`newCustomers` 的映射在 Task 1 Step 3 与现有 `dailyGmv`→`gmv` 同模式。✓

无问题,无需返工。
