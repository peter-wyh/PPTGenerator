import * as XLSX from 'xlsx';
import type { Datasource } from '@mediakit/shared';

/** 把「数组行」（第一行表头）转成 Datasource。 */
function fromMatrix(name: string, matrix: string[][]): Datasource {
  if (matrix.length === 0) return { id: rid(name), name, columns: [], rows: [] };
  const columns = matrix[0].map((h, i) => String(h ?? `列${i + 1}`));
  const rows = matrix.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    columns.forEach((c, i) => (obj[c] = String(r[i] ?? '')));
    return obj;
  });
  return { id: rid(name), name, columns, rows };
}

function rid(name: string): string {
  return `${name}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 解析 CSV 文本（支持引号包裹的字段与逗号转义）。 */
export function parseCSV(text: string, name = 'CSV'): Datasource {
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

/** 解析 Excel ArrayBuffer（取第一个 sheet）。 */
export function parseExcel(buffer: ArrayBuffer, name = 'Excel'): Datasource {
  const wb = XLSX.read(buffer, { type: 'array' });
  const first = wb.SheetNames[0];
  if (!first) return { id: rid(name), name, columns: [], rows: [] };
  const sheet = wb.Sheets[first];
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false });
  return fromMatrix(name, matrix as unknown as string[][]);
}

/** 根据文件名/类型选择解析器。 */
export async function parseFile(file: File): Promise<Datasource> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv') || file.type === 'text/csv') {
    return parseCSV(await file.text(), file.name.replace(/\.[^.]+$/, ''));
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buf = await file.arrayBuffer();
    return parseExcel(buf, file.name.replace(/\.[^.]+$/, ''));
  }
  // 兜底按文本 CSV 解析。
  return parseCSV(await file.text(), file.name.replace(/\.[^.]+$/, ''));
}
