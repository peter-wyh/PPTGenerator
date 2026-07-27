/**
 * 字体文件二进制解析：零依赖读取 TTF/OTF/WOFF/WOFF2 的 name table，
 * 提取可读字体名（优先 Family Name = nameID 1，回退 PostScript = nameID 4）。
 *
 * TTF/OTF：sfnt 结构（offset table + table directory + name table）。
 * WOFF：外层 wrapper（WOFF header + table blocks，内层即 sfnt）。
 * WOFF2：Brotli 压缩，无法零依赖解析 → 回退文件名。
 *
 * 参考：
 *   https://learn.microsoft.com/en-us/typography/opentype/spec/name
 *   https://www.w3.org/TR/WOFF/
 */
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';

/** 字体格式 → CSS @font-face format() 值。 */
export type FontFormat = 'truetype' | 'opentype' | 'woff' | 'woff2';

export interface ParsedFontName {
  /** 可读字体名（如 'Noto Sans SC'）。失败时回退文件名（去扩展）。 */
  name: string;
  /** 文件格式（驱动 @font-face src format()）。 */
  format: FontFormat;
}

/* ---------- 低层：解析 sfnt name table ---------- */

interface NameRecord {
  platformID: number;
  encodingID: number;
  languageID: number;
  nameID: number;
  length: number;
  offset: number;
}

/**
 * 从 sfnt 字节中读取 name table，返回 nameID → 字符串 映射。
 * 输入为完整 sfnt 字节（即 TTF/OTF 原始字节，或 WOFF 解包后的 table bytes）。
 */
function readSfntNameTable(buf: Buffer): Record<number, string> {
  const result: Record<number, string> = {};
  if (buf.length < 12) return result;

  // 注意：sfnt tag 有 4 种合法值（0x00010000 / 'true' / 'typ1' / 'OTTO'），均支持。
  const numTables = buf.readUInt16BE(4);
  // table directory 从 offset 12 开始，每条 16 字节。
  let nameTableOffset = -1;
  let nameTableLength = 0;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (rec + 16 > buf.length) break;
    const tag = buf.toString('ascii', rec, rec + 4);
    if (tag === 'name') {
      nameTableOffset = buf.readUInt32BE(rec + 8);
      nameTableLength = buf.readUInt32BE(rec + 12);
      break;
    }
  }
  if (nameTableOffset < 0 || nameTableOffset + nameTableLength > buf.length) return result;

  const nameBuf = buf.subarray(nameTableOffset, nameTableOffset + nameTableLength);
  if (nameBuf.length < 6) return result;
  const count = nameBuf.readUInt16BE(2);
  const stringOffset = nameBuf.readUInt16BE(4);
  const records: NameRecord[] = [];

  for (let i = 0; i < count; i++) {
    const rec = 6 + i * 12;
    if (rec + 12 > nameBuf.length) break;
    records.push({
      platformID: nameBuf.readUInt16BE(rec),
      encodingID: nameBuf.readUInt16BE(rec + 2),
      languageID: nameBuf.readUInt16BE(rec + 4),
      nameID: nameBuf.readUInt16BE(rec + 6),
      length: nameBuf.readUInt16BE(rec + 8),
      offset: nameBuf.readUInt16BE(rec + 10),
    });
  }

  for (const r of records) {
    if (r.nameID in result) {
      // 已有值：优先 Windows 平台（更通用的 UTF-16），其次 Mac Roman。
      const existingPlatform = (result as any)._platformID;
      if (existingPlatform === 3 && r.platformID !== 3) continue;
    }
    const strStart = stringOffset + r.offset;
    const strEnd = strStart + r.length;
    if (strEnd > nameBuf.length) continue;
    const raw = nameBuf.subarray(strStart, strEnd);
    let str: string;
    if (r.platformID === 3 || (r.platformID === 0 && r.encodingID >= 1)) {
      // Windows / Unicode UTF-16BE
      try {
        str = raw.toString('utf16le');
        // 修正字节序：raw 是 BE，toString('utf16le') 会按 LE 解，需手动交换。
        let swapped = '';
        for (let i = 0; i + 1 < raw.length; i += 2) {
          swapped += String.fromCharCode((raw[i] << 8) | raw[i + 1]);
        }
        str = swapped;
      } catch {
        continue;
      }
    } else if (r.platformID === 1) {
      // Mac Roman（近似 latin1）
      str = raw.toString('latin1');
    } else {
      str = raw.toString('utf8');
    }
    result[r.nameID] = str.trim();
    (result as any)._platformID = r.platformID;
  }
  delete (result as any)._platformID;
  return result;
}

/* ---------- WOFF 解包 ---------- */

/**
 * WOFF (v1) 外层：header 之后是 table blocks，每个 block 是压缩后的 sfnt 单表。
 * 需要解压并按 sfnt 目录顺序重新拼回完整 sfnt（含 offset table + table directory + 各表字节），
 * 这样上面的 readSfntNameTable 才能按 sfnt 协议定位 name table。
 *
 * 参考 WOFF §5。
 */
function unwrapWoff(buf: Buffer): Buffer | null {
  if (buf.length < 44) return null;
  const flavor = buf.readUInt32BE(4); // sfnt 版本
  const numTables = buf.readUInt16BE(12);
  // totalSfntSize = buf.readUInt32BE(16); // 可用，但我们按表重拼

  // 重建 sfnt：offset table(12) + table directory(numTables*16) + 各表数据。
  const headerSize = 12 + numTables * 16;
  const tables: { tag: string; data: Buffer }[] = [];
  let blockOffset = 44;
  for (let i = 0; i < numTables; i++) {
    if (blockOffset + 20 > buf.length) return null;
    const tag = buf.toString('ascii', blockOffset, blockOffset + 4);
    const origLength = buf.readUInt32BE(blockOffset + 4);
    const compLength = buf.readUInt32BE(blockOffset + 8);
    // origChecksum / origOffset 跳过
    const dataStart = blockOffset + 20;
    const dataEnd = dataStart + compLength;
    if (dataEnd > buf.length) return null;
    let data: Buffer;
    if (compLength < origLength) {
      // zlib 压缩（deflate）
      try {
        data = inflateSync(buf.subarray(dataStart, dataEnd));
      } catch {
        return null;
      }
    } else {
      data = buf.subarray(dataStart, dataEnd);
    }
    tables.push({ tag, data });
    blockOffset = dataEnd;
    // 对齐到 4 字节边界
    if (blockOffset % 4 !== 0) blockOffset += 4 - (blockOffset % 4);
  }

  // 拼 sfnt
  let totalLen = headerSize;
  for (const t of tables) {
    totalLen += t.data.length;
    // 表起始需 4 字节对齐
    if (t.data.length % 4 !== 0) totalLen += 4 - (t.data.length % 4);
  }
  const out = Buffer.alloc(totalLen);
  // offset table
  out.writeUInt32BE(flavor, 0);
  out.writeUInt16BE(numTables, 4);
  // searchRange / entrySelector / rangeShift 简化（多数解析器不校验）
  const entrySelector = Math.floor(Math.log2(numTables));
  const searchRange = Math.pow(2, entrySelector) * 16;
  const rangeShift = numTables * 16 - searchRange;
  out.writeUInt16BE(searchRange, 6);
  out.writeUInt16BE(entrySelector, 8);
  out.writeUInt16BE(rangeShift, 10);

  // table directory
  let dataCursor = headerSize;
  for (let i = 0; i < tables.length; i++) {
    const dirOff = 12 + i * 16;
    out.write(tables[i].tag, dirOff, 'ascii');
    out.writeUInt32BE(0, dirOff + 4); // checksum 跳过
    out.writeUInt32BE(dataCursor, dirOff + 8);
    out.writeUInt32BE(tables[i].data.length, dirOff + 12);
    tables[i].data.copy(out, dataCursor);
    dataCursor += tables[i].data.length;
    if (dataCursor % 4 !== 0) dataCursor += 4 - (dataCursor % 4);
  }
  return out;
}

/* ---------- ZIP 解包（store + deflate） ---------- */

interface ZipEntry {
  name: string;
  isDirectory: boolean;
  data: Buffer;
}

/**
 * 零依赖 ZIP 读取：扫描 Central Directory，解压本地文件条目。
 * 支持 compression method 0 (store) 与 8 (deflate)。
 * 不支持加密 zip。
 */
export function readZip(buf: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  if (buf.length < 22) return entries;

  // 找 EOCD（End of Central Directory）签名 0x06054b50，从尾部向前扫。
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return entries;

  const cdEntries = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < cdEntries; i++) {
    if (cdOffset + 46 > buf.length) break;
    if (buf.readUInt32LE(cdOffset) !== 0x02014b50) break;
    const method = buf.readUInt16LE(cdOffset + 10);
    const compSize = buf.readUInt32LE(cdOffset + 20);
    const uncompSize = buf.readUInt32LE(cdOffset + 24);
    const nameLen = buf.readUInt16LE(cdOffset + 28);
    const extraLen = buf.readUInt16LE(cdOffset + 30);
    const commentLen = buf.readUInt16LE(cdOffset + 32);
    const localHeaderOff = buf.readUInt32LE(cdOffset + 42);
    const name = buf.toString('utf8', cdOffset + 46, cdOffset + 46 + nameLen);

    cdOffset += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/')) {
      entries.push({ name, isDirectory: true, data: Buffer.alloc(0) });
      continue;
    }

    // 读 local header 拿真实 dataOffset
    if (localHeaderOff + 30 > buf.length) continue;
    const lNameLen = buf.readUInt16LE(localHeaderOff + 26);
    const lExtraLen = buf.readUInt16LE(localHeaderOff + 28);
    const dataStart = localHeaderOff + 30 + lNameLen + lExtraLen;
    const compData = buf.subarray(dataStart, dataStart + compSize);

    let data: Buffer;
    if (method === 0) {
      data = compData;
    } else if (method === 8) {
      try {
        data = inflateSync(compData);
      } catch {
        continue;
      }
    } else {
      continue; // 不支持的压缩方式
    }
    if (data.length !== uncompSize && uncompSize !== 0) {
      // 大小不匹配，仍尝试用解压结果（防御）
    }
    entries.push({ name, isDirectory: false, data });
  }
  return entries;
}

/* ---------- 主入口 ---------- */

const FONT_EXT_TO_FORMAT: Record<string, FontFormat> = {
  ttf: 'truetype',
  otf: 'opentype',
  woff: 'woff',
  woff2: 'woff2',
};

/** 字体文件扩展名白名单。 */
export const FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'] as const;
export type FontExtension = (typeof FONT_EXTENSIONS)[number];

/** 判断文件名是否为支持的字体扩展。 */
export function isFontFile(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  return (FONT_EXTENSIONS as readonly string[]).includes(ext);
}

/** 从 ZIP 中提取字体文件条目（过滤非字体、目录、__MACOSX/隐藏文件）。 */
export function extractFontsFromZip(buf: Buffer): { name: string; data: Buffer }[] {
  return readZip(buf)
    .filter((e) => !e.isDirectory && isFontFile(e.name) && !e.name.includes('__MACOSX') && !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, data: e.data }));
}

/**
 * 解析字体字节，返回可读名 + format。
 * 先按 magic bytes 判断容器类型（WOFF2/WOFF/sfnt），再走对应分支。
 * 失败时回退使用 basename（去扩展名）作为字体名。
 */
export function parseFontName(buf: Buffer, fallbackBasename: string): ParsedFontName {
  const ext = (fallbackBasename.toLowerCase().split('.').pop() ?? '') as FontExtension;
  const format = FONT_EXT_TO_FORMAT[ext] ?? 'truetype';

  let sfnt: Buffer | null = null;
  if (buf.length >= 4) {
    const sig = buf.toString('ascii', 0, 4);
    if (sig === 'wOF2') {
      // WOFF2：尝试 Brotli 解压后重建（复杂，这里尽力而为）。
      sfnt = tryUnwrapWoff2(buf);
    } else if (sig === 'wOFF') {
      sfnt = unwrapWoff(buf);
    } else {
      // 直接当 sfnt
      sfnt = buf;
    }
  }

  if (sfnt) {
    const names = readSfntNameTable(sfnt);
    // 优先 family name（1），回退 PostScript（4），再回退 uniqueID（3）。
    const family =
      names[1] || names[4] || names[3] || names[16] || '';
    if (family) {
      return { name: family.replace(/\s+/g, ' ').trim(), format };
    }
  }

  // 回退：basename 去扩展
  const base = fallbackBasename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return { name: base || 'Custom Font', format };
}

/* ---------- WOFF2 尝试（尽力而为） ---------- */

/**
 * 尝试解包 WOFF2。WOFF2 内部是 Brotli 压缩的 sfnt collection 或 sfnt，
 * 且表目录用自定义编码（glyf/loca 变换），完整重建复杂。
 * 这里仅尝试最简情况：找到 brotli stream 解压后直接交给 readSfntNameTable
 * （多数情况下 name 表能被直接读到，因为 name 表不做 brotli 转换）。
 */
function tryUnwrapWoff2(buf: Buffer): Buffer | null {
  try {
    // WOFF2 header 48 字节，broSfntData 紧随其后。
    if (buf.length < 48) return null;
    // simplified: totalSfntSize@16, totalCompressedSize@20（仅 compressed 数据）。
    // 实际 WOFF2 表目录在 header 之后，结构复杂。这里对纯 name 表查询走乐观路径：
    // 扫描整个 buffer 寻找可被 Brotli 解压、且解压结果含 'name' 表的片段。
    // （工程上不优雅，但对"用户上传 woff2 想拿到字体名"足够用。）
    // 更稳妥的方案是依赖 wawoff2 等库；此处零依赖，先尽力而为。
    for (let start = 48; start < buf.length - 4; start++) {
      try {
        const dec = brotliDecompressSync(buf.subarray(start));
        if (dec && dec.includes('name')) {
          // 简易重建：当作 sfnt 试读。多数会因 offset table 缺失而失败，但值得试。
          return dec.includes(Buffer.from([0, 1, 0, 0])) || dec.includes(Buffer.from('OTTO'))
            ? dec
            : null;
        }
      } catch {
        // continue scanning
      }
    }
    return null;
  } catch {
    return null;
  }
}

// 保留 gunzip 引用以避免在某些打包配置下被 tree-shake 移除（暂未使用，预留给 gzip 封装）。
export const _gunzipRef = gunzipSync;
