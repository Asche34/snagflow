import { getSharp } from 'next/dist/server/image-optimizer/transform';
import { checkDeadline, type ReportData } from './data';
import { ReportError, type ReportClient } from './auth';

export async function loadReportImages(client: ReportClient, data: ReportData, deadline: number) {
  if (
    !data.snags.some((snag) => snag.photos.length) &&
    !(data.request.options.cover && data.org.logo_path)
  )
    return;
  // Next's installed sharp helper shares its traced native dependency; no new package is needed.
  const sharp = getSharp(2, false);
  let total = 0;
  const maxWidth =
    data.request.options.photoSize === 'small'
      ? 400
      : data.request.options.photoSize === 'medium'
        ? 800
        : 1400;
  const photos = data.snags.flatMap((snag) => snag.photos);
  for (let offset = 0; offset < photos.length; offset += 4) {
    checkDeadline(deadline);
    await Promise.all(
      photos.slice(offset, offset + 4).map(async (photo) => {
        const path =
          data.request.options.annotated && photo.annotated_path
            ? photo.annotated_path
            : photo.storage_path;
        if (!path.startsWith(`${data.project.id}/${photo.snag_id}/`) || path.includes('..'))
          throw new ReportError(
            'A photo has an invalid storage reference. Contact your administrator.',
            422,
          );
        const downloaded = await client.storage.from('snag-photos').download(path);
        if (downloaded.error || !downloaded.data)
          throw new ReportError(
            'A report photo could not be read. Retry or turn off photos; no partial report was saved.',
            503,
          );
        try {
          photo.image = await sharp(Buffer.from(await downloaded.data.arrayBuffer()), {
            limitInputPixels: 40_000_000,
          })
            .rotate()
            .resize({ width: maxWidth, height: maxWidth, fit: 'inside', withoutEnlargement: true })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 72 })
            .toBuffer();
        } catch {
          throw new ReportError(
            'A report photo could not be decoded. Replace the damaged photo or turn off photos.',
            422,
          );
        }
        total += photo.image.byteLength;
        if (total > 100 * 1024 * 1024)
          throw new ReportError(
            'The report contains too many photos. Narrow the filters or choose smaller photos.',
            422,
          );
      }),
    );
  }
  if (data.request.options.cover && data.org.logo_path) {
    if (data.org.logo_path.includes('..') || /^https?:/i.test(data.org.logo_path))
      throw new ReportError('The company logo must be stored in the branding bucket.', 422);
    const downloaded = await client.storage.from('branding').download(data.org.logo_path);
    if (downloaded.error || !downloaded.data)
      throw new ReportError(
        'The company logo could not be read. Retry or turn off the cover page.',
        503,
      );
    try {
      data.logo = await sharp(Buffer.from(await downloaded.data.arrayBuffer()), {
        limitInputPixels: 4_000_000,
      })
        .resize({ width: 500, height: 200, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
    } catch {
      throw new ReportError(
        'The company logo could not be decoded. Update the logo or turn off the cover page.',
        422,
      );
    }
  }
}
