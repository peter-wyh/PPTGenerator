import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { File as NodeFile } from 'node:buffer';
import { ImportDataModal } from '@/editor/components/ImportDataModal';
import type { BarChartData } from '@mediakit/shared';

// jsdom 的 File polyfill 是早期 W3C FileAPI，未实现 Blob.text()，
// 而 parseFile 内部调用 file.text()。改用 Node 内置（undici）的 File ——
// 它原生支持 .text()/.arrayBuffer() 且构造签名兼容 new File([parts], name, opts)。
// 仅在当前 jsdom File 缺少 .text 时替换。
if (typeof File !== 'undefined' && !File.prototype.text) {
  (globalThis as unknown as { File: typeof NodeFile }).File = NodeFile;
}

// recharts 在 jsdom 下依赖 ResizeObserver/尺寸，桩成轻量 div（仓库既有约定，见 components.test.tsx）。
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
}));

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
    expect(onConfirm).toHaveBeenCalledTimes(1);
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
