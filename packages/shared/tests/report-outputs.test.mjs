import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderReportPdf } from '../../../apps/web/src/lib/reports/pdf';
import { renderReportExcel } from '../../../apps/web/src/lib/reports/excel';
import { ReportRequestSchema, reportPhotoDimensions } from '../src/reports';
const image = Buffer.from(
  '/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAJABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJ4ARAP/2Q==',
  'base64',
);
const uuid = '70000000-0000-4000-8000-000000000001';
function fixture() {
  const time = '2026-11-02T09:00:00Z';
  return {
    project: {
      id: uuid,
      name: 'Geometry inspection',
      code: 'GEO',
      client_name: 'Test client',
      address: 'Test address',
      description: null,
      status: 'active',
      created_by: uuid,
      created_at: time,
      updated_at: time,
      require_fix_photo: false,
    },
    org: {
      id: 1,
      company_name: 'Test company',
      logo_path: null,
      terminology: 'snag',
      date_format: 'yyyy-MM-dd',
      default_report_theme: 'classic',
      created_at: time,
      updated_at: time,
    },
    preparedBy: 'Test manager',
    title: 'Snag Report',
    generatedAt: time,
    origin: 'https://example.test',
    request: ReportRequestSchema.parse({
      requestId: uuid,
      projectId: uuid,
      format: 'pdf',
      options: { cover: false, comments: true },
    }),
    snags: [
      {
        id: uuid,
        client_id: uuid,
        project_id: uuid,
        number: 1,
        title: 'Geometry evidence',
        description: 'Inspection description',
        status: 'open',
        priority: 'high',
        location_id: null,
        category_id: null,
        assignee_id: null,
        created_by: uuid,
        closed_by: null,
        closed_at: null,
        deleted_at: null,
        due_date: null,
        created_at: time,
        updated_at: time,
        pin_x: null,
        pin_y: null,
        rejection_count: 0,
        search_document: null,
        location: 'No location',
        category: 'No category',
        assignee: 'Unassigned',
        creator: 'Test manager',
        closedBy: '',
        group: 'No location',
        comments: [],
        photos: [
          {
            id: uuid,
            snag_id: uuid,
            storage_path: `${uuid}/${uuid}/${uuid}.jpg`,
            annotated_path: null,
            annotation_json: null,
            thumb_path: null,
            width: 16,
            height: 9,
            kind: 'issue',
            sort_order: 0,
            taken_at: time,
            created_at: time,
            updated_at: time,
            uploaded_by: uuid,
            image,
          },
        ],
      },
    ],
  };
}
function contentStreams(pdf) {
  const raw = pdf.toString('latin1');
  const streams = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      streams.push(inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'));
    } catch {
      /* JPEG streams are not Flate streams. */
    }
  }
  return streams.join('\n%%PAGEBREAK%%\n');
}
function textPositions(pdf, includeImages = false) {
  const multiply = (a, b) => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  let ctm = [1, 0, 0, 1, 0, 0],
    tm = [1, 0, 0, 1, 0, 0],
    font = 10,
    page = 0;
  const stack = [];
  const result = [];
  for (const line of contentStreams(pdf).split('\n')) {
    if (line === '%%PAGEBREAK%%') {
      page++;
      ctm = [1, 0, 0, 1, 0, 0];
      tm = [1, 0, 0, 1, 0, 0];
      stack.length = 0;
    } else if (line === 'q') stack.push([...ctm]);
    else if (line === 'Q') ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (line.endsWith(' cm')) ctm = multiply(ctm, line.slice(0, -3).split(' ').map(Number));
    else if (line.endsWith(' Tm')) tm = line.slice(0, -3).split(' ').map(Number);
    else if (/\/F\d+ [\d.]+ Tf/.test(line)) font = Number(line.split(' ')[1]);
    else if (includeImages && /^\/I\d+ Do$/.test(line)) {
      const xs = [ctm[4], ctm[0] + ctm[4], ctm[2] + ctm[4], ctm[0] + ctm[2] + ctm[4]];
      const ys = [ctm[5], ctm[1] + ctm[5], ctm[3] + ctm[5], ctm[1] + ctm[3] + ctm[5]];
      result.push({
        page,
        text: '[image]',
        x: Math.min(...xs),
        y: 841.89 - Math.max(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      });
    } else if (line.endsWith(' TJ')) {
      const text = [...line.matchAll(/<([0-9a-f]+)>/gi)]
        .map((match) => Buffer.from(match[1], 'hex').toString('latin1'))
        .join('');
      const matrix = multiply(ctm, tm);
      if (text.trim()) result.push({ text, x: matrix[4], y: 841.89 - matrix[5], font, page });
    }
  }
  return result;
}
describe('actual report output', () => {
  it('keeps text inside page bounds and gives each theme natural metadata height', async () => {
    for (const theme of ['classic', 'compact', 'photo_first']) {
      const data = fixture();
      data.request.theme = theme;
      data.request.options.cover = true;
      const positions = textPositions(await renderReportPdf(data));
      expect(
        positions.filter((text) => text.y < 0 || text.y > 841.89),
        `${theme} off-page text`,
      ).toEqual([]);
      const heading = positions.find((text) => text.text.includes('Geometry evidence'));
      const description = positions.find((text) => text.text.includes('Inspection description'));
      expect(description.y - heading.y, `${theme} metadata line separation`).toBeGreaterThan(24);
      const title = positions.find((text) => text.text === 'Snag Report');
      const subtitle = positions.find((text) => text.text.includes('Geometry inspection'));
      expect(subtitle.y - title.y, `${theme} cover title separation`).toBeGreaterThan(20);
    }
  });
  it('keeps a hundred photo records and long narratives inside every theme page', async () => {
    const output = new URL('../../../.superpowers/phase4/render-geometry/', import.meta.url);
    mkdirSync(output, { recursive: true });
    for (const theme of ['classic', 'compact', 'photo_first']) {
      const data = fixture();
      const original = data.snags[0];
      data.request.options.cover = true;
      data.request.theme = theme;
      data.snags = Array.from({ length: 100 }, (_, index) => ({
        ...original,
        id: crypto.randomUUID(),
        number: index + 1,
        title: `Inspection item ${index + 1}`,
        description:
          index === 99
            ? 'Long description detail. '.repeat(220).slice(0, 5000)
            : original.description,
        photos: original.photos.map((photo) => ({ ...photo, id: crypto.randomUUID() })),
        comments:
          index === 0
            ? Array.from({ length: 7 }, (_, i) => ({
                id: crypto.randomUUID(),
                snag_id: uuid,
                author_id: uuid,
                author: 'Test manager',
                created_at: data.generatedAt,
                body: `Long comment ${i + 1}: `.padEnd(5000, 'x'),
              }))
            : [],
      }));
      const pdf = await renderReportPdf(data);
      writeFileSync(new URL(`${theme}-100.pdf`, output), pdf);
      expect(pdf.byteLength).toBeGreaterThan(20000);
      const positions = textPositions(pdf, true);
      expect(
        positions.some((entry) => /x{180}/.test(entry.text)),
        `${theme} unbroken-token wrapping`,
      ).toBe(false);
      expect(
        positions.filter(
          (entry) =>
            entry.y < -0.1 ||
            entry.y + (entry.height ?? 0) > 841.99 ||
            entry.x < -0.1 ||
            entry.x + (entry.width ?? 0) > 595.4,
        ),
        `${theme} text/image bounds`,
      ).toEqual([]);
      if (theme === 'classic') {
        const headings = positions.filter((entry) => entry.text.includes('Inspection item'));
        expect(headings).toHaveLength(100);
        for (let i = 0; i < headings.length; i++) {
          const start = positions.indexOf(headings[i]);
          const end =
            i + 1 < headings.length ? positions.indexOf(headings[i + 1]) : positions.length;
          const row = positions.slice(start, end);
          const status = row.find((entry) => entry.text === 'open');
          const creator = row.find((entry) => entry.text.startsWith('Raised by'));
          const created = row.find((entry) => entry.text.startsWith('Created'));
          expect(status?.page).toBe(headings[i].page);
          expect(creator?.page).toBe(headings[i].page);
          expect(created?.page).toBe(headings[i].page);
          expect(status.y - headings[i].y).toBeGreaterThan(9);
          expect(created.y - creator.y).toBeGreaterThan(9);
        }
      }
      expect(positions.filter((entry) => entry.text === '[image]')).toHaveLength(100);
      const expectedWidth = reportPhotoDimensions(theme, 'medium')[0];
      expect(
        positions.filter(
          (entry) => entry.text === '[image]' && Math.abs(entry.width - expectedWidth) > 0.1,
        ),
        `${theme} squeezed evidence`,
      ).toEqual([]);
    }
  }, 20000);
  it('places PDF evidence at distinct physical sizes in every theme', async () => {
    const output = new URL('../../../.superpowers/phase4/render-geometry/', import.meta.url);
    mkdirSync(output, { recursive: true });
    for (const theme of ['classic', 'compact', 'photo_first'])
      for (const size of ['small', 'medium', 'large']) {
        const data = fixture();
        data.request.theme = theme;
        data.request.options.photoSize = size;
        const pdf = await renderReportPdf(data);
        writeFileSync(new URL(`${theme}-${size}.pdf`, output), pdf);
        const geometry = [
          ...contentStreams(pdf).matchAll(
            /([\d.]+) 0 0 (-?[\d.]+) [-\d.]+ [-\d.]+ cm\s*\/I\d+ Do/g,
          ),
        ];
        expect(geometry, `${theme}/${size} image drawing operator`).toHaveLength(1);
        expect(Number(geometry[0][1])).toBeCloseTo(reportPhotoDimensions(theme, size)[0]);
      }
  });
  it('preserves seven maximum-length comments in separate Excel cells', async () => {
    const data = fixture();
    data.request.format = 'xlsx';
    data.snags[0].comments = Array.from({ length: 7 }, (_, index) => ({
      id: crypto.randomUUID(),
      snag_id: uuid,
      author_id: uuid,
      author: 'Test manager',
      created_at: data.generatedAt,
      body: `Comment ${index + 1}: `.padEnd(5000, 'x'),
    }));
    const bytes = await renderReportExcel(data);
    const ExcelJS = await import('../../../apps/web/node_modules/exceljs');
    const workbook = new ExcelJS.default.Workbook();
    await workbook.xlsx.load(bytes);
    const comments = workbook.getWorksheet('Comments');
    expect(comments.rowCount).toBe(8);
    for (let index = 0; index < 7; index++)
      expect(comments.getRow(index + 2).getCell(5).value).toBe(data.snags[0].comments[index].body);
    for (const worksheet of workbook.worksheets)
      worksheet.eachRow((row) =>
        row.eachCell((cell) => {
          if (typeof cell.value === 'string') expect(cell.value.length).toBeLessThanOrEqual(32767);
        }),
      );
  });
});
