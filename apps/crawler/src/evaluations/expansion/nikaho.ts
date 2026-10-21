import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractNikaho(input: CachedInput): ProjectEvaluation[] {
  if(input.municipalityCode!=='05214'||input.sourceId!=='26804d000c51723a84a40007')return [];
  const year=input.text.match(/令和７年度\n外部行政評価報告書\n（評価対象：令和６年度事務事業）/);
  if(!year)return [];
  const starts=[...input.text.matchAll(/^《令和[^\n]+委員会》\n№ 事業担当課名 事 業 名 事業種別\n/gm)];
  const result:ProjectEvaluation[]=[];
  for(let i=0;i<starts.length;i++){
    if(input.truncated&&i===starts.length-1)continue;
    const start=starts[i].index!;const raw=input.text.slice(start,starts[i+1]?.index??input.text.length);
    const h=raw.slice(starts[i][0].length).match(/^([1-6１-６]) ([^ ]+) (.+?) (直営|民間委託)\n/);
    const vote=raw.match(/^Ａ：[０-９]+人 Ｂ：[０-９]+人 Ｃ：[０-９]+人 Ｄ：[０-９]+人$/m);
    const rating=raw.match(/\n評\n価\n([Ａ-ＤA-D]) /);
    if(!h||!vote||!rating||!raw.match(/\n(?:11|12|13|14|15|16)\s*$/))continue;
    const p=project(input,h[1].normalize('NFKC'),h[3],2025,raw,start);
    p.department=h[2];p.evaluatedFiscalYear=2024;p.evidence.push(evidence(input,year[0],year.index));
    // Keep complete textual comments; the interleaved vertical label is not content.
    const comments=raw.slice(vote.index!+vote[0].length).replace(/\n(?:評|価|委|員|か|ら|の|意|見|等)(?=\n)/g,'').replace(/\n(?:11|12|13|14|15|16)\s*$/,'').trim();
    p.outcomes=comments||null;
    p.ratings.push({kind:'external',label:'外部評価',value:rating[1].normalize('NFKC'),scale:null,evidence:evidence(input,raw.slice(rating.index!,vote.index!+vote[0].length),start+rating.index!)});
    p.warnings.push('前半の候補36事業一覧・総括の再掲を除き、委員会個別6票のみ。目的・成果欄は予定効果も含むため実績値に転用せず、外部評価コメントを結果本文として保持。就農アドバイザーの月額単価から年額決算を推計していません。');
    result.push(p);
  }
  return result;
}
