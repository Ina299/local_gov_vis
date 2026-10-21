import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from '../national-integration';

/** Extraction runs generated at or after this time read continuation parts; earlier batches keep the 120,000-character text. */
export const FULLTEXT_SINCE = '2026-10-21T15:00:00.000Z';
/**
 * From this time a whole-text run keeps any record whose ID was not published before the run (instead of
 * only records starting after the first part), so documents first acquired with full text are covered too.
 */
export const PRIOR_STATE_RULE_SINCE = '2026-10-21T18:00:00.000Z';

interface Continuation { part: number; assetPath: string; assetBytes: number; assetSha256: string; startCharacter: number; exportedCharacters: number; textSha256: string }
interface SourceText { characters: number; exportedCharacters: number; truncated: boolean; fullTextSha256?: string; continuations?: Continuation[] }

/** Returns the first part joined with its pinned continuations, verifying every hash; `complete` is false when no full text exists. */
export async function fullText(evidenceDir: string, source: { id: string; url: string; text: unknown; acquisition: { sourceSha256: string | null } }, first: string): Promise<{ text: string; complete: boolean }> {
  const t = source.text as SourceText;
  if (!t.continuations?.length) return { text: first, complete: !t.truncated };
  let text = first, start = t.exportedCharacters, part = 2;
  for (const c of t.continuations) {
    const bytes = await readFile(join(evidenceDir, c.assetPath));
    const doc = JSON.parse(bytes.toString());
    if (c.part !== part || c.startCharacter !== start || c.assetPath !== `documents/${source.id}-${part}.json` || bytes.length !== c.assetBytes || sha256(bytes) !== c.assetSha256
      || doc.sourceId !== source.id || doc.sourceUrl !== source.url || doc.sourceSha256 !== source.acquisition.sourceSha256 || doc.startCharacter !== start
      || sha256(Buffer.from(doc.text)) !== c.textSha256 || [...doc.text].length !== c.exportedCharacters) throw new Error(`Continuation integrity mismatch: ${source.id} part ${part}`);
    text += doc.text; start += c.exportedCharacters; part++;
  }
  if (start !== t.characters || sha256(Buffer.from(text)) !== t.fullTextSha256) throw new Error(`Full text mismatch: ${source.id}`);
  return { text, complete: true };
}
