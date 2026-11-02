import ExcelJS from 'exceljs';
import { SNAG_PRIORITIES, SNAG_STATUSES } from '@snagflow/shared';
import { reportDate, type ReportData } from './data';
export async function renderReportExcel(data: ReportData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = data.preparedBy;
  workbook.company = data.org.company_name;
  workbook.created = new Date(data.generatedAt);
  const summary = workbook.addWorksheet('Summary');
  summary.columns = [{ width: 30 }, { width: 65 }];
  summary.addRows([
    [data.org.company_name, data.title],
    ['Project', data.project.name],
    ['Code', data.project.code],
    ['Client', data.project.client_name],
    ['Address', data.project.address],
    ['Prepared by', data.preparedBy],
    ['Date', reportDate(data.generatedAt, data)],
    ['Total', data.snags.length],
    [],
    ['Status', 'Count'],
    ...SNAG_STATUSES.map((status) => [
      status,
      data.snags.filter((snag) => snag.status === status).length,
    ]),
    [],
    ['Priority', 'Count'],
    ...SNAG_PRIORITIES.map((priority) => [
      priority,
      data.snags.filter((snag) => snag.priority === priority).length,
    ]),
    [],
    ['Filters', JSON.stringify(data.request.filters)],
    ['Options', JSON.stringify(data.request.options)],
    ['Theme', data.request.theme],
  ]);
  const sheet = workbook.addWorksheet('Items', { views: [{ state: 'frozen', ySplit: 1 }] });
  const fields = [
    'id',
    'client_id',
    'project_id',
    'number',
    'title',
    'description',
    'status',
    'priority',
    'location_id',
    'location',
    'category_id',
    'category',
    'assignee_id',
    'assignee',
    'created_by',
    'creator',
    'closed_by',
    'closedBy',
    'due_date',
    'rejection_count',
    'pin_x',
    'pin_y',
    ...(data.request.options.timestamps
      ? ['created_at', 'updated_at', 'closed_at', 'deleted_at']
      : []),
    'group',
    ...(data.request.options.comments ? ['comments'] : []),
    'link',
  ];
  sheet.columns = fields.map((key) => ({
    header: key.replaceAll('_', ' '),
    key,
    width: ['title', 'description', 'comments', 'link'].includes(key) ? 55 : 23,
  }));
  for (const snag of data.snags) {
    const row: Record<string, unknown> = {
      ...snag,
      comments: snag.comments.length ? `${snag.comments.length} comments — see Comments sheet` : '',
      link: { text: `Open #${snag.number}`, hyperlink: `${data.origin}/snags/${snag.id}` },
    };
    row.due_date = snag.due_date ? reportDate(snag.due_date, data) : '';
    for (const field of ['created_at', 'updated_at', 'closed_at', 'deleted_at'] as const)
      row[field] = snag[field] ? reportDate(snag[field], data, true) : '';
    sheet.addRow(row);
  }
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: fields.length },
  };
  if (data.request.options.comments) {
    const comments = workbook.addWorksheet('Comments', { views: [{ state: 'frozen', ySplit: 1 }] });
    comments.columns = [
      { header: 'Item', key: 'item', width: 15 },
      { header: 'Comment ID', key: 'id', width: 38 },
      { header: 'Author', key: 'author', width: 25 },
      ...(data.request.options.timestamps
        ? [{ header: 'Created at', key: 'createdAt', width: 25 }]
        : []),
      { header: 'Comment', key: 'body', width: 100 },
    ];
    for (const snag of data.snags)
      for (const comment of snag.comments)
        comments.addRow({
          item: `#${snag.number}`,
          id: comment.id,
          author: comment.author,
          createdAt: reportDate(comment.created_at, data, true),
          body: comment.body,
        });
  }
  if (data.request.options.photos) {
    const photos = workbook.addWorksheet('Photos');
    photos.columns = [
      { header: 'Item', width: 18 },
      { header: 'Kind', width: 16 },
      { header: 'Image', width: 65 },
      { header: 'Taken at', width: 25 },
      { header: 'Variant', width: 20 },
    ];
    for (const snag of data.snags)
      for (const photo of snag.photos) {
        const row = photos.addRow([
          `#${snag.number}`,
          photo.kind,
          '',
          data.request.options.timestamps ? reportDate(photo.taken_at, data, true) : '',
          data.request.options.annotated && photo.annotated_path ? 'Annotated' : 'Original',
        ]);
        if (photo.image) {
          const width =
            data.request.options.photoSize === 'small'
              ? 150
              : data.request.options.photoSize === 'medium'
                ? 300
                : 450;
          const height = Math.min(330, (width * photo.height) / photo.width);
          row.height = height * 0.75 + 12;
          const image = workbook.addImage({
            base64: photo.image.toString('base64'),
            extension: 'jpeg',
          });
          photos.addImage(image, { tl: { col: 2, row: row.number - 1 }, ext: { width, height } });
        }
      }
  }
  if (data.logo) {
    const id = workbook.addImage({ base64: data.logo.toString('base64'), extension: 'png' });
    summary.addImage(id, { tl: { col: 3, row: 0 }, ext: { width: 180, height: 75 } });
  }
  for (const worksheet of workbook.worksheets) {
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF214C57' } };
    worksheet.eachRow((row, index) => {
      row.alignment = { vertical: 'top', wrapText: true };
      if (index > 1 && index % 2 === 0)
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F5F5' } };
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
