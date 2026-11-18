export interface PdfReportSection {
  heading: string;
  lines: string[];
}

export interface PdfReportTable {
  headers: string[];
  columnWidths?: number[];
  rows: string[][];
}

export interface PdfReportOptions {
  filename: string;
  title: string;
  subtitle?: string;
  metaLines?: string[];
  sections?: PdfReportSection[];
  table?: PdfReportTable;
}

const PAGE_W = 1240;
const PAGE_H = 1754;
const MARGIN_X = 76;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const TOP_Y = 76;
const BOTTOM_Y = PAGE_H - 90;

function createPageCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  return { canvas, ctx };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = String(text || '').split(/\r?\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${current} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function buildPdfBlobFromJpegs(pages: Array<{ jpeg: Uint8Array; width: number; height: number }>): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteLength = 0;

  const pushStr = (s: string) => {
    const bytes = encoder.encode(s);
    chunks.push(bytes);
    byteLength += bytes.length;
  };
  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    byteLength += bytes.length;
  };

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // Object 1: Catalog, Object 2: Pages
  // Each page uses 3 objects: Page (3 + i*3), Content stream (4 + i*3), Image XObject (5 + i*3)
  const pageCount = pages.length;
  const pageObjIds: number[] = [];
  for (let i = 0; i < pageCount; i++) {
    pageObjIds.push(3 + i * 3);
  }

  offsets[1] = byteLength;
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets[2] = byteLength;
  pushStr(`2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>\nendobj\n`);

  const ptW = 595.28;
  const ptH = 841.89;

  for (let i = 0; i < pageCount; i++) {
    const pageId = 3 + i * 3;
    const contentId = 4 + i * 3;
    const imgId = 5 + i * 3;
    const { jpeg, width, height } = pages[i];

    offsets[pageId] = byteLength;
    pushStr(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Resources << /XObject << /Im0 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );

    const drawCmd = `q\n${ptW} 0 0 ${ptH} 0 0 cm\n/Im0 Do\nQ\n`;
    const drawBytes = encoder.encode(drawCmd);
    offsets[contentId] = byteLength;
    pushStr(`${contentId} 0 obj\n<< /Length ${drawBytes.length} >>\nstream\n`);
    pushBytes(drawBytes);
    pushStr('\nendstream\nendobj\n');

    offsets[imgId] = byteLength;
    pushStr(
      `${imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
    );
    pushBytes(jpeg);
    pushStr('\nendstream\nendobj\n');
  }

  const totalObjects = 2 + pageCount * 3;
  const xrefOffset = byteLength;
  pushStr(`xref\n0 ${totalObjects + 1}\n`);
  pushStr('0000000000 65535 f \n');
  for (let id = 1; id <= totalObjects; id++) {
    const off = String(offsets[id] || 0).padStart(10, '0');
    pushStr(`${off} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const blobParts: ArrayBuffer[] = chunks.map((u8) => {
    const copy = new Uint8Array(u8.length);
    copy.set(u8);
    return copy.buffer;
  });
  return new Blob(blobParts, { type: 'application/pdf' });
}

export async function exportVietnamesePdfReport(options: PdfReportOptions): Promise<void> {
  if (typeof document === 'undefined') return;
  if ('fonts' in document && document.fonts?.ready) {
    await document.fonts.ready.catch(() => {});
  }

  const pages: Array<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> = [];
  let page = createPageCanvas();
  pages.push(page);
  let y = TOP_Y;

  const drawFooter = (ctx: CanvasRenderingContext2D, pageNum: number) => {
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, PAGE_H - 64);
    ctx.lineTo(PAGE_W - MARGIN_X, PAGE_H - 64);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '500 20px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText('SOCRATES KIDS AI · Think. Explore. Learn. · Báo cáo tiếng Việt chuẩn Unicode', MARGIN_X, PAGE_H - 32);
    const pageTxt = `Trang ${pageNum}`;
    const txtW = ctx.measureText(pageTxt).width;
    ctx.fillText(pageTxt, PAGE_W - MARGIN_X - txtW, PAGE_H - 32);
  };

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > BOTTOM_Y) {
      drawFooter(page.ctx, pages.length);
      page = createPageCanvas();
      pages.push(page);
      y = TOP_Y;
    }
  };

  // Top Header Banner
  const { ctx } = page;
  ctx.fillStyle = '#0284C7';
  ctx.fillRect(MARGIN_X, y, CONTENT_W, 130);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 34px "Nunito", "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText(options.title, MARGIN_X + 32, y + 54);
  if (options.subtitle) {
    ctx.fillStyle = '#E0F2FE';
    ctx.font = '600 22px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText(options.subtitle, MARGIN_X + 32, y + 98);
  }
  y += 160;

  if (options.metaLines && options.metaLines.length > 0) {
    page.ctx.fillStyle = '#F8FAFC';
    const metaHeight = 24 + options.metaLines.length * 32;
    page.ctx.fillRect(MARGIN_X, y, CONTENT_W, metaHeight);
    page.ctx.strokeStyle = '#E2E8F0';
    page.ctx.lineWidth = 2;
    page.ctx.strokeRect(MARGIN_X, y, CONTENT_W, metaHeight);
    page.ctx.fillStyle = '#334155';
    page.ctx.font = '600 22px "Be Vietnam Pro", system-ui, sans-serif';
    options.metaLines.forEach((line, idx) => {
      page.ctx.fillText(line, MARGIN_X + 24, y + 36 + idx * 32);
    });
    y += metaHeight + 30;
  }

  for (const sec of options.sections || []) {
    ensureSpace(90);
    page.ctx.fillStyle = '#0F172A';
    page.ctx.font = '800 26px "Nunito", "Be Vietnam Pro", system-ui, sans-serif';
    page.ctx.fillText(sec.heading, MARGIN_X, y + 26);
    y += 40;

    page.ctx.font = '500 22px "Be Vietnam Pro", system-ui, sans-serif';
    for (const rawLine of sec.lines) {
      const wrapped = wrapText(page.ctx, rawLine, CONTENT_W - 24);
      for (const wl of wrapped) {
        ensureSpace(34);
        page.ctx.fillStyle = '#1E293B';
        page.ctx.fillText(wl, MARGIN_X + 12, y + 24);
        y += 32;
      }
      y += 4;
    }
    y += 18;
  }

  if (options.table && options.table.headers.length > 0) {
    const colCount = options.table.headers.length;
    const widths =
      options.table.columnWidths && options.table.columnWidths.length === colCount
        ? options.table.columnWidths
        : Array(colCount).fill(CONTENT_W / colCount);

    const drawTableHeader = () => {
      ensureSpace(64);
      page.ctx.fillStyle = '#0369A1';
      page.ctx.fillRect(MARGIN_X, y, CONTENT_W, 50);
      page.ctx.fillStyle = '#FFFFFF';
      page.ctx.font = '700 20px "Be Vietnam Pro", system-ui, sans-serif';
      let cx = MARGIN_X;
      options.table!.headers.forEach((h, i) => {
        page.ctx.fillText(h.slice(0, 28), cx + 12, y + 32);
        cx += widths[i];
      });
      y += 50;
    };

    drawTableHeader();
    page.ctx.font = '500 20px "Be Vietnam Pro", system-ui, sans-serif';
    options.table.rows.forEach((row, rIdx) => {
      const wrappedCells = row.map((cell, cIdx) => wrapText(page.ctx, cell || '-', widths[cIdx] - 20));
      const maxLines = Math.max(1, ...wrappedCells.map((l) => l.length));
      const rowH = Math.max(46, maxLines * 28 + 18);

      if (y + rowH > BOTTOM_Y) {
        drawFooter(page.ctx, pages.length);
        page = createPageCanvas();
        pages.push(page);
        y = TOP_Y;
        drawTableHeader();
        page.ctx.font = '500 20px "Be Vietnam Pro", system-ui, sans-serif';
      }

      page.ctx.fillStyle = rIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      page.ctx.fillRect(MARGIN_X, y, CONTENT_W, rowH);
      page.ctx.strokeStyle = '#E2E8F0';
      page.ctx.lineWidth = 1.5;
      page.ctx.strokeRect(MARGIN_X, y, CONTENT_W, rowH);

      page.ctx.fillStyle = '#0F172A';
      let cx = MARGIN_X;
      wrappedCells.forEach((cellLines, cIdx) => {
        cellLines.forEach((cl, lineIdx) => {
          page.ctx.fillText(cl, cx + 12, y + 30 + lineIdx * 28);
        });
        cx += widths[cIdx];
      });
      y += rowH;
    });
  }

  drawFooter(page.ctx, pages.length);

  const jpegPages = pages.map((p) => ({
    jpeg: dataUrlToUint8Array(p.canvas.toDataURL('image/jpeg', 0.92)),
    width: p.canvas.width,
    height: p.canvas.height,
  }));

  const pdfBlob = buildPdfBlobFromJpegs(jpegPages);
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options.filename.endsWith('.pdf') ? options.filename : `${options.filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
