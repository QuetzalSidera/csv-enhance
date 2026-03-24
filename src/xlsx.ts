declare const Buffer: any;
declare function require(name: string): any;

import type { CellValue, TableData } from "./index";

const fs = require("fs");

interface ZipEntry {
  name: string;
  data: Uint8Array;
  crc32: number;
  offset: number;
}

export function encodeWorkbook(tables: Record<string, TableData>): Uint8Array {
  const entries = buildWorkbookEntries(tables);
  return encodeZip(entries);
}

export function writeWorkbookFile(tables: Record<string, TableData>, outputPath: string): void {
  const bytes = encodeWorkbook(tables);
  fs.writeFileSync(outputPath, Buffer.from(bytes));
}

function buildWorkbookEntries(tables: Record<string, TableData>): Array<{ name: string; content: string }> {
  const sheetNames = Object.keys(tables);
  if (sheetNames.length === 0) {
    throw new Error("Cannot generate XLSX without at least one table");
  }

  const entries: Array<{ name: string; content: string }> = [
    {
      name: "[Content_Types].xml",
      content: buildContentTypes(sheetNames.length),
    },
    {
      name: "_rels/.rels",
      content: buildRootRelationships(),
    },
    {
      name: "xl/workbook.xml",
      content: buildWorkbookXml(sheetNames),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: buildWorkbookRelationships(sheetNames.length),
    },
    {
      name: "xl/styles.xml",
      content: buildStylesXml(),
    },
  ];

  sheetNames.forEach((name, index) => {
    entries.push({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: buildWorksheetXml(tables[name]),
    });
  });

  return entries;
}

function buildContentTypes(sheetCount: number): string {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");

  return xml(
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      sheetOverrides +
      `</Types>`,
  );
}

function buildRootRelationships(): string {
  return xml(
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
  );
}

function buildWorkbookXml(sheetNames: string[]): string {
  const sheets = sheetNames
    .map(
      (name, index) =>
        `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");

  return xml(
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets>${sheets}</sheets>` +
      `</workbook>`,
  );
}

function buildWorkbookRelationships(sheetCount: number): string {
  const sheetRelationships = Array.from({ length: sheetCount }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");

  return xml(
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      sheetRelationships +
      `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`,
  );
}

function buildStylesXml(): string {
  return xml(
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
      `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
      `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
      `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
      `</styleSheet>`,
  );
}

function buildWorksheetXml(table: TableData): string {
  const headerRow = table.columns.map((column, index) => buildInlineStringCell(index + 1, 1, column)).join("");
  const dataRows = table.rows
    .map((row, rowIndex) => {
      const cells = table.columns
        .map((column, columnIndex) => buildCell(columnIndex + 1, rowIndex + 2, row[column]))
        .join("");
      return `<row r="${rowIndex + 2}">${cells}</row>`;
    })
    .join("");
  const dimension = `A1:${columnNumberToName(table.columns.length)}${Math.max(table.rows.length + 1, 1)}`;

  return xml(
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<dimension ref="${dimension}"/>` +
      `<sheetData>` +
      `<row r="1">${headerRow}</row>` +
      dataRows +
      `</sheetData>` +
      `</worksheet>`,
  );
}

function buildCell(column: number, row: number, value: CellValue): string {
  if (value === null) {
    return "";
  }

  const reference = `${columnNumberToName(column)}${row}`;
  if (typeof value === "number") {
    return `<c r="${reference}"><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
}

function buildInlineStringCell(column: number, row: number, value: string): string {
  const reference = `${columnNumberToName(column)}${row}`;
  return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function columnNumberToName(value: number): string {
  let current = value;
  let result = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function xml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function encodeZip(entries: Array<{ name: string; content: string }>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const builtEntries: ZipEntry[] = entries.map((entry) => {
    const data = utf8(entry.content);
    const nameBytes = utf8(entry.name);
    const crc32 = computeCrc32(data);
    const localHeader = concatBytes([
      le32(0x04034b50),
      le16(20),
      le16(0),
      le16(0),
      le16(0),
      le16(0),
      le32(crc32),
      le32(data.length),
      le32(data.length),
      le16(nameBytes.length),
      le16(0),
      nameBytes,
    ]);
    localParts.push(localHeader, data);

    const zipEntry: ZipEntry = {
      name: entry.name,
      data,
      crc32,
      offset,
    };
    offset += localHeader.length + data.length;
    return zipEntry;
  });

  for (const entry of builtEntries) {
    const nameBytes = utf8(entry.name);
    const centralHeader = concatBytes([
      le32(0x02014b50),
      le16(20),
      le16(20),
      le16(0),
      le16(0),
      le16(0),
      le16(0),
      le32(entry.crc32),
      le32(entry.data.length),
      le32(entry.data.length),
      le16(nameBytes.length),
      le16(0),
      le16(0),
      le16(0),
      le16(0),
      le32(0),
      le32(entry.offset),
      nameBytes,
    ]);
    centralParts.push(centralHeader);
  }

  const centralDirectory = concatBytes(centralParts);
  const localDirectory = concatBytes(localParts);
  const endOfCentralDirectory = concatBytes([
    le32(0x06054b50),
    le16(0),
    le16(0),
    le16(builtEntries.length),
    le16(builtEntries.length),
    le32(centralDirectory.length),
    le32(localDirectory.length),
    le16(0),
  ]);

  return concatBytes([localDirectory, centralDirectory, endOfCentralDirectory]);
}

function utf8(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "utf8"));
}

function le16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  bytes[0] = value & 0xff;
  bytes[1] = (value >>> 8) & 0xff;
  return bytes;
}

function le32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  bytes[0] = value & 0xff;
  bytes[1] = (value >>> 8) & 0xff;
  bytes[2] = (value >>> 16) & 0xff;
  bytes[3] = (value >>> 24) & 0xff;
  return bytes;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return merged;
}

function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC32_TABLE = buildCrc32Table();

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let current = i;
    for (let bit = 0; bit < 8; bit += 1) {
      current = (current & 1) === 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
    }
    table[i] = current >>> 0;
  }
  return table;
}
