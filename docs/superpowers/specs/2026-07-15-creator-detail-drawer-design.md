# 达人管理:头像 + 右侧详情浮窗

- **日期**:2026-07-15
- **状态**:已通过设计评审,待写实现计划
- **范围**:纯前端改动(达人库 Tab 列表 + 新右侧滑出浮窗);无服务端/DB/类型改动

## 1. 背景

数据管理 → 达人库(Creator)Tab 当前列表用通用 `DataTable` 渲染,列为 `Creator/Handle/Platform/Tier/Followers/Engagement/Category/Region + 编辑/删除`(`DataManagement.tsx:77-95`):

- **不显头像**:`Creator.avatar`(种子数据已有 picsum URL)与 `Creator.metrics`(4 项频道 KPI)完全没用到。
- **行不可点击**:无详情入口;只能「编辑/删除」。

用户要求:**列表显示头像 + 更详细的达人信息,新增达人详情浮窗——从列表点击行后,从浏览器右侧滑出**。

## 2. 关键决策(评审已定)

| 决策点 | 结论 | 理由 |
|---|---|---|
| 头像来源 | 直接用 `Creator.avatar`(种子已有 picsum);无 URL 首字母兜底 | 数据已在,无需新请求;手动新增可能缺 avatar→兜底 |
| 列表「更详细」 | 头像进 col0 + 详情走浮窗(非加列) | 列表保持精简;浮窗承载完整详情 |
| 行可点击方式 | 增强 `DataTable` 加可选 `onRowClick`(非另写 CreatorList) | DataTable 已通用;Campaign 维度已有自定义 CampaignList,creator 不必再写一套;新代码最少 |
| 浮窗形态 | 右侧滑出 drawer(本仓库**首个** drawer 模式) | 用户明确要「右侧浮出」;现有 overlay 全是居中 modal |
| 浮窗内容 | Creator 记录字段 + 4 频道 KPI(Avg Reach/Impressions/Follower Growth/CPM) | 全是记录自带数据,零额外请求;用户选定(不要按 campaign 维度的受众/作品/CPS) |
| 浮窗只读 | 不在浮窗内编辑;编辑仍走行内「编辑」→ RecordFormModal | 已有编辑入口,浮窗专注展示 |
| 动画 | 面板 `-translate-x-full → translate-x-full` + `transition-transform duration-200`(`requestAnimationFrame` 触发) | 克制滑入;本仓库首个动画 |

## 3. 不在本次范围(明确划界)

- ❌ **浮窗内的受众画像(性别/年龄/城市)/ 作品效果 / CPS**——按 campaign 维度的数据(`creatorPerformance`),需选 campaign 拉取/汇总;用户已选只要记录 + KPI。
- ❌ **从 Campaign 下钻的合作达人子表点开此浮窗**——v1 只接达人库列表行。
- ❌ **浮窗内编辑**——编辑走行内「编辑」。
- ❌ **服务端 / DB / shared 类型改动**——纯前端;`Creator` 类型已含 avatar + metrics。
- ❌ **列表加更多列**——「更详细」由浮窗承载,列表只加头像。

## 4. `CreatorAvatar` 组件(新)

`apps/web/src/components/CreatorAvatar.tsx`,抽自现有 `CreatorComponents.tsx:1054-1061` 的 `ListAvatar` 模式:

```tsx
interface Props { name: string; avatar?: string; size: number; }
export function CreatorAvatar({ name, avatar, size }: Props) {
  if (avatar) {
    return <img src={avatar} alt={name} draggable={false} style={{ width: size, height: size }} className="flex-none rounded-full object-cover" />;
  }
  return (
    <div className="flex flex-none items-center justify-center rounded-full bg-primary/10 text-primary" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name?.slice(0, 1) || '?'}
    </div>
  );
}
```

列表(size 28)与浮窗头部(size 64)共用。

## 5. `DataTable` 增强

`apps/web/src/components/DataTable.tsx` 加可选行点击:

- props 增 `onRowClick?: (rowIndex: number) => void`。
- `<tr>` 仅当 `onRowClick` 存在时挂 `onClick={() => onRowClick(ri)}`;光标 `cursor-pointer` + 既有 `hover:bg-surface-hover/50`。
- **不改其它**(loading/空态/首列强调不变)。头像作为普通 cell node 传入,无需为此改 DataTable。

> 行内「编辑/删除」按钮需 `e.stopPropagation()`,避免点按钮误触发行点击 → 开浮窗。

## 6. 达人库列表改动

`DataManagement.tsx` creator 分支:

- col0 由 `d.name` 改为 `<div className="flex items-center gap-2"><CreatorAvatar name={d.name} avatar={d.avatar} size={28} /><span>{d.name}</span></div>`。
- `<DataTable>` 传 `onRowClick={(i) => setDetailCreator(records[i].data as Creator)}`。
- `actions` 内按钮加 `onClick` 的 `e.stopPropagation()`(或在容器 `onClick={e=>e.stopPropagation()}`)。
- 其余列不变。

## 7. `CreatorDetailDrawer` 组件(新,右侧滑出)

`apps/web/src/editor/components/CreatorDetailDrawer.tsx`:

```tsx
interface Props { creator: Creator; onClose: () => void; }
```

- **scrim**:`fixed inset-0 z-50 bg-black/40`,`onClick={onClose}`。
- **面板**:`fixed inset-y-0 right-0 h-full w-[440px] max-w-[90vw] overflow-auto bg-surface-primary shadow-xl`,`onClick={e=>e.stopPropagation()}`。
- **滑入动画**:`useState(false)` + `useEffect(()=>{ const r=requestAnimationFrame(()=>setOpen(true)); return ()=>cancelAnimationFrame(r); },[])`;面板 className 含 `transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`。
- **Esc 关闭**:`useEffect` 挂 `keydown` 监听,Esc → `onClose`。
- **内容**(全取自 `creator`):
  - 头部:大头像(`<CreatorAvatar size={64}>`)+ `name`(font-headings 加粗)+ `@handle` + 右上 `✕`。
  - 基本信息网格(label + value):Platform / Tier / Followers / Engagement / Category / Region。
  - 频道 KPI:遍历 `creator.metrics`(4 项),小卡片网格(label + value);`metrics` 为空时隐藏该区。

## 8. 交互

- DataPanel(kind=creator)加 `const [detailCreator, setDetailCreator] = useState<Creator | null>(null);`。
- 渲染 `{detailCreator && <CreatorDetailDrawer creator={detailCreator} onClose={() => setDetailCreator(null)} />}`。
- 点行 → `setDetailCreator(record.data as Creator)` → 浮窗滑出。
- 关闭:scrim / ✕ / Esc → `setDetailCreator(null)`。
- campaign kind 不受影响(仍用 CampaignList 展开,不接 drawer)。

## 9. 测试策略(TDD,vitest + jsdom,断言 shell 文本)

遵循 [[web-chart-test-convention]]。

- **`CreatorAvatar.test.tsx`**:有 `avatar` → `<img src=...>`;无 `avatar` → 渲染首字母。
- **`DataTable.test.tsx`**(新增或就近补):传 `onRowClick` → 点 `<tr>` 触发回调(带 rowIndex);不传 → 无 `cursor-pointer`/不触发。
- **`CreatorDetailDrawer.test.tsx`**:渲染全部字段(name/handle/platform/tier/...)+ KPI;scrim 点击 → `onClose`;✕ → `onClose`;Esc → `onClose`。
- **`DataManagement.test.tsx`**(补):达人库 Tab 点某行 → `CreatorDetailDrawer` 以该达人 name 出现;关闭后消失。

## 10. 涉及文件

**新增**:
- `apps/web/src/components/CreatorAvatar.tsx`(+ test)
- `apps/web/src/editor/components/CreatorDetailDrawer.tsx`(+ test)

**修改**:
- `apps/web/src/components/DataTable.tsx`(+ 可选 `onRowClick`;+ test)
- `apps/web/src/routes/DataManagement.tsx`(creator col0 头像 + `onRowClick` + `detailCreator` state + 浮窗渲染 + action 按钮 stopPropagation)

## 11. 兼容性

- `Creator` 类型、服务端、DB、shared 均**不动**——纯前端展示层。
- campaign kind 行为不变(仍 CampaignList 展开)。
- `DataTable` 的 `onRowClick` 为可选,现有调用方(若有)不受影响。
- 手动新增的达人无 avatar → 列表与浮窗均首字母兜底,不报错。
- `metrics` 为空(手动新增/导入缺)→ 浮窗 KPI 区降级隐藏,不报错。
