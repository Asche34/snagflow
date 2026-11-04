// Local-only concurrency regression. No credentials or database reset required.
// node supabase/tests/offline-late-commit.mjs
// Optional: DOCKER_BIN / OFFLINE_DB_CONTAINER override the local Docker command.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import console from 'node:console';
import { setTimeout } from 'node:timers';

const docker = process.env.DOCKER_BIN ?? (process.platform === 'win32'
  ? 'C:/Program Files/Docker/Docker/resources/bin/docker.exe' : 'docker');
const container = process.env.OFFLINE_DB_CONTAINER ?? 'supabase_db_snagflow';
const base = ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'];
const project = '10101010-1010-4101-8101-101010101010';
const member = '33333333-3333-4333-8333-333333333333';
const snag = randomUUID();
function sql(query) {
  const result = spawnSync(docker, base, { input: query, encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message || 'Local psql failed');
  return result.stdout.trim();
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return;
    await delay(50);
  }
  throw new Error('Timed out waiting for the local transaction barrier.');
}
function processExit(child) {
  return new Promise((resolve, reject) => {
    let error = '';
    child.stderr.on('data', (chunk) => { error += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(error || `psql exited ${code}`)));
  });
}
const pull = (since = null) => JSON.parse(sql(`set request.jwt.claim.sub = '${member}';
  select public.mobile_sync_snapshot('${project}',${since ? `'${since}'::timestamptz` : 'null'});`));

let blocker;
let writer;
try {
  sql(`insert into public.snags(id,client_id,project_id,number,title,created_by)
    values('${snag}','${snag}','${project}',0,'Before late commit','${member}');`);
  // This session holds a barrier only the disposable writer uses. The app and
  // normal database traffic remain unblocked throughout the test.
  blocker = spawn(docker, base, { windowsHide: true });
  const blockerDone = processExit(blocker);
  let blockerOutput = '';
  blocker.stdout.on('data', (chunk) => { blockerOutput += chunk; });
  blocker.stdin.write("select pg_advisory_lock(684129710,7); select 'BARRIER_READY';\n");
  await until(() => blockerOutput.includes('BARRIER_READY'));
  writer = spawn(docker, base, { windowsHide: true });
  const writerDone = processExit(writer);
  writer.stdout.resume();
  writer.stdin.end(`begin;
    update public.snags set title='After late commit' where id='${snag}';
    select pg_advisory_xact_lock(684129710,7);
    commit;`);
  await until(() => sql("select exists(select 1 from pg_locks where locktype='advisory' and classid=684129710 and objid=7 and not granted);") === 't');
  const first = pull();
  assert.equal(first.snags.find((row) => row.id === snag)?.title, 'Before late commit');
  blocker.stdin.end('select pg_advisory_unlock(684129710,7);\n\\q\n');
  await Promise.all([writerDone, blockerDone]);
  const second = pull(first.synced_at);
  const row = second.snags.find((entry) => entry.id === snag);
  assert.ok(row, 'A transaction committed after pull must appear even when updated_at is older than its cursor.');
  assert.equal(row.title, 'After late commit');
  assert.ok(Date.parse(row.updated_at) < Date.parse(first.synced_at), 'The fixture must reproduce the pre-cursor transaction timestamp.');
  console.log('PASS: late-committed pre-cursor transaction reconciled without losing local data.');
} finally {
  blocker?.kill();
  writer?.kill();
  sql(`delete from public.snags where id='${snag}';`);
}
