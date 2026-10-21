import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractShimotsukeListSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='09216'||input.sourceId!=='f178fd3d867dee2a56fcd93d'||input.format!=='pdf'||!input.text.startsWith('令和７年度事務事業評価一覧'))return[];
 const rows=[...input.text.matchAll(/^(\d+) (\S+) 裁量(?:あり|なし) (?:継続|新規) [^\n]*?([Ａ-Ｄ] [Ａ-Ｄ] [Ａ-Ｄ])$/gm)];
 return rows.filter(m=>!['471','474'].includes(m[1])&&/事業|費|調査|補助|負担金|管理|運営/.test(m[2])).map(m=>{
  const companionNo=m[1]==='470'?'471':m[1]==='473'?'474':null;
  const companion=companionNo?rows.find(r=>r[1]===companionNo):undefined;
  if(companionNo&&(!companion||companion[2]!==m[2]))throw new Error('Shimotsuke repeated business pair changed');
  const p=project(input,`list-2025-${m[1]}${companion?'+'+companion[1]:''}`,m[2],2025,m[0],m.index!);
  if(companion)p.evidence.push(evidence(input,companion[0],companion.index!));
  if(m[1]==='3'||m[1]==='87'){
    const previous=input.text.lastIndexOf('\n',m.index!-2)+1,next=input.text.indexOf('\n',m.index!+m[0].length+1);
    const context=input.text.slice(previous,next);
    const expected=m[1]==='3'?'ソフト 総合政策 総合政策':'ソフト 市民生活 安全安心';
    if(!context.includes(expected))throw new Error('Shimotsuke reviewed department context changed');
    p.department=m[1]==='3'?'総合政策部 総合政策課':'市民生活部 安全安心課';p.evidence.push(evidence(input,context,previous));
  }
  p.outcomes=m[3]+(companion?'\n'+companion[3]:'');p.evidence.push(evidence(input,input.text.split('\n')[0],0));
  p.warnings.push('事務事業評価一覧の名称が単行完結した行のみ。評価欄の３区分は原文順で保存し、項目名・共通ランクを推測していません。事業対象年度、担当課の改行、人員・費用等は未抽出。保存本文は全71ページ中58ページ途中で切れており、末尾不完結行・名称折返し行を除外。同名同部署の農業委員会運営費470/471・農業者年金業務473/474は各1事業として2掲載の証拠を統合。評点は原文掲載順に保持し統一していない。費目別独立性は未確定。');return p;
 });
}
