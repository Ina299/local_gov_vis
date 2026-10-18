import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const sources:Record<string,number>={'8d672306b62907cd8a2b8be6':2018,'edf1805b09947bdf4b3940a7':2019,'0a37e5a493163068a32a479f':2020,'e0fd235c2d74ec2a6d56f2c2':2022,'465df628f4e90479996de7db':2023,'b9f1b300cfee31c07517b3d1':2024};
/** Explicit project-level grades from the internal budget-project listing. */
export function extractMarugameInternalSupplement(input:CachedInput):ProjectEvaluation[]{
 const year=sources[input.sourceId];if(!year||input.municipalityCode!=='37202'||input.format!=='pdf')return[];
 const text=input.text;const result=new Map<string,ProjectEvaluation>();let account:string|null=null;let accountStart=0;let section=false;
 const introEnd=text.indexOf('施策評価・事務事業評価結果一覧');if(introEnd<0)return[];
 const intro=text.slice(0,introEnd);if(!intro.includes('5段階')&&!intro.includes('５段階'))return[];
 const lines=[...text.matchAll(/^.*$/gm)];
 for(let index=0;index<lines.length;index++){
  const m=lines[index];
  const line=m[0];if(line==='【事務事業評価】'){section=true;account=null;continue;}if(/^基本方針 /.test(line)){section=false;account=null;continue;}if(!section)continue;
  if(/^款 \d+ .+ 項 \d+ .+ 目 \d+ .+$/.test(line)||/^[^\s]+(?:特別会計|事業会計)$/.test(line)){account=line;accountStart=m.index!;continue;}
  let row=line.match(/^(.+?) ?([Ａ-ＥA-EⅭⅮ]) (\d+) (.+?) (\d+)$/);let raw=line;let offset=m.index!;
  let secondRating:{department:string;value:string}|null=null;
  const prev=lines[index-1]?.[0]??'',next=lines[index+1]?.[0]??'';
  const bare=line.match(/^([Ａ-ＥA-EⅭⅮ]) (\d+) (.+?) (\d+)$/);
  const noGrade=line.match(/^(\d+) (.+?) (\d+)$/);
  if(!row&&bare){
   let department:string|null=null;
   if(/^(?:選挙管理委|ボートレー|綾歌市民総|飯山市民総)$/.test(prev)&&/^(?:員会事務局|ス事業局|合センター)$/.test(next))department=prev+next;
   else if(/^[^ ]+(?:課|局|センター)$/.test(prev)&&/^[^ ]+(?:課|局|センター)$/.test(next))department=prev+'／'+next;
   if(department){row=[line,department,bare[1],bare[2],bare[3],bare[4]] as RegExpMatchArray;offset=lines[index-1].index!;raw=text.slice(offset,lines[index+1].index!+next.length);}
  }else if(!row&&noGrade){
   const a=prev.match(/^([^ ]+(?:課|局|センター)) ([Ａ-ＥA-EⅭⅮ])$/),b=next.match(/^([^ ]+(?:課|局|センター)) ([Ａ-ＥA-EⅭⅮ])$/);
   if(a&&b){row=[line,a[1],a[2],noGrade[1],noGrade[2],noGrade[3]] as RegExpMatchArray;secondRating={department:b[1],value:b[2].normalize('NFKC')};offset=lines[index-1].index!;raw=text.slice(offset,lines[index+1].index!+next.length);}
  }
  if(!account||!row||!/(?:課|局|センター|図書館|部)$/.test(row[1]))continue;
  if(input.truncated&&m.index!+line.length>=text.trimEnd().length)continue;
  const code=`internal-${account.normalize('NFKC')}-${row[3]}`;const name=row[4];const key=code+'\n'+name;
  const e=evidence(input,raw,offset);const rating={kind:'self' as const,label:`事務事業評価（${row[1]}）`,value:row[2].normalize('NFKC'),scale:'A～E（計画に対する成果）',evidence:e};
  const old=result.get(key);if(old){
   old.evidence.push(e);if(!old.ratings.some(r=>r.label===rating.label&&r.value===rating.value))old.ratings.push(rating);
   if(!old.department!.split('／').includes(row[1]))old.department+='／'+row[1];continue;
  }
  const p=project(input,code+'-'+name,name,year,raw,offset);p.department=row[1];p.evaluatedFiscalYear=year-1;
  p.evidence.push(evidence(input,account,accountStart),evidence(input,intro,0));p.ratings.push(rating);if(secondRating){p.department+='／'+secondRating.department;p.ratings.push({...rating,label:`事務事業評価（${secondRating.department}）`,value:secondRating.value});}
  p.warnings.push('事務事業評価一覧の確定した予算事業行のみの部分収録。費用・成果説明を備えた個票完了ではない。施策評価・施策指標を事業へ転用しない。右端の数字は主要施策成果報告書の参照ページであり費用ではない。同一款項目・番号・名称の再掲と担当課別掲載は証拠統合し、同名でも款項目が異なる予算事業は区別。改行した担当課・複数行の事業名や評価列が曖昧な行は保留。');
  result.set(key,p);
 }
 return [...result.values()];
}
