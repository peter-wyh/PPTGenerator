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
