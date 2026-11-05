/**
 * 取り込み前の点検: まとめた候補（src/assemble-descending-inputs.ts の出力）を公開中のデータ（補強を当てる前）に1件ずつ追記してみて、取り込みが止まる同一性の衝突を全部数える（何も書き込まない）。
 *   node --import tsx apps/crawler/scripts/descending-import/collisions.ts <dir> <out.json>
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { EvaluationDataset } from '../../../web/src/types/evaluation';
import { verifyCoreIntegratedEvaluations } from '../../src/evaluations/national-integration';
import { composeSupplemental, loadBatches, loadManifest, mergeSupplementalDataset, verifySupplementalDecisionProofs } from '../../src/evaluations/supplemental-integration';

const [dir, out] = process.argv.slice(2);
const root = resolve(import.meta.dirname, '../../../..');
// 取り込みは追記のバッチを全部重ねてから補強を当てるため、補強を当てる前のデータを相手にする。
const manifest = (await loadManifest(root))!, batches = await loadBatches(root, manifest);
const core = await verifyCoreIntegratedEvaluations(root, Buffer.from(JSON.stringify(manifest.originalIndex) + '\n'));
const shards = composeSupplemental(core, batches, await verifySupplementalDecisionProofs(root, batches.flatMap(b => b.distinctDecisions ?? []))).assets.shards;
const result: { code: string; incoming: string; name: string; reason: string }[] = [];
let added = 0;
for (const f of (await readdir(dir)).filter(f => f.endsWith('.json')).sort()) {
  const incoming: EvaluationDataset = JSON.parse(await readFile(join(dir, f), 'utf8'));
  const code = f.slice(0, 5), bytes = shards.get(code);
  let base: EvaluationDataset | null = bytes ? JSON.parse(bytes.toString()) : null;
  for (const p of incoming.projects) {
    try {
      const r = mergeSupplementalDataset(base, { ...incoming, projects: [p] }, incoming.generatedAt);
      if (r.decisions[0]?.status === 'added') added++;
      else result.push({ code, incoming: p.id, name: p.projectName, reason: `${r.decisions[0]?.status}: ${r.decisions[0]?.reason}` });
      base = r.dataset;
    } catch (e) { result.push({ code, incoming: p.id, name: p.projectName, reason: (e as Error).message }); }
  }
}
await writeFile(out, JSON.stringify(result, null, 1));
console.log(JSON.stringify({ added, stopped: result.length }));
