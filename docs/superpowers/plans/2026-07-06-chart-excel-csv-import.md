# 图表数据 Excel/CSV 直接导入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让柱状图/折线图/饼图的属性面板支持「导入 Excel/CSV → 映射列 → 数据直接灌入当前图表」，并移除旧的「数据源绑定」机制。

**Architecture:** 纯前端。文件解析（复用 `xlsx` 库）→ 列映射弹框 → `buildChartData` 纯函数生成 chart data → 写入 `comp.data`（已有 autosave 自动持久化，无后端改动）。删除 `datasources` store 状态、`resolveData`、`DatasourceMenu`、`BindingEditor`。

**Tech Stack:** React 18 + TypeScript + Zustand + recharts + xlsx + Vitest + @testing-library/react（jsdom）。

---

## 文件结构

| 文件 | 责任 | 操作 |
|---|---|---|
| `apps/web/src/editor/datasource/parse.ts` | CSV/Excel → `ParsedSheet[]`（多 sheet） | 改写 |
| `apps/web/src/editor/datasource/resolve.ts` | `buildChartData` 纯函数：映射 + 列 → chart data | 改写（删 `resolveData`） |
| `apps/web/src/editor/components/ImportDataModal.tsx` | 文件解析 + sheet 切换 + 列映射 + 预览 + 确认 | 新建 |
| `apps/web/src/editor/store.ts` | 移除 datasource 状态/动作；新增 `setComponentData` | 改 |
| `apps/web/src/editor/PropertyPanel.tsx` | 移除 `BindingEditor`；挂载 `ChartImportButton` + `ImportDataModal` | 改 |
| `apps/web/src/editor/ComponentPanel.tsx` | 移除 `DatasourceMenu` 挂载 | 改 |
| `apps/web/src/editor/components/ComponentRenderer.tsx` | 直接用 `comp.data`，不再 `resolveData` | 改 |
| `apps/web/src/editor/preview/PageView.tsx` | 更新注释（datasources 段已不适用） | 改 |
| `apps/web/src/editor/components/DatasourceMenu.tsx` | 删除 | 删 |
| `apps/web/tests/editor.m5.test.tsx` | 删除（测的是已删的 DatasourceMenu/BindingEditor） | 删 |
| `apps/web/tests/editor.resolve.test.ts` | 改写为 `buildChartData` 测试 | 改写 |
| `apps/web/tests/editor.datasource.test.ts` | 保留 CSV 测试；删 datasource store 测试；加 parseExcel/parseFile 测试 | 改 |
| `apps/web/tests/editor.import-modal.test.tsx` | `ImportDataModal` 组件测试 | 新建 |

**不动：** `apps/server/*`、`packages/shared/src/index.ts`（保留 `Datasource`/`ComponentBinding` 类型以兼容旧序列化数据）。

---

## Task 1: parse.ts 改写为多 sheet + ParsedSheet

**Files:**
- Modify: `apps/web/src/editor/datasource/parse.ts`（全文重写）
- Modify: `apps/web/tests/editor.datasource.test.ts`（删 datasource store 段，加 excel/parseFile 测试）

- [ ] **Step 1: 重写 parse.ts**

完整新内容：

```ts
import * as XLSX from 'xlsx';

/** 解析后的单个 sheet（无 id，仅供导入映射弹框临时使用）。 */
export interface ParsedSheet {
  name: string;
  columns: string[];
  rows: Record<string, string>[];
}

/** 把「数组行」（第一行表头）转成 ParsedSheet。 */
function fromMatrix(name: string, matrix: string[][]): ParsedSheet {
  if (matrix.length === 0) return { name, columns: [], rows: [] };
  const columns = matrix[0].map((h, i) => String(h ?? `列${i + 1}`));
  const rows = matrix.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    columns.forEach((c, i) => (obj[c] = String(r[i] ?? '')));
    return obj;
  });
  return { name, columns, rows };
}

/** 解析 CSV 文本（支持引号包裹的字段与逗号转义）。 */
export function parseCSV(text: string, name = 'CSV'): ParsedSheet {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cur.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = '';
    } else {
      field += ch;
    }
  }
  // 末尾字段
  if (field !== '' || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return fromMatrix(name, rows.map((r) => r.map((c) => c.trim())));
}

/** 解析 Excel ArrayBuffer，返回所有 sheet。 */
export function parseExcel(buffer: ArrayBuffer, name = 'Excel'): ParsedSheet[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  return wb.SheetNames.map((sheetName) => {
    const matrix = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], {
      header: 1,
      blankrows: false,
    });
    return fromMatrix(sheetName, matrix as unknown as string[][]);
  });
}

/** 根据文件名/类型选择解析器，返回所有 sheet（CSV 恒为单 sheet）。 */
export async function parseFile(file: File): Promise<ParsedSheet[]> {
  const lower = file.name.toLowerCase();
  const base = file.name.replace(/\.[^.]+$/, '');
  if (lower.endsWith('.csv') || file.type === 'text/csv') {
    return [parseCSV(await file.text(), base)];
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return parseExcel(await file.arrayBuffer(), base);
  }
  // 兜底按文本 CSV 解析。
  return [parseCSV(await file.text(), base)];
}
```

- [ ] **Step 2: 改写 editor.datasource.test.ts**

完整新内容（删 datasource store 段，CSV 段保留，新增 excel/parseFile）：

```ts
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseCSV, parseExcel, parseFile } from '@/editor/datasource/parse';

describe('CSV parser', () => {
  it('parses headers and rows', () => {
    const csv = '月份,GMV\n1月,120\n2月,180';
    const d = parseCSV(csv, '销售');
    expect(d.columns).toEqual(['月份', 'GMV']);
    expect(d.rows).toHaveLength(2);
    expect(d.rows[0]).toEqual({ 月份: '1月', GMV: '120' });
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    const csv = 'name,note\n"a,b","say ""hi"""';
    const d = parseCSV(csv);
    expect(d.rows[0]).toEqual({ name: 'a,b', note: 'say "hi"' });
  });

  it('handles CRLF line endings', () => {
    const csv = 'a,b\r\n1,2\r\n3,4\r\n';
    const d = parseCSV(csv);
    expect(d.rows).toHaveLength(2);
    expect(d.rows[1]).toEqual({ a: '3', b: '4' });
  });
});

describe('parseExcel', () => {
  it('returns all sheets with their own names', () => {
    const ws1 = XLSX.utils.aoa_to_sheet([['月份', 'GMV'], ['1月', 120]]);
    const ws2 = XLSX.utils.aoa_to_sheet([['a', 'b'], ['1', 2]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, '销售');
    XLSX.utils.book_append_sheet(wb, ws2, '其它');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;

    const sheets = parseExcel(buf, 'file.xlsx');
    expect(sheets).toHaveLength(2);
    expect(sheets[0].name).toBe('销售');
    expect(sheets[0].columns).toEqual(['月份', 'GMV']);
    expect(sheets[0].rows[0]).toEqual({ 月份: '1月', GMV: '120' });
    expect(sheets[1].name).toBe('其它');
  });
})

describe('parseFile', () => {
  it('csv returns a single sheet', async () => {
    const file = new File(['月份,GMV\n1月,120'], 'sales.csv', { type: 'text/csv' });
    const sheets = await parseFile(file);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].columns).toEqual(['月份', 'GMV']);
  });

  it('xlsx returns all sheets', async () => {
    const ws = XLSX.utils.aoa_to_sheet([['月份', 'GMV'], ['1月', 120]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '销售');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const file = new File([buf], 'sales.xlsx');
    const sheets = await parseFile(file);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe('销售');
  });
});
```

- [ ] **Step 3: 跑测试**

Run: `pnpm --filter @mediakit/web test`
Expected: PASS。parseCSV/parseExcel/parseFile 全绿。（此时 `resolveData` 测试 `editor.resolve.test.ts` 仍引用旧导出，会失败 —— 留到 Task 2 修。本步只需确认 parse 相关用例通过；若 `editor.resolve.test.ts` 报错属预期，下个 task 修。）

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/editor/datasource/parse.ts apps/web/tests/editor.datasource.test.ts
git commit -m "feat(web): parse 改为多 sheet ParsedSheet 模型"
```

---

## Task 2: resolve.ts 改写为 buildChartData + 更新 ComponentRenderer

**Files:**
- Modify: `apps/web/src/editor/datasource/resolve.ts`（全文重写）
- Modify: `apps/web/src/editor/components/ComponentRenderer.tsx`
- Modify: `apps/web/src/editor/preview/PageView.tsx`（注释）
- Modify: `apps/web/tests/editor.resolve.test.ts`（全文重写）

- [ ] **Step 1: 重写 resolve.ts**

完整新内容（删 `resolveData`，新增 `buildChartData` / `countNonNumeric`）：

```ts
import type { BarChartData, LineChartData, PieChartData } from '@mediakit/shared';
import { DEFAULT_CHART_PALETTE } from '@mediakit/shared';
import type { ParsedSheet } from './parse';

export type ChartType = 'bar-chart' | 'line-chart' | 'pie-chart';

export interface ChartMapping {
  labelColumn: string;
  valueColumns: string[];
}

export type ChartData = BarChartData | LineChartData | PieChartData;

/**
 * 按列映射把 ParsedSheet 派生为对应图表的 data。
 * - bar：labelColumn → 标签，valueColumns[0] → 数值（前 20 行）。
 * - pie：labelColumn → 标签，valueColumns[0] → 数值。
 * - line：labelColumn 为 X 轴，valueColumns 每列一条系列（多系列）。
 * 颜色按 DEFAULT_CHART_PALETTE 轮询；非数值按 0。
 */
export function buildChartData(
  type: ChartType,
  sheet: ParsedSheet,
  mapping: ChartMapping,
  prevTitle?: string,
): ChartData {
  const title = prevTitle ?? '';
  const rows = sheet.rows;
  const palette = DEFAULT_CHART_PALETTE;
  const labelColumn = mapping.labelColumn;

  switch (type) {
    case 'bar-chart': {
      const valueColumn = mapping.valueColumns[0] ?? '';
      const bars = rows
        .map((r, i) => ({
          label: String(r[labelColumn] ?? ''),
          value: num(r[valueColumn]),
          color: palette[i % palette.length],
        }))
        .slice(0, 20);
      return { title, bars } as BarChartData;
    }
    case 'pie-chart': {
      const valueColumn = mapping.valueColumns[0] ?? '';
      const slices = rows.map((r, i) => ({
        label: String(r[labelColumn] ?? ''),
        value: num(r[valueColumn]),
        color: palette[i % palette.length],
      }));
      return { title, slices } as PieChartData;
    }
    case 'line-chart': {
      const series = mapping.valueColumns.map((vc, si) => ({
        name: vc,
        color: palette[si % palette.length],
        points: rows.map((r) => ({
          label: String(r[labelColumn] ?? ''),
          value: num(r[vc]),
        })),
      }));
      return { title, series } as LineChartData;
    }
  }
}

/** 统计某几列中非数值（含空）单元格数，供导入弹框角标提示。 */
export function countNonNumeric(sheet: ParsedSheet, columns: string[]): number {
  let n = 0;
  for (const r of sheet.rows) {
    for (const c of columns) {
      const raw = String(r[c] ?? '').replace(/[,，]/g, '');
      if (raw.trim() === '' || !Number.isFinite(Number(raw))) n++;
    }
  }
  return n;
}

function num(v: string): number {
  const n = Number(String(v).replace(/[,，]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
```

- [ ] **Step 2: 更新 ComponentRenderer.tsx（不再 resolveData）**

完整新内容：

```tsx
import type { EditorComponent } from '@mediakit/shared';
import { REGISTRY } from '../registry';

/** 按 comp.type 分发到 REGISTRY 中注册的组件，直接用 comp.data 渲染。 */
export function ComponentRenderer({ comp }: { comp: EditorComponent }) {
  const Comp = REGISTRY[comp.type].Component;
  return <Comp data={comp.data} />;
}
```

- [ ] **Step 3: 更新 PageView.tsx 注释**

把第 11 行那条注释：

```
 * datasources 由 ComponentRenderer 内部订阅 store（预览同会话可用；分享页回落默认数据）。
```

替换为：

```
 * 图表数据直接来自 comp.data（导入/手动编辑都写入 comp.data，预览/分享/PDF 同源）。
```

- [ ] **Step 4: 重写 editor.resolve.test.ts**

完整新内容：

```ts
import { describe, it, expect } from 'vitest';
import { buildChartData, countNonNumeric } from '@/editor/datasource/resolve';
import type { ParsedSheet } from '@/editor/datasource/parse';
import { DEFAULT_CHART_PALETTE } from '@mediakit/shared';

const sheet: ParsedSheet = {
  name: '销售',
  columns: ['月份', 'GMV', '成本'],
  rows: [
    { 月份: '1月', GMV: '120', 成本: '60' },
    { 月份: '2月', GMV: '1,800', 成本: 'x' },
    { 月份: 'bad', GMV: 'x', 成本: '' },
  ],
};

describe('buildChartData', () => {
  it('bar-chart: label + first value column, parses numbers, caps 20, palette colors', () => {
    const data = buildChartData('bar-chart', sheet, { labelColumn: '月份', valueColumns: ['GMV'] }, '原标题') as {
      title: string;
      bars: { label: string; value: number; color: string }[];
    };
    expect(data.title).toBe('原标题');
    expect(data.bars).toHaveLength(3);
    expect(data.bars[0]).toMatchObject({ label: '1月', value: 120 });
    expect(data.bars[1].value).toBe(1800); // 1,800 → 1800
    expect(data.bars[2].value).toBe(0); // 'x' → 0
    expect(data.bars[0].color).toBe(DEFAULT_CHART_PALETTE[0]);
  });

  it('pie-chart: label + first value column', () => {
    const data = buildChartData('pie-chart', sheet, { labelColumn: '月份', valueColumns: ['GMV'] }) as {
      slices: { label: string; value: number }[];
    };
    expect(data.slices).toHaveLength(3);
    expect(data.slices[0]).toMatchObject({ label: '1月', value: 120 });
  });

  it('line-chart: each value column becomes a series (multi-series)', () => {
    const data = buildChartData('line-chart', sheet, { labelColumn: '月份', valueColumns: ['GMV', '成本'] }) as {
      series: { name: string; color: string; points: { label: string; value: number }[] }[];
    };
    expect(data.series).toHaveLength(2);
    expect(data.series[0].name).toBe('GMV');
    expect(data.series[1].name).toBe('成本');
    expect(data.series[0].points[0]).toMatchObject({ label: '1月', value: 120 });
    expect(data.series[1].points[1].value).toBe(0); // 'x' → 0
    expect(data.series[1].color).toBe(DEFAULT_CHART_PALETTE[1]);
  });
});

describe('countNonNumeric', () => {
  it('counts empty and non-numeric cells across given columns', () => {
    // GMV: '120'(ok) '1,800'(ok) 'x'(bad) → 1
    // 成本: '60'(ok) 'x'(bad) ''(bad) → 2
    expect(countNonNumeric(sheet, ['GMV', '成本'])).toBe(3);
  });

  it('returns 0 when all numeric', () => {
    const ok: ParsedSheet = {
      name: 'x',
      columns: ['a', 'b'],
      rows: [{ a: '1', b: '2' }],
    };
    expect(countNonNumeric(ok, ['a', 'b'])).toBe(0);
  });
});
```

- [ ] **Step 5: 跑测试**

Run: `pnpm --filter @mediakit/web test`
Expected: PASS。`buildChartData`/`countNonNumeric` 全绿。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/editor/datasource/resolve.ts apps/web/src/editor/components/ComponentRenderer.tsx apps/web/src/editor/preview/PageView.tsx apps/web/tests/editor.resolve.test.ts
git commit -m "feat(web): resolve 改为 buildChartData，ComponentRenderer 直读 comp.data"
```

---

## Task 3: 从 store 与 UI 移除「数据源」机制

**Files:**
- Modify: `apps/web/src/editor/store.ts`
- Modify: `apps/web/src/editor/PropertyPanel.tsx`（删 `BindingEditor`）
- Modify: `apps/web/src/editor/ComponentPanel.tsx`（删 `DatasourceMenu`）
- Delete: `apps/web/src/editor/components/DatasourceMenu.tsx`
- Delete: `apps/web/tests/editor.m5.test.tsx`

- [ ] **Step 1: store.ts 移除 datasource，新增 setComponentData**

1a. 改 import（第 2–14 行那段 import 块），从 `import type { ... }` 中删掉 `ComponentBinding` 和 `Datasource` 两个标识符。结果该块为：

```ts
import type {
  ComponentData,
  ComponentType,
  EditorComponent,
  Page,
  ProjectDetail,
  ProjectMeta,
  ProjectTheme,
  ThemeDensity,
  ThemeRadius,
} from '@mediakit/shared';
```

1b. 删 `EditorState` 接口里的字段与动作：
- 删第 64–65 行：

```ts
  /** 数据源（M5，会话级，未持久化到后端）。 */
  datasources: Datasource[];
```

- 删第 146–149 行：

```ts
  // ---- 数据源（M5）----
  addDatasource: (ds: Datasource) => void;
  removeDatasource: (id: string) => void;
  bindComponent: (id: string, binding: ComponentBinding | null) => void;
```

- 在「components」动作区（`updateComponentData` 之后、`move` 之前）新增 `setComponentData` 声明，使该区域为：

```ts
  updateComponent: (id: string, patch: Partial<EditorComponent>) => void;
  updateComponentData: (id: string, dataPatch: Record<string, unknown>) => void;
  /** 整体替换组件 data（导入数据用），落 history + 标脏。 */
  setComponentData: (id: string, data: ComponentData) => void;
  move: (ids: string[], dx: number, dy: number) => void;
```

1c. 删初始状态里的 `datasources: [],`（第 230 行那条）。

1d. 删 `loadProject` 内 `datasources: [],`（第 266 行那条）。

1e. 把实现里的三个动作（第 668–678 行整段）：

```ts
    addDatasource: (ds) => set((s) => ({ datasources: [...s.datasources, ds] })),

    removeDatasource: (id) =>
      set((s) => ({ datasources: s.datasources.filter((d) => d.id !== id) })),

    bindComponent: (id, binding) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
          cs.map((c) => (c.id === id ? { ...c, binding: binding ?? undefined } : c)),
        ),
      })),
```

整体替换为新的 `setComponentData` 实现：

```ts
    setComponentData: (id, data) =>
      mutateAndCommit((s) => ({
        pages: withCurrentComponents(s.pages, s.currentPageId, (cs) =>
          cs.map((c) => (c.id === id ? { ...c, data } : c)),
        ),
      })),
```

- [ ] **Step 2: PropertyPanel.tsx 删 BindingEditor**

2a. 删第 74–77 行那段挂载：

```tsx
      {(comp.type === 'bar-chart' ||
        comp.type === 'line-chart' ||
        comp.type === 'pie-chart' ||
        comp.type === 'table') && <BindingEditor comp={comp} />}
```

2b. 删整个 `BindingEditor` 函数（第 330–421 行，从 `/* ----------------------------- 绑定编辑器 ----------------------------- */` 注释起到该函数闭合的 `}`）。

- [ ] **Step 3: ComponentPanel.tsx 删 DatasourceMenu**

3a. 删第 3 行 import：

```tsx
import { DatasourceMenu } from './components/DatasourceMenu';
```

3b. 删第 94 行挂载 `<DatasourceMenu />`。

- [ ] **Step 4: 删除文件**

```bash
rm apps/web/src/editor/components/DatasourceMenu.tsx
rm apps/web/tests/editor.m5.test.tsx
```

- [ ] **Step 5: typecheck + test**

Run: `pnpm --filter @mediakit/web typecheck && pnpm --filter @mediakit/web test`
Expected: typecheck PASS，测试 PASS。若 typecheck 报 `datasources`/`addDatasource`/`removeDatasource`/`bindComponent`/`BindingEditor`/`DatasourceMenu` 未定义 —— 说明仍有遗漏引用，按报错删净（ExportMenu.tsx 第 7 行只是注释提及 DatasourceMenu 模式，不影响编译，无需改）。

- [ ] **Step 6: 提交**

```bash
git add -A apps/web/src apps/web/tests
git commit -m "refactor(web): 移除数据源绑定机制，store 新增 setComponentData"
```

---

## Task 4: 新建 ImportDataModal 组件（TDD）

**Files:**
- Create: `apps/web/src/editor/components/ImportDataModal.tsx`
- Create: `apps/web/tests/editor.import-modal.test.tsx`

- [ ] **Step 1: 先写失败测试 editor.import-modal.test.tsx**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportDataModal } from '@/editor/components/ImportDataModal';
import type { BarChartData } from '@mediakit/shared';

describe('ImportDataModal', () => {
  it('parses CSV, lets user confirm, and emits bar-chart data', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const file = new File(['月份,GMV\n1月,120\n2月,180'], 'sales.csv', { type: 'text/csv' });

    render(
      <ImportDataModal
        file={file}
        chartType="bar-chart"
        prevTitle="原标题"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    // 解析后默认映射：标签=第一列，数值=第二列。
    await screen.findByLabelText('标签列');
    expect((screen.getByLabelText('标签列') as HTMLSelectElement).value).toBe('月份');
    expect((screen.getByLabelText('数值列') as HTMLSelectElement).value).toBe('GMV');

    await user.click(screen.getByText('确认导入'));
    expect(onConfirm).once;
    const data = onConfirm.mock.calls[0][0] as BarChartData;
    expect(data.title).toBe('原标题');
    expect(data.bars).toHaveLength(2);
    expect(data.bars[0]).toMatchObject({ label: '1月', value: 120 });
    expect(data.bars[1].value).toBe(180);
  });

  it('cancel calls onCancel without emitting data', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const file = new File(['a,b\n1,2'], 'x.csv', { type: 'text/csv' });

    render(
      <ImportDataModal
        file={file}
        chartType="pie-chart"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await screen.findByLabelText('标签列');
    await user.click(screen.getByText('取消'));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows error for empty file', async () => {
    const file = new File([''], 'empty.csv', { type: 'text/csv' });
    render(
      <ImportDataModal file={file} chartType="bar-chart" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    await waitFor(() => {
      expect(screen.getByText(/无有效表头/)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mediakit/web test editor.import-modal`
Expected: FAIL（`ImportDataModal` 模块不存在）。

- [ ] **Step 3: 实现 ImportDataModal.tsx**

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { EditorComponent } from '@mediakit/shared';
import { parseFile, type ParsedSheet } from '../datasource/parse';
import {
  buildChartData,
  countNonNumeric,
  type ChartData,
  type ChartType,
} from '../datasource/resolve';
import { BarChartComponent, LineChartComponent, PieChartComponent } from './BasicComponents';

interface Props {
  file: File;
  chartType: ChartType;
  prevTitle?: string;
  onConfirm: (data: ChartData) => void;
  onCancel: () => void;
}

export function ImportDataModal({ file, chartType, prevTitle, onConfirm, onCancel }: Props) {
  const [sheets, setSheets] = useState<ParsedSheet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [labelColumn, setLabelColumn] = useState('');
  const [valueColumns, setValueColumns] = useState<string[]>([]);

  const isLine = chartType === 'line-chart';

  useEffect(() => {
    let alive = true;
    setError(null);
    setSheets(null);
    parseFile(file)
      .then((parsed) => {
        if (!alive) return;
        if (parsed.length === 0 || parsed.every((s) => s.columns.length === 0)) {
          setError('文件无有效表头，请检查内容');
          return;
        }
        setSheets(parsed);
        setSheetIndex(0);
        const first = parsed[0];
        const label = first.columns[0] ?? '';
        const values = isLine
          ? first.columns.slice(1)
          : [first.columns[1] ?? first.columns[0] ?? ''].filter(Boolean);
        setLabelColumn(label);
        setValueColumns(values);
      })
      .catch(() => alive && setError('解析失败，请检查文件格式'));
    return () => {
      alive = false;
    };
  }, [file, isLine]);

  const sheet = sheets?.[sheetIndex] ?? null;
  const columns = sheet?.columns ?? [];

  const preview = useMemo<ChartData | null>(() => {
    if (!sheet || !labelColumn || valueColumns.length === 0) return null;
    return buildChartData(chartType, sheet, { labelColumn, valueColumns }, prevTitle);
  }, [sheet, chartType, labelColumn, valueColumns, prevTitle]);

  const nonNumeric = sheet ? countNonNumeric(sheet, valueColumns.filter(Boolean)) : 0;
  const tooManyBars = chartType === 'bar-chart' && (sheet?.rows.length ?? 0) > 20;

  function toggleValueColumn(col: string) {
    setValueColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[90vh] w-[640px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-headings text-sm font-semibold text-foreground-primary">
          导入数据 · {file.name}
        </div>

        {error && <p className="text-xs text-red">{error}</p>}

        {!sheets && !error && (
          <p className="text-xs text-foreground-muted">解析中…</p>
        )}

        {sheet && (
          <>
            {sheets && sheets.length > 1 && (
              <label className="block text-xs text-foreground-secondary">
                <span className="mb-1 block">工作表</span>
                <select
                  value={sheetIndex}
                  onChange={(e) => setSheetIndex(Number(e.target.value))}
                  className="w-full rounded border border-border-default bg-surface-primary px-2 py-1"
                >
                  {sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-foreground-secondary">
                <span className="mb-1 block">标签列</span>
                <select
                  value={labelColumn}
                  onChange={(e) => setLabelColumn(e.target.value)}
                  className="w-full rounded border border-border-default bg-surface-primary px-2 py-1"
                >
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <div className="text-xs text-foreground-secondary">
                <span className="mb-1 block">{isLine ? '数值列（可多选）' : '数值列'}</span>
                {isLine ? (
                  <div className="flex max-h-32 flex-wrap gap-2 overflow-auto rounded border border-border-default p-1">
                    {columns.map((c) => (
                      <label key={c} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={valueColumns.includes(c)}
                          onChange={() => toggleValueColumn(c)}
                        />
                        <span>{c}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <select
                    value={valueColumns[0] ?? ''}
                    onChange={(e) => setValueColumns(e.target.value ? [e.target.value] : [])}
                    className="w-full rounded border border-border-default bg-surface-primary px-2 py-1"
                  >
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {nonNumeric > 0 && (
              <p className="text-xs text-amber-600">{nonNumeric} 个单元格非数值，已按 0 计算</p>
            )}
            {tooManyBars && (
              <p className="text-xs text-foreground-muted">数据超过 20 行，柱状图将只取前 20 行。</p>
            )}

            <div className="rounded border border-border-default p-2">
              <div className="mb-1 text-xs text-foreground-muted">预览</div>
              <div className="h-48">
                {preview ? (
                  <PreviewChart type={chartType} data={preview} />
                ) : (
                  <p className="text-xs text-foreground-muted">请选择标签列与数值列</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={onCancel}
                className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
              >
                取消
              </button>
              <button
                disabled={!preview}
                onClick={() => preview && onConfirm(preview)}
                className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50"
              >
                确认导入
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PreviewChart({ type, data }: { type: ChartType; data: ChartData }) {
  if (type === 'bar-chart') return <BarChartComponent data={data} />;
  if (type === 'line-chart') return <LineChartComponent data={data} />;
  return <PieChartComponent data={data} />;
}
```

> 注：`PreviewChart` 直接复用 REGISTRY 的图表组件作预览。若 `BasicComponents` 里导出名不同，按实际导出调整（Task 实施时 `grep -n "export" apps/web/src/editor/components/BasicComponents.tsx` 确认）。三个组件签名均为 `(props: { data: 对应类型 }) => JSX`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mediakit/web test editor.import-modal`
Expected: PASS（3 个用例全绿）。若 `getByLabelText` 找不到元素，确认 `<label>` 内的 `<select>` 是否被 testing-library 识别为 label 关联（写法已用 label 包裹 select，应可识别）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/editor/components/ImportDataModal.tsx apps/web/tests/editor.import-modal.test.tsx
git commit -m "feat(web): 新建 ImportDataModal（解析+多sheet+列映射+预览）"
```

---

## Task 5: 把 ImportDataModal 接入 PropertyPanel

**Files:**
- Modify: `apps/web/src/editor/PropertyPanel.tsx`

- [ ] **Step 1: 加 useRef 导入**

把第 1 行：

```tsx
import { useEffect, useState } from 'react';
```

改为：

```tsx
import { useEffect, useRef, useState } from 'react';
```

- [ ] **Step 2: 加 ImportDataModal 导入**

在 `PropertyPanel.tsx` 顶部 import 区（`import { parseCreatorLink } from './creatorLink';` 之后）新增：

```tsx
import { ImportDataModal } from './components/ImportDataModal';
import type { ChartData } from './datasource/resolve';
import type { EditorComponent } from '@mediakit/shared';
```

> 若 `EditorComponent` 已在其他 import 中引入则不重复。当前文件第 4 行已 `import type { ..., EditorComponent, ... }`，故本步**只加前两行**（ImportDataModal + ChartData），不要重复 EditorComponent。

- [ ] **Step 3: 在面板顶部挂载 ChartImportButton**

在 `PropertyPanel` 函数的 return 内，紧接标题 `<div className="font-headings ...">{LABELS[comp.type] ?? comp.type}</div>` 之后、`{comp.type === 'creator-avatar-card' && ...}` 之前，插入：

```tsx
      {(comp.type === 'bar-chart' ||
        comp.type === 'line-chart' ||
        comp.type === 'pie-chart') && <ChartImportButton comp={comp} />}
```

- [ ] **Step 4: 实现 ChartImportButton 组件**

在 `PropertyPanel.tsx` 文件末尾（最后一个组件之后）新增：

```tsx
/* ----------------------------- 图表数据导入 ----------------------------- */

/** 柱/折/饼图：导入 Excel/CSV → 映射列 → 写入 comp.data。 */
function ChartImportButton({ comp }: { comp: EditorComponent }) {
  const setComponentData = useEditorStore((s) => s.setComponentData);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chartType = comp.type as 'bar-chart' | 'line-chart' | 'pie-chart';
  const prevTitle = (comp.data as { title?: string }).title;

  return (
    <FieldGroup title="数据导入">
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
      >
        导入 Excel/CSV
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setFile(f);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
      {file && (
        <ImportDataModal
          file={file}
          chartType={chartType}
          prevTitle={prevTitle}
          onConfirm={(data: ChartData) => {
            setComponentData(comp.id, data);
            setFile(null);
          }}
          onCancel={() => setFile(null)}
        />
      )}
    </FieldGroup>
  );
}
```

- [ ] **Step 5: typecheck + 全量测试**

Run: `pnpm --filter @mediakit/web typecheck && pnpm --filter @mediakit/web test`
Expected: typecheck PASS，全部测试 PASS。

- [ ] **Step 6: 手动验证**

确保 `pnpm dev` 跑着，浏览器打开 http://localhost:5173/ ：
1. 新建/打开项目，拖入一个「柱状图」组件并选中。
2. 右侧属性面板顶部出现「数据导入」分组与「导入 Excel/CSV」按钮。
3. 准备一个 CSV（如 `月份,GMV\n1月,120\n2月,180\n3月,90`），点导入 → 弹框显示标签列=月份、数值列=GMV，预览正确 → 确认。
4. 画布上柱状图数据更新为导入值；刷新页面数据仍在（持久化）。
5. 对「折线图」重复：弹框数值列可多选，确认多系列折线出现。
6. 对「饼图」重复。
7. 确认工具栏不再有「数据源」按钮，属性面板不再有「数据源绑定」分组。

- [ ] **Step 7: 提交**

```bash
git add apps/web/src/editor/PropertyPanel.tsx
git commit -m "feat(web): 图表属性面板接入 Excel/CSV 直接导入"
```

---

## Self-Review

**Spec coverage:**
- 入口在属性面板顶部、移除数据源/绑定、保留手动编辑器 → Task 3 + Task 5。✓
- 映射弹框（sheet 切换、bar/pie 单值、line 多系列、预览、确认）→ Task 4。✓
- parse 多 sheet、buildChartData（颜色轮询、bar 20 条上限）→ Task 1 + Task 2。✓
- store 新增 setComponentData、移除 datasource 状态/动作 → Task 3。✓
- ComponentRenderer 直读 comp.data、PageView 注释 → Task 2。✓
- 持久化：写入 comp.data 走已有 autosave（无后端改动）→ Task 5 setComponentData。✓
- 边界：解析失败提示、非数值按 0 + 角标、bar>20 提示、覆盖语义、空映射禁用确认 → Task 4。✓
- 测试：parse/buildChartData/countNonNumeric 单测 + ImportDataModal 组件测 → Task 1/2/4。✓

**Placeholder scan:** 无 TBD/TODO；每步含完整代码或确切命令。PreviewChart 处给了 grep 兜底说明（导出名确认），非占位符。

**Type consistency:** `ChartType`/`ChartMapping`/`ChartData`/`ParsedSheet` 在 resolve.ts 定义，parse.ts 定义 `ParsedSheet`，ImportDataModal 与测试导入路径一致；`setComponentData(id, data: ComponentData)` 签名与 PropertyPanel 调用一致；store import 删 `ComponentBinding`/`Datasource` 后无残留引用。
