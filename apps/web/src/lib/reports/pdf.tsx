/* eslint-disable jsx-a11y/alt-text -- react-pdf Image is a document primitive. */
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Path,
  Font,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import { SNAG_PRIORITIES, SNAG_STATUSES, reportPhotoDimensions } from '@snagflow/shared';
import { reportDate, type ReportData, type ReportSnag, type ReportPhoto } from './data';
import { Fragment } from 'react';
import { BRAND } from '../brand';
// Accepted notes and URLs may contain no spaces. Give the renderer bounded
// discretionary break points instead of letting a single token cross the page.
Font.registerHyphenationCallback((word) => word.match(/.{1,16}/gu) ?? [word]);
const styles = StyleSheet.create({
  page: {
    padding: 36,
    paddingBottom: 48,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#172b35',
    lineHeight: 1.4,
  },
  title: { fontSize: 27, lineHeight: 1.3, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  subtitle: { fontSize: 16, lineHeight: 1.3, marginBottom: 12 },
  muted: { color: '#586b73', fontSize: 9, lineHeight: 1.35 },
  group: {
    fontSize: 14,
    lineHeight: 1.3,
    fontFamily: 'Helvetica-Bold',
    marginTop: 16,
    marginBottom: 8,
  },
  block: {
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#dce3e5',
    paddingBottom: 12,
    marginBottom: 12,
  },
  heading: { fontFamily: 'Helvetica-Bold', fontSize: 12, lineHeight: 1.3, marginBottom: 5 },
  row: { flexDirection: 'row', gap: 12, flexShrink: 0 },
  meta: { fontSize: 9, lineHeight: 1.35, color: '#40555e', marginBottom: 5 },
  classicTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 15,
    lineHeight: 1.3,
    marginBottom: 10,
    color: '#172b35',
  },
  classicDescription: {
    fontSize: 10,
    lineHeight: 1.45,
    color: '#2b3f46',
    marginBottom: 10,
  },
  classicCard: {
    borderWidth: 1,
    borderColor: '#dfe7ea',
    backgroundColor: '#f9fbfb',
    padding: 10,
    marginBottom: 14,
    borderRadius: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 36,
    right: 36,
    height: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 8,
    lineHeight: 1,
    color: '#586b73',
  },
  label: { fontFamily: 'Helvetica-Bold', fontSize: 9, lineHeight: 1.35, marginTop: 8 },
  summary: { padding: 12, backgroundColor: '#eef3f3', marginTop: 12 },
});
const imageSource = (buffer: Buffer) => ({ data: buffer, format: 'jpg' as const });
function Footer({ data }: { data: ReportData }) {
  return (
    <View fixed style={styles.footer}>
      <Text>
        {data.org.company_name} · {data.project.code}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <Svg viewBox={BRAND.viewBox} width={16} height={14}>
          <Path d={BRAND.body} fill={BRAND.green} />
          <Path d={BRAND.check} fill={BRAND.orange} />
        </Svg>
        <Text style={{ color: BRAND.green, fontFamily: 'Helvetica-Bold' }}>SnagFlow</Text>
      </View>
    </View>
  );
}
function SnagSummary({ snag, data }: { snag: ReportSnag; data: ReportData }) {
  return (
    <>
      <Text style={styles.heading} minPresenceAhead={35}>
        #{snag.number} · {snag.title}
      </Text>
      <Text style={styles.meta}>
        {snag.status.replaceAll('_', ' ')} · {snag.priority} priority · {snag.assignee}
      </Text>
      <Text style={styles.meta}>
        {snag.location} · {snag.category} · Due: {reportDate(snag.due_date, data)}
      </Text>
      <Text style={styles.muted}>
        Raised by {snag.creator}
        {snag.closedBy ? ` · Closed by ${snag.closedBy}` : ''} · Rejections: {snag.rejection_count}
      </Text>
      {data.request.options.timestamps ? (
        <Text style={styles.muted}>
          Created {reportDate(snag.created_at, data, true)} · Updated{' '}
          {reportDate(snag.updated_at, data, true)}
          {snag.closed_at ? ` · Closed ${reportDate(snag.closed_at, data, true)}` : ''}
        </Text>
      ) : null}
    </>
  );
}
function Narrative({ snag, data }: { snag: ReportSnag; data: ReportData }) {
  return (
    <View style={{ marginTop: 6, flexShrink: 0 }}>
      {snag.description ? <Text>{snag.description}</Text> : null}
      {data.request.options.comments
        ? snag.comments.map((comment) => (
            <View key={comment.id}>
              <Text style={styles.label} minPresenceAhead={20}>
                {comment.author}
                {data.request.options.timestamps
                  ? ` · ${reportDate(comment.created_at, data, true)}`
                  : ''}
              </Text>
              <Text>{comment.body}</Text>
            </View>
          ))
        : null}
    </View>
  );
}
function Evidence({ photo, data }: { photo: ReportPhoto; data: ReportData }) {
  const [width, height] = reportPhotoDimensions(data.request.theme, data.request.options.photoSize);
  return photo.image ? (
    <View
      wrap={false}
      style={{ width, minHeight: height + 38, marginTop: 8, marginBottom: 4, flexShrink: 0 }}
    >
      <Image
        src={imageSource(photo.image)}
        style={{
          width,
          height,
          minHeight: height,
          minWidth: width,
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />
      <Text style={{ ...styles.muted, marginTop: 4 }}>
        {photo.kind === 'fix' ? 'Fix photo' : 'Issue photo'}
        {data.request.options.annotated && photo.annotated_path ? ' · annotated' : ''}
        {data.request.options.timestamps ? ` · ${reportDate(photo.taken_at, data, true)}` : ''}
      </Text>
    </View>
  ) : null;
}
function getClassicPhotoColumns(photoCount: number, photoSize: string) {
  const maxColumns = photoSize === 'small' ? 5 : photoSize === 'large' ? 3 : 4;
  return Math.min(photoCount, maxColumns);
}
function ClassicSnag({ snag, data }: { snag: ReportSnag; data: ReportData }) {
  const options = data.request.options;
  const photos = (snag.photos ?? []).filter((photo) => photo && photo.image && options.photoSize !== 'one_per_page');
  const columns = getClassicPhotoColumns(photos.length, options.photoSize);
  const [photoWidth, photoHeight] = reportPhotoDimensions(data.request.theme, options.photoSize);
  const photoRows = Array.from({ length: Math.ceil(photos.length / columns) }, (_, row) =>
    photos.slice(row * columns, (row + 1) * columns),
  );
  const longDescription = (snag.description?.length ?? 0) > 1000;
  const detailLines = [
    `${snag.status.replaceAll('_', ' ')} · ${snag.priority} priority · ${snag.assignee}`,
    `${snag.location} · ${snag.category} · Due: ${reportDate(snag.due_date, data)}`,
  ];
  return (
    <View style={{ ...styles.classicCard, marginBottom: 14 }}>
      <View wrap={longDescription}>
        <Text style={styles.classicTitle} minPresenceAhead={100}>
          #{snag.number} · {snag.title}
        </Text>
        {snag.description ? <Text style={styles.classicDescription}>{snag.description}</Text> : null}
        {detailLines.map((line, index) => (
          <Text key={`${snag.id}-detail-${index}`} style={styles.meta}>
            {line}
          </Text>
        ))}
        <Text style={styles.muted}>
          Raised by {snag.creator}
          {snag.closedBy ? ` · Closed by ${snag.closedBy}` : ''} · Rejections: {snag.rejection_count}
        </Text>
        {options.timestamps ? (
          <Text style={styles.muted}>
            Created {reportDate(snag.created_at, data, true)} · Updated{' '}
            {reportDate(snag.updated_at, data, true)}
            {snag.closed_at ? ` · Closed ${reportDate(snag.closed_at, data, true)}` : ''}
          </Text>
        ) : null}
      </View>
      {options.comments
        ? snag.comments.map((comment) => (
            <View key={comment.id} style={{ marginTop: 8 }}>
              <Text style={styles.label} minPresenceAhead={20}>
                {comment.author}
                {options.timestamps ? ` · ${reportDate(comment.created_at, data, true)}` : ''}
              </Text>
              <Text>{comment.body}</Text>
            </View>
          ))
        : null}
      {photoRows.map((row, rowIndex) => (
        <View
          key={`${snag.id}-photos-${rowIndex}`}
          wrap={false}
          style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}
        >
          {row.map((photo) => (
            <View key={photo.id} style={{ width: photoWidth, flexShrink: 0 }}>
              <Image
                src={imageSource(photo.image!)}
                style={{
                  width: '100%',
                  height: photoHeight,
                  objectFit: 'contain',
                  backgroundColor: '#eef3f3',
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: '#dfe7ea',
                }}
              />
              <Text style={{ ...styles.muted, marginTop: 3 }}>
                {photo.kind === 'fix' ? 'Fix photo' : 'Issue photo'}
                {options.timestamps ? ` · ${reportDate(photo.taken_at, data, true)}` : ''}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
export async function renderReportPdf(data: ReportData) {
  const options = data.request.options;
  const compact = data.request.theme === 'compact';
  const classic = data.request.theme === 'classic';
  let previousGroup = '';
  return renderToBuffer(
    <Document
      title={`${data.title} — ${data.project.name}`}
      author={data.preparedBy}
      subject={data.org.company_name}
    >
      {options.cover ? (
        <Page size="A4" orientation="portrait" style={styles.page}>
          {data.logo ? (
            <Image
              src={{ data: data.logo, format: 'png' }}
              style={{ width: 160, height: 65, objectFit: 'contain', marginBottom: 20 }}
            />
          ) : null}
          <Text style={styles.muted}>{data.org.company_name}</Text>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.subtitle}>
            {data.project.name} · {data.project.code}
          </Text>
          <Text>Client: {data.project.client_name || '—'}</Text>
          <Text>Address: {data.project.address || '—'}</Text>
          <Text>Date: {reportDate(data.generatedAt, data)}</Text>
          <Text>Prepared by: {data.preparedBy}</Text>
          <View style={styles.summary}>
            <Text style={styles.heading}>{data.snags.length} items in this report</Text>
            {SNAG_STATUSES.map((status) => (
              <Text key={status}>
                {status.replaceAll('_', ' ')}:{' '}
                {data.snags.filter((snag) => snag.status === status).length}
              </Text>
            ))}
            <Text style={styles.label}>Priority summary</Text>
            {SNAG_PRIORITIES.map((priority) => (
              <Text key={priority}>
                {priority}: {data.snags.filter((snag) => snag.priority === priority).length}
              </Text>
            ))}
          </View>
          <View style={{ marginTop: 48 }}>
            <Text>Prepared signature: __________________________________</Text>
            <Text style={{ marginTop: 24 }}>
              Reviewed signature: __________________________________
            </Text>
          </View>
          <Footer data={data} />
        </Page>
      ) : null}
      <Page
        size="A4"
        orientation={classic ? 'landscape' : 'portrait'}
        style={{ ...styles.page, fontSize: compact ? 8 : 10 }}
      >
        <Text style={styles.subtitle}>
          {data.title} · {data.project.code}
        </Text>
        {!data.snags.length ? <Text>No items match the selected filters.</Text> : null}
        {classic ? <Text style={styles.group}>Inspection items</Text> : null}
        {data.snags.map((snag) => {
          const newGroup = previousGroup !== snag.group;
          previousGroup = snag.group;
          if (classic) {
            return (
              <Fragment key={snag.id}>
                {newGroup ? (
                  <Text style={styles.group} minPresenceAhead={180}>
                    {snag.group}
                  </Text>
                ) : null}
                <ClassicSnag snag={snag} data={data} />
              </Fragment>
            );
          }
          // A bounded summary/thumbnail row stays together. Long narratives and full
          // comment threads flow as normal text; additional images keep their captions.
          const rowFits =
            snag.title.length +
              snag.location.length +
              snag.category.length +
              snag.assignee.length +
              snag.creator.length <
            1000;
          const thumbnail =
            classic && rowFits && options.photoSize !== 'one_per_page' ? snag.photos[0] : undefined;
          const remaining = thumbnail ? snag.photos.slice(1) : snag.photos;
          return (
            <Fragment key={snag.id}>
              {newGroup ? (
                <Text style={styles.group} minPresenceAhead={classic ? 220 : 120}>
                  {snag.group}
                </Text>
              ) : null}
              {classic && rowFits ? (
                <View
                  wrap={false}
                  style={{
                    ...styles.row,
                    minHeight: thumbnail
                      ? reportPhotoDimensions(data.request.theme, options.photoSize)[1] + 66
                      : 110,
                    borderLeftWidth: classic ? 1 : 0,
                    borderRightWidth: classic ? 1 : 0,
                    borderColor: '#dce3e5',
                    padding: classic ? 8 : 0,
                  }}
                >
                  <View style={{ flex: 1, flexShrink: 0 }}>
                    <SnagSummary snag={snag} data={data} />
                  </View>
                  {thumbnail ? <Evidence photo={thumbnail} data={data} /> : null}
                </View>
              ) : (
                <SnagSummary snag={snag} data={data} />
              )}
              <Narrative snag={snag} data={data} />
              {options.photoSize !== 'one_per_page'
                ? remaining.map((photo) => <Evidence key={photo.id} photo={photo} data={data} />)
                : null}
              <View
                style={{
                  ...styles.block,
                  paddingBottom: compact ? 6 : 12,
                  marginBottom: compact ? 6 : 12,
                }}
              />
            </Fragment>
          );
        })}
        <Footer data={data} />
      </Page>
      {options.photoSize === 'one_per_page'
        ? data.snags.flatMap((snag) =>
            snag.photos.map((photo) =>
              photo.image ? (
                <Page
                  key={photo.id}
                  size="A4"
                  orientation={classic ? 'landscape' : 'portrait'}
                  style={styles.page}
                >
                  <Text style={styles.heading}>
                    #{snag.number} · {snag.title}
                  </Text>
                  <Text style={styles.meta}>
                    {snag.group} · {photo.kind} photo
                    {options.annotated && photo.annotated_path ? ' · annotated' : ''}
                  </Text>
                  {options.timestamps ? (
                    <Text style={styles.meta}>{reportDate(photo.taken_at, data, true)}</Text>
                  ) : null}
                  <Image
                    src={imageSource(photo.image)}
                    style={{ width: 520, height: 630, objectFit: 'contain' }}
                  />
                  <Footer data={data} />
                </Page>
              ) : null,
            ),
          )
        : null}
    </Document>,
  );
}
