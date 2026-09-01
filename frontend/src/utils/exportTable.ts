import type { RankTableColumn, RankTableRow } from '../components/ui/RankTable';

function getCellText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(getCellText).join('');
  if (typeof value === 'object') {
    const obj = value as { props?: unknown };
    if (obj.props != null) {
      const props = obj.props as Record<string, unknown>;
      if ('children' in props) return getCellText(props.children);
    }
  }
  return String(value);
}

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export function buildExportFilename(base: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${sanitizeFilename(base)}_${date}`;
}

export function exportToCsv(
  rows: RankTableRow[],
  columns: RankTableColumn[],
  filenameBase: string,
): void {
  const headers = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(';');
  const lines = rows.map((r) =>
    columns
      .map((c) => {
        const text = getCellText(r.values[c.key]).trim();
        return `"${text.replace(/"/g, '""')}"`;
      })
      .join(';'),
  );
  const csv = `\uFEFF${[headers, ...lines].join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${buildExportFilename(filenameBase)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToXlsx(
  rows: RankTableRow[],
  columns: RankTableColumn[],
  filenameBase: string,
  title?: string,
): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SRAG Mossoró';
  const sheet = workbook.addWorksheet(title ? title.slice(0, 31) : 'Dados');

  if (title) {
    const titleRow = sheet.addRow([title]);
    titleRow.font = { bold: true, size: 12, color: { argb: 'FF0F172A' } };
    sheet.addRow([]);
  }

  const headerRow = sheet.addRow(columns.map((c) => c.label));
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  });
  headerRow.height = 22;

  rows.forEach((r) => {
    const row = sheet.addRow(columns.map((c) => getCellText(r.values[c.key])));
    row.eachCell((cell, colNumber) => {
      const col = columns[colNumber - 1];
      cell.alignment = {
        vertical: 'middle',
        horizontal: col.align === 'right' ? 'right' : 'left',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFF1F5F9' } },
        bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } },
        left: { style: 'thin', color: { argb: 'FFF1F5F9' } },
        right: { style: 'thin', color: { argb: 'FFF1F5F9' } },
      };
    });
  });

  columns.forEach((c, idx) => {
    const col = sheet.getColumn(idx + 1);
    const maxLen = Math.max(
      c.label.length,
      ...rows.map((r) => getCellText(r.values[c.key]).length),
    );
    col.width = Math.min(42, Math.max(14, maxLen + 4));
  });

  sheet.views = [{ state: 'frozen', ySplit: title ? 3 : 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${buildExportFilename(filenameBase)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToPdf(
  rows: RankTableRow[],
  columns: RankTableColumn[],
  filenameBase: string,
  title?: string,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const isLandscape = columns.length > 4;
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateTime = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  if (title) {
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(title, 40, 36);
  }

  const head = [columns.map((c) => c.label)];
  const body = rows.map((r) => columns.map((c) => getCellText(r.values[c.key])));

  const headStyles = {
    fillColor: [15, 118, 110] as [number, number, number],
    textColor: [255, 255, 255] as [number, number, number],
    fontStyle: 'bold' as const,
    halign: 'center' as const,
    valign: 'middle' as const,
    fontSize: 7,
  };

  (autoTable as unknown as (doc: unknown, opts: unknown) => void)(doc, {
    head,
    body,
    startY: title ? 50 : 32,
    theme: 'grid',
    headStyles,
    styles: {
      fontSize: 7,
      cellPadding: 5,
      overflow: 'linebreak',
      valign: 'middle',
    },
    columnStyles: Object.fromEntries(
      columns.map((c, idx) => [idx, { halign: c.align === 'right' ? 'right' : 'left' }]),
    ),
    margin: { left: 32, right: 32, top: 12, bottom: 40 },
    didDrawPage: () => {
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`SRAG Mossoró — gerado em ${dateTime}`, 32, pageHeight - 18);
      doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth - 80, pageHeight - 18);
    },
  });

  doc.save(`${buildExportFilename(filenameBase)}.pdf`);
}

export { getCellText };
