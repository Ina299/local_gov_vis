import type{ProjectEvaluation}from'../../../../web/src/types/evaluation';import{type CachedInput,evidence,project}from'./shared';
export function extractUtsunomiyaNarrativesSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.sourceId!=='dd189e017142bc6d96330812'||input.municipalityCode!=='09201'||input.truncated)return[];
 const out:ProjectEvaluation[]=[];const sections=[...input.text.matchAll(/【主要な構成事業】\n/g)];
 for(const section of sections){const start=section.index!+section[0].length;const end=input.text.indexOf('令和７年度「行政評価」の結果について',start);if(end<0)continue;const raw=input.text.slice(start,end);const names=[...raw.matchAll(/^(?:創出 )?● (.+)\n/gm)];
  for(let i=0;i<names.length;i++){const m=names[i];const body=raw.slice(m.index!,names[i+1]?.index??raw.length).trim();const p=project(input,m[1],m[1],2025,body,start+m.index!);p.evaluatedFiscalYear=2024;p.activities=body.slice(body.indexOf('\n')+1).trim();p.evidence.push(evidence(input,'⇒令和６年度の取組を評価'));p.warnings.push('施策評価概要に明示された主要構成事業ごとの実施内容のみ部分収録。施策総合95点・満足度・施策成果指標を事業へ転用しない。料金割引額を事業費としない。');out.push(p);}
 }
 return out;
}
