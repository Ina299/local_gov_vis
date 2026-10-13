import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractHirao(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='35344'||input.format!=='pdf'||!input.text.startsWith('平 生 町 行 政 評 価'))return [];
 const heads=[...input.text.matchAll(/^施策評価シート （評価対象年度： 令和([６７]) 年度）/gm)];const rows:ProjectEvaluation[]=[];const seen=new Map<string,ProjectEvaluation>();
 const rowPattern=/^(?:○ )?([^ ]+) ([ABC]) (業務の内容は適切である|課題が少しあり業務の一部見直しが必要|課題が多くあり業務の大幅な見直しが必要) ([A-G]) (事業拡大・費用拡大|事業拡大・費用維持|事業拡大・費用縮小|事業・費用とも維持|事業維持・費用縮小|事業・費用とも縮小|終了廃止)$/;
 for(let i=0;i<heads.length;i++){
  if(input.truncated&&i===heads.length-1)continue;
  const start=heads[i].index!;const block=input.text.slice(start,heads[i+1]?.index??input.text.length);const at=block.indexOf('６ 関係主要事業\n戦略 事業名 分析・検証結果 今後の方向性\n');if(at<0)continue;
  const department=block.match(/^担当部署 (.+)$/m)?.[1]??null;const fy=2018+Number(heads[i][1].normalize('NFKC'));
  const dataStart=at+'６ 関係主要事業\n戦略 事業名 分析・検証結果 今後の方向性\n'.length;const lines=block.slice(dataStart).split('\n');let offset=dataStart;
  for(let n=0;n<lines.length;n++){
   const line=lines[n],m=line.match(rowPattern);const local=offset;offset+=line.length+1;if(!m)continue;
   // A neighbouring unparsed text line may be a wrapped title: reject rather than invent its missing half.
   if(n>0&&lines[n-1].trim()&&!rowPattern.test(lines[n-1]))continue;
   if(n+1<lines.length&&lines[n+1].trim()&&!/^\d+$/.test(lines[n+1])&&!rowPattern.test(lines[n+1]))continue;
   if(m[1]==='使用済小型家電機器リ')continue; // Source extraction itself ends the title mid-word.
   const key=`${fy}:${department}:${m[1]}`;const ev=evidence(input,line,start+local);const previous=seen.get(key);
   if(previous){if(previous.ratings[0].value!==`${m[2]} ${m[3]}`||previous.ratings[1].value!==`${m[4]} ${m[5]}`)throw new Error('Conflicting Hirao repeated rating');previous.evidence.push(ev);continue;}
   const p=project(input,key,m[1],null,line,start+local);p.evaluatedFiscalYear=fy;p.department=department;p.evidence.push(evidence(input,heads[i][0],start));
   p.ratings=[{kind:'self',label:'事業の分析・検証結果',value:`${m[2]} ${m[3]}`,scale:null,evidence:ev},{kind:'self',label:'事業の今後の方向性',value:`${m[4]} ${m[5]}`,scale:null,evidence:ev}];
   p.warnings.push('原文には方向性の評価記号と説明が一致しない行が含まれます。記号・説明を補正せず併記しています。');
   p.warnings.push('施策評価表末尾の「関係主要事業」に記載された事業別評価行のみの部分レコード。施策全体の総合評価・成果指標・課題を個別事業へ転用しません。完全個票ではなく、費用・個別成果記述は未構造化。名称が折り返す行と隣接する行は境界が未確定のため除外。');rows.push(p);seen.set(key,p);
  }
 }
 return rows;
}
