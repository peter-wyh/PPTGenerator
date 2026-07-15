// @vitest-environment node
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
  it('returns all sheets with their own names', async () => {
    const ws1 = XLSX.utils.aoa_to_sheet([['月份', 'GMV'], ['1月', 120]]);
    const ws2 = XLSX.utils.aoa_to_sheet([['a', 'b'], ['1', 2]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, '销售');
    XLSX.utils.book_append_sheet(wb, ws2, '其它');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;

    const sheets = await parseExcel(buf, 'file.xlsx');
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
