import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Individually reviewed small reports; no inference from filenames or funding totals. */
export function extractReviewedPdfSupplement(input: CachedInput): ProjectEvaluation[] {
 if(input.format !== 'pdf' || input.truncated) return [];
 const out: ProjectEvaluation[] = [];
 if (input.municipalityCode === '07208' && input.sourceId === 'd98995afcc09ea9601ae6611') {
  const heads = [...input.text.matchAll(/^外部評価調書（通し番号([１-５])）\n事務事業名 (.+)\n担当部課名 (.+)\n/gm)];
  if (heads.length !== 5 || !input.text.includes('令和６年１１月７日')) return [];
  for (let i=0;i<heads.length;i++) {
   const h=heads[i],start=h.index!,raw=input.text.slice(start,heads[i+1]?.index??input.text.length);
   const p=project(input,h[1].normalize('NFKC'),h[2],2024,raw,start);p.department=h[3];
   p.evidence.push(evidence(input,'令和６年１１月７日',input.text.indexOf('令和６年１１月７日')));
   p.warnings.push('外部評価調書の各個票を採用。評価対象実績年度は本文に明記がないため未設定。総括コメントは見出しと文章が交錯するため全文根拠で保持。選択記号を失った方向性欄から評価を推測しない。');
   out.push(p);
  }
 }
 if (input.municipalityCode === '39305' && input.sourceId === '367c6c2f9d365ea79e003d7e') {
  const heads=[...input.text.matchAll(/^Ⅱ．事業評価個表\n/gm)];
  for(let i=0;i<heads.length;i++) {
   const start=heads[i].index!,raw=input.text.slice(start,heads[i+1]?.index??input.text.length);
   const title=/^1 (?:公共用施設に係る整備、維持補修又は維持運営等措置|地域活性化措置) (.+)$/m.exec(raw);
   if(!title)continue;
   const p=project(input,`name:${title[1]}`,title[1],null,raw,start);
   p.warnings.push('総括表を除いた評価個表のみ抽出。二つの個表に同じ番号1が印字されているため名称で識別。保存本文から評価年度・対象実績年度・金額の通貨単位を確定できないため未設定。総事業費と交付金充当額を合算しない。');out.push(p);
  }
 }
 if (input.municipalityCode === '08211' && input.sourceId === '04ebc78ae3c9f58744783456') {
  for(const m of input.text.matchAll(/\b(0[0-6]\d) (?:[0-9‐-]+ )?([^ \n]+) ([^\n]*?)(現行どおり|拡充|縮小) (現行どおり|拡充|縮小) (現行どおり|拡充|縮小)$/gm)) {
   const p=project(input,m[1],m[2],2020,m[0],m.index!);
   const dept=m[3].trim().split(' ')[0];
   if(dept && /(?:課|館|チーム)$/.test(dept))p.department=dept;
   p.evidence.push(evidence(input,'令和２年度事務事業評価結果一覧',input.text.indexOf('令和２年度事務事業評価結果一覧')));
   for(const [n,label,kind] of [[4,'担当部長評価','self'],[5,'行政改革懇談会','external'],[6,'行改推進本部（最終評価）','self']] as const)
    p.ratings.push({kind,label,value:m[n],scale:'現行どおり／拡充／縮小',evidence:evidence(input,m[0],m.index!)});
   p.warnings.push('令和2年度結果一覧の3段階評価を列順に保持。評価対象実績年度はこのPDF本文に明記がないため未設定。折返し担当課は補完せず、予算事業コードではなく整理番号で識別。金額は掲載なし。');out.push(p);
  }
 }
 if (input.municipalityCode === '33205' && input.sourceId === '7d807cb84927f0e1c7120600') {
  const name='広域連携拠点施設（熱利用施設）整備事業';
  if(input.text.includes(name)&&input.text.includes('令和８年７月３１日')) {
   const p=project(input,`name:${name}`,name,2026,input.text,0);p.evaluatedFiscalYear=2025;
   const start=input.text.indexOf('３．実績値（令和７年度）の評価'),end=input.text.indexOf('４．有識者会議による検証');
   if(start>=0&&end>start)p.outcomes=input.text.slice(start,end).trim();
   p.warnings.push('3市2町の広域事業。事業費・KPIは圏域全体を対象とするため笠岡市単独の費用・指標として数値化しない。評価実施は令和8年7月31日、対象実績は令和7年度。');out.push(p);
  }
 }
 return out;
}
