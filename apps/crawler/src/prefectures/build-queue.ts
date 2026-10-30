/**
 * 都道府県の評価資料の探索結果（data/evaluations/prefecture-discovery-*.json）を、収集器（source-collection/cli.ts）のキューにする。
 *   tsx src/prefectures/build-queue.ts --discovery <file> [--discovery <file> ...] --merged <out.json> --queue <queue.json> [--round prefecture-r2]
 * 探索結果は公式ページに実際に載っていたリンクだけを持つ。ここでは公式ドメイン以外・正規化できない URL を落とし、
 * 都道府県コードは収集器・評価データの 5 桁形式（東京都 = 13000）にそろえる。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface Link { url: string; title: string; format?: string; evaluationType?: string; yearNotes?: string; evidenceUrl?: string }
interface Prefecture {
  prefectureCode: string; prefectureName: string; landingPages: Link[]; documents: Link[];
  amountsVisible: boolean | 'unknown' | null; amountsCheckedDocument?: string; notes?: string; notFound: boolean;
}

const args = process.argv.slice(2);
const all = (name: string) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const one = (name: string) => { const v = all(name); if (v.length !== 1) throw new Error(`${name} is required once`); return v[0]; };

/** 都道府県の公式ドメイン（pref.<名>.lg.jp / pref.<名>.jp / metro.tokyo.lg.jp と、その下のサブドメイン） */
export function isOfficialPrefectureHost(host: string): boolean {
  return /(^|\.)pref\.[a-z]+\.(lg\.)?jp$/.test(host) || /(^|\.)metro\.tokyo\.(lg\.)?jp$/.test(host);
}
export const prefectureEvaluationCode = (prefectureCode: string) => `${prefectureCode}000`;

const prefectures: Prefecture[] = [];
for (const file of all('--discovery')) prefectures.push(...(JSON.parse(await readFile(resolve(file), 'utf8')) as { prefectures: Prefecture[] }).prefectures);
prefectures.sort((a, b) => a.prefectureCode.localeCompare(b.prefectureCode));
const codes = prefectures.map((p) => p.prefectureCode);
if (new Set(codes).size !== codes.length || !codes.every((c) => /^(0[1-9]|[1-3]\d|4[0-7])$/.test(c))) throw new Error('Duplicate or invalid prefecture codes');

const checkedAt = new Date().toISOString();
const round = all('--round')[0] ?? 'prefecture-r1';
const dropped: Array<{ prefectureCode: string; url: string; reason: string }> = [];
const upgraded: Array<{ prefectureCode: string; url: string }> = [];
const seen = new Set<string>();
const sources = [];
for (const p of prefectures) {
  const keep = (link: Link) => {
    let url: URL;
    try { url = new URL(link.url); } catch { dropped.push({ prefectureCode: p.prefectureCode, url: link.url, reason: 'invalid URL' }); return false; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') { dropped.push({ prefectureCode: p.prefectureCode, url: link.url, reason: 'protocol' }); return false; }
    if (!isOfficialPrefectureHost(url.hostname)) { dropped.push({ prefectureCode: p.prefectureCode, url: link.url, reason: `non-official host ${url.hostname}` }); return false; }
    url.hash = '';
    // 収集器は HTTPS のみ。同じホストの HTTPS に切り替え、切り替えたことを記録する（取れなければ収集で失敗として残る）
    if (url.protocol === 'http:') { url.protocol = 'https:'; upgraded.push({ prefectureCode: p.prefectureCode, url: url.href }); }
    link.url = url.href;
    return true;
  };
  p.landingPages = p.landingPages.filter(keep);
  p.documents = p.documents.filter(keep);
  for (const link of [...p.landingPages, ...p.documents]) {
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    const page = link.evidenceUrl && (() => { try { const u = new URL(link.evidenceUrl!); u.hash = ''; if (u.protocol === 'http:') u.protocol = 'https:'; return isOfficialPrefectureHost(u.hostname) ? u.href : null; } catch { return null; } })();
    sources.push({
      url: link.url, sourcePageUrl: page || link.url, municipalityCode: prefectureEvaluationCode(p.prefectureCode), municipalityName: p.prefectureName,
      title: link.title.trim() || link.url, fiscalYear: null, amountKind: null,
      review: { checkedAt, evidence: `${round}: link printed on the official page ${page || link.url}; official prefecture host` },
    });
  }
}
await writeFile(resolve(one('--merged')), JSON.stringify({ schemaVersion: 1, round, mergedAt: checkedAt, prefectures, dropped, upgradedToHttps: upgraded }, null, 1) + '\n');
await writeFile(resolve(one('--queue')), JSON.stringify({ version: 1, quarantineHosts: [], sources }, null, 1) + '\n');
console.log(JSON.stringify({ prefectures: prefectures.length, sources: sources.length, dropped, upgradedToHttps: upgraded.length }, null, 1));
