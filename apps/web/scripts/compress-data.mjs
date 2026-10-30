// Gzip the large evaluation assets of a static export in place (<file>.json -> <file>.json.gz).
// Run after `next build` when NEXT_PUBLIC_COMPRESSED_DATA=1; the loaders then fetch the .gz copies.
import { readdir, readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';

const out = process.argv[2];
if (!out) throw new Error('Usage: node compress-data.mjs <static export directory>');
const DIRS = ['evaluation-evidence', 'evaluation-evidence-prefectures', 'evaluations-prefectures', 'evaluations-composed', 'evaluations-municipal'];
let files = 0, before = 0, after = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { await walk(path); continue; }
    if (!entry.name.endsWith('.json')) continue;
    const raw = await readFile(path);
    const packed = gzipSync(raw, { level: 9 });
    if (!gunzipSync(packed).equals(raw)) throw new Error(`Round-trip mismatch: ${path}`);
    await writeFile(`${path}.gz`, packed); await unlink(path);
    files++; before += raw.length; after += packed.length;
  }
}
for (const dir of DIRS) {
  const path = join(out, dir);
  if (await stat(path).then(s => s.isDirectory(), () => false)) await walk(path);
}
console.log(JSON.stringify({ files, beforeMB: +(before / 1e6).toFixed(1), afterMB: +(after / 1e6).toFixed(1) }));
