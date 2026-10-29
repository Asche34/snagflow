// Local UI-test transport only. This is NOT Supabase or an authorization test.
// Production app routes/loaders are unchanged; dedicated test config supplies this URL.
import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import console from 'node:console';

const A = '10101010-1010-4101-8101-101010101010';
const B = '20202020-2020-4202-8202-202020202020';
const ids = {
  admin: '11111111-1111-4111-8111-111111111111',
  manager: '22222222-2222-4222-8222-222222222222',
  member1: '33333333-3333-4333-8333-333333333333',
  viewer: '55555555-5555-4555-8555-555555555555',
};
const names = {
  admin: 'Alex Administrator',
  manager: 'Morgan Manager',
  member1: 'Alex Engineer',
  viewer: 'Vera Viewer',
};
const profiles = Object.entries(ids).map(([role, id]) => ({
  id,
  email: `${role}@snagflow.test`,
  full_name: names[role],
  is_admin: role === 'admin',
  is_active: true,
  avatar_url: null,
}));
const projects = [
  {
    id: A,
    name: 'Riverside Health Hub',
    code: 'RHH-01',
    client_name: 'Riverside Estates',
    address: 'Building A · Handover phase',
    description: 'Clinical spaces and public areas',
    status: 'active',
  },
  {
    id: B,
    name: 'Westgate Plant Room — Mechanical and Electrical Services Handover',
    code: 'WPR-02',
    client_name: 'Westgate',
    address: 'Plant Room',
    status: 'active',
  },
].map((p) => ({
  ...p,
  created_by: ids.admin,
  snag_counter: 24,
  require_fix_photo: true,
  created_at: '2026-10-20T10:00:00Z',
  updated_at: '2026-10-29T09:00:00Z',
}));
const members = [
  ...Object.entries(ids).map(([role, id]) => ({
    project_id: A,
    user_id: id,
    role:
      role === 'admin' || role === 'manager' ? 'manager' : role === 'viewer' ? 'viewer' : 'member',
  })),
  { project_id: B, user_id: ids.manager, role: 'member' },
  { project_id: B, user_id: ids.member1, role: 'member' },
];
const snag = (suffix, title, project_id, status, priority = 'medium') => ({
  id: `12010101-0101-4101-8101-00000000000${suffix}`,
  client_id: `12010101-0101-4101-8102-00000000000${suffix}`,
  project_id,
  number: Number(suffix),
  title,
  description: 'Check the installation against the approved detail before handover.',
  status,
  priority,
  assignee_id: ids.member1,
  created_by: ids.manager,
  due_date: '2026-10-28',
  created_at: '2026-10-20T10:00:00Z',
  updated_at: '2026-10-29T09:00:00Z',
  closed_at: status === 'closed' ? '2026-10-28T15:00:00Z' : null,
  closed_by: status === 'closed' ? ids.manager : null,
  rejection_count: 0,
  deleted_at: null,
  location_id: null,
  category_id: null,
  pin_x: null,
  pin_y: null,
});
const snags = [
  snag('1', 'Fire door closer needs adjustment', A, 'ready_for_review', 'high'),
  snag('2', 'Sealant missing around basin', A, 'in_progress'),
  snag(
    '3',
    'Check emergency lighting and fire-rated containment above the suspended ceiling before final handover',
    A,
    'open',
    'critical',
  ),
  snag('4', 'Mixed-role review item', B, 'ready_for_review'),
  snag('5', 'Touch up wall finish', A, 'closed', 'low'),
];

function identity(token) {
  try {
    return profiles.find(
      (p) => p.id === JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub,
    );
  } catch {
    return undefined;
  }
}
function user(profile) {
  return {
    id: profile.id,
    email: profile.email,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: profile.full_name },
    identities: [],
    created_at: '2026-10-20T10:00:00Z',
  };
}
function session(profile) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: profile.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 86400 })}.fixture-signature`;
  return {
    access_token: token,
    refresh_token: `fixture-${profile.id}`,
    token_type: 'bearer',
    expires_in: 86400,
    user: user(profile),
  };
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  res.setHeader('Content-Type', 'application/json');
  const send = (body, code = 200) => {
    res.statusCode = code;
    res.end(JSON.stringify(body));
  };
  const profile = identity((req.headers.authorization ?? '').replace(/^Bearer /i, ''));
  if (url.pathname === '/auth/v1/settings') return send({ external: { email: true } });
  if (url.pathname === '/auth/v1/token') {
    let body = '';
    for await (const part of req) body += part;
    const values = JSON.parse(body);
    const match = profiles.find((p) => p.email === values.email);
    if (!match || values.password !== 'Password123!')
      return send({ msg: 'Invalid login credentials' }, 400);
    return send(session(match));
  }
  if (url.pathname === '/auth/v1/user')
    return profile ? send(user(profile)) : send({ msg: 'No fixture session' }, 401);
  if (url.pathname === '/auth/v1/logout') return send({});
  if (!profile) return send({ message: 'Fixture session required' }, 401);
  const projectIds = profile.is_admin
    ? projects.map((p) => p.id)
    : members.filter((m) => m.user_id === profile.id).map((m) => m.project_id);
  const visibleSnags = snags.filter((s) => projectIds.includes(s.project_id));
  const tables = {
    profiles,
    projects: projects.filter((p) => projectIds.includes(p.id)),
    project_members: members.filter((m) => projectIds.includes(m.project_id)),
    snags: visibleSnags,
    org_settings: [{ id: 1, company_name: 'Fieldwork Construction' }],
    locations: [
      { id: 'a', project_id: A, parent_id: null, name: 'Building A', sort_order: 0 },
      { id: 'b', project_id: A, parent_id: 'a', name: 'Ground floor', sort_order: 1 },
    ],
    categories: [{ id: 'cat-a', project_id: A, name: 'Finishes' }],
    comments: [
      {
        id: 'comment-a',
        snag_id: snags[0].id,
        author_id: ids.member1,
        body: 'Adjustment complete. Please check the closing speed.',
        created_at: '2026-10-29T09:30:00Z',
      },
    ],
    activity_log: [
      {
        id: 'activity-a',
        project_id: A,
        snag_id: snags[0].id,
        actor_id: ids.member1,
        action: 'status_changed',
        created_at: '2026-10-29T09:30:00Z',
      },
    ],
    snag_photos: [],
  };
  const table = url.pathname.replace('/rest/v1/', '');
  if (!(table in tables) || req.method !== 'GET')
    return send({ message: 'Not implemented in UI fixture transport' }, 404);
  let rows = tables[table];
  for (const [key, value] of url.searchParams) {
    if (value.startsWith('eq.')) rows = rows.filter((row) => String(row[key]) === value.slice(3));
    if (value.startsWith('in.('))
      rows = rows.filter((row) => value.slice(4, -1).split(',').includes(String(row[key])));
  }
  const limit = Number(url.searchParams.get('limit'));
  if (limit > 0) rows = rows.slice(0, limit);
  return send(
    String(req.headers.accept).includes('application/vnd.pgrst.object') ? (rows[0] ?? null) : rows,
  );
});
server.listen(55440, '127.0.0.1', () =>
  console.log('UI fixture transport: http://127.0.0.1:55440 (not Supabase)'),
);
