import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Published summary rows; individual PDF bodies are not implied. */
export function extractToin(input: CachedInput): ProjectEvaluation[] {
 if (input.municipalityCode !== '24324' || input.sourceId !== '15d69e494e3f07daf82237e8' || !input.text.includes('令和元年度行政評価結果（平成30年度事務事業の評価）')) return [];
 const heads=[...input.text.matchAll(/^No\.(\d+) (.+)$/gm)];
 return heads.flatMap((h,i)=>{
  const block=input.text.slice(h.index!,heads[i+1]?.index??input.text.length);
  return [...block.matchAll(/^(\d+)\n(.+?)\n?\(PDFファイル:[^\n]+\)\n((?:継続|要改善|拡充|民間・NPO|国・県・広域|縮小|廃止|終了)（[^\n]+）)/gm)].map(m=>{
   const p=project(input,`${h[1]}:${m[1]}`,m[2],2019,m[0],h.index!+m.index!);
   p.projectCode=null; p.department=h[2]; p.evaluatedFiscalYear=2018;
   p.ratings.push({kind:'self',label:'総合評価（主管課長評価）',value:m[3],scale:null,evidence:evidence(input,m[3],h.index!+m.index!+m[0].lastIndexOf(m[3]))});
   p.warnings.push('公式HTML結果一覧の名称・部署・評価のみ。リンク先個票の本文・費用・指標は未抽出。番号は部署内一覧番号。');
   return p;
  });
 });
}
