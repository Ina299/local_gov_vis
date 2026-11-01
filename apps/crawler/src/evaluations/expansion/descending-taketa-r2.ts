import {taketaEarlierReviewed} from './descending-taketa-earlier-map';
import {taketaReviewed} from './descending-taketa-map';
import {createHash} from 'node:crypto';
import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput,project,evidence} from './shared';
export function reviewTaketaR2(i:CachedInput):LayoutReview|null{
 if(i.municipalityCode!=='44208')return null;
 const edu=reviewTaketaEducation(i);if(edu)return edu;
 if(i.sourceId!=='e9c37ebb6e49f39f69d90fe2')return null;
 const proof='令和７年度物価高騰対応重点支援地方創生臨時交付金事業';
 const r:LayoutReview={projects:[],units:[],status:'reviewed_mixed_completion_grants',reason:'16 plan rows reviewed; completed single-year businesses separated from carryovers and repeated funding portions.',proofs:[proof]};
 if(i.truncated||i.format!=='pdf'||!i.text.includes(proof)||!i.text.includes('実績（繰越事業は計画額）'))return r;
 for(const name of ['施設園芸等燃油高騰緊急対策事業','県産牛乳消費拡大推進事業補助金','学校給食費保護者負担軽減事業']){
  const raw=name==='学校給食費保護者負担軽減事業'?name+'（R7補正分）':name;
  if(!i.text.includes(raw))continue;
  const p=project(i,'completed-'+i.text.indexOf(raw),name,null,raw,i.text.indexOf(raw));p.projectCode=null;p.evaluatedFiscalYear=2025;p.evidence.push(evidence(i,proof,i.text.indexOf(proof)));
  const period=name==='学校給食費保護者負担軽減事業'?'R7.4.1\n\nR8.3.31':'R7.10.1\n\nR8.3.31';
  if(!i.text.includes(period))continue;p.evidence.push(evidence(i,period,i.text.indexOf(period)));
  if(name==='学校給食費保護者負担軽減事業'){
   const other=name+'（R7予備費分）';if(!i.text.includes(other)||!i.text.includes('全体6,123,500円'))continue;
   p.evidence.push(evidence(i,other,i.text.indexOf(other)));p.warnings.push('補正分と予備費分は同一給食費事業の財源内訳。二件に分けず金額も転記しない。');
  }
  p.warnings.push('完了済み事業の名称と実施年度のみ。繰越事業の計画額や過年度の補助対象経費を実績額として転記しない。');r.projects.push(p);r.units.push({start:i.text.indexOf(raw),name,status:'supported',reason:'Single-year completed period and exact title; no numeric transfer'});
 }
 r.units.push({start:i.text.indexOf('学校給食費保護者負担軽減事業（R7予備費分）'),name:'学校給食費保護者負担軽減事業（R7予備費分）',status:'duplicate_component',reason:'Same whole-business cost, period, beneficiaries and outcome as supplementary-budget portion; retained as evidence on one business.'});
 const held=['エネルギー・食料品等物価高騰緊急支援給付金（低所得世帯支援・不足額給付）','物価高騰対策生活者支援給付金','竹田市燃料価格高騰対策観光周遊ツアー造成補助金','竹田市燃料価格高騰対策観光周遊ツアー造成補助金（第２弾）','大分県地域消費喚起プレミアム付商品券支援事業（第５弾）','自治会集会所照明ＬＥＤ化事業','自治会防犯灯照明ＬＥＤ化事業','社会福祉施設等物価高騰対策緊急支援事業（障がい者福祉施設）','社会福祉施設等物価高騰対策緊急支援事業（高齢者者福祉施設）','社会福祉施設等物価高騰対策緊急支援事業（子育て・保育施設等）','帯状疱疹予防接種費用助成事業','指定ごみ袋配布事業'];
 for(const name of held)r.units.push({start:0,name,status:'annual_identity_hold',reason:name.startsWith('エネルギー')?'R7.3.1～R8.3.31、R6/R7累計給付。単年度の同一性を確定できない。':'R8.4以降に繰越・実施中。完了時公表予定のため評価済み年次実績にしない。'});
 return r;
}

const educationConfigs:Record<string,{year:number;era:string;names:string[]}>= {
 'f52f36a7b89f74bb4b36c809':{year:2020,era:'２',names:['竹田市生活のきまり１０項目の徹底','いじめ解消の取組','竹田市学習のきまり１０項目の徹底','公民館分館教室事業','第７４回竹田市駅伝競走大会']},
 'bacbcb79d5dc5973075dd25d':{year:2021,era:'３',names:['生活の決まりや学習の決まりの徹底','食育の推進','歯の健康指導の取組','幼小の連携','竹田市特別支援ネットワーク会議の充実','特別支援教育研修の充実','大型掲示装置の整備（電子黒板の整備）','防災対策の推進','家庭や地域との連携','家庭教育事業','公民館分館教室事業']},
 '1606322c525a744832c7ca00':{year:2025,era:'７',names:['竹田市学力向上プランの推進','協働的な学びの推進','GIGAスクール環境を活用したICT授業推進','学力調査活用・授業改善推進事業','体力向上１校１実践の取組','幼保小接続推進「架け橋」促進事業','特別支援教育実践力向上研修事業','ＩＣＴ支援業務','学校給食共同調理場運営事業','地域協働による教育活動推進事業','人権教育推進指導者養成講座','図書館サービスの充実']}
};
function reviewTaketaEducation(i:CachedInput):LayoutReview|null{
 const c=educationConfigs[i.sourceId];if(!c)return null;
 const proof='(令和'+c.era+'年度対象)';
 const r:LayoutReview={projects:[],units:[],status:'partial_education_title_columns',reason:'Exact complete titles before overview column only; remaining interleaved rows still require column-boundary review.',proofs:[proof]};
 if(i.truncated||i.format!=='pdf'||!i.text.includes(proof))return r;
 const heads=[...i.text.matchAll(/２．令和[ ２３７7]+年度の主な取組(?:み)?/g)];
 for(let n=0;n<heads.length;n++){
  const start=heads[n].index!,end=heads[n+1]?.index??i.text.length;let body=i.text.slice(start,end);const closing=body.indexOf('３．');
  if(closing<0){r.units.push({start,status:'layout_review',reason:'No closing future-direction boundary'});continue;}body=body.slice(0,closing);
  const a=body.indexOf('事業名称'),b=body.indexOf('事業概要',a);let accepted=0;
  if(a>=0&&b>a&&b-a<300){
   const titleColumn=body.slice(a+4,b),parts=[...titleColumn.matchAll(/[^\n]+(?:\n[^\n]+)*/g)];
   for(const m of parts){const raw=m[0],name=raw.replace(/\s/g,'');if(!c.names.includes(name))continue;
    const at=start+a+4+m.index!,p=project(i,'education-'+at,name,null,raw,at);p.projectCode=null;p.evaluatedFiscalYear=c.year;p.evaluationYear=null;p.evidence.push(evidence(i,proof,i.text.indexOf(proof)));p.evidence.push(evidence(i,heads[n][0],start));p.warnings.push('主な取組の名称列のみ。施策共通の評価や隣接した数値は転記しない。');r.projects.push(p);accepted++;r.units.push({start:at,name,status:'supported',reason:'Reviewed complete title in actual-year activity name column'});
   }
  }
  if(c.year===2025){
   for(const raw of ['人権・部落\n差別解消教\n育推進事業','キャリア教\n育推進事業','考え、議論\nする道徳授\n業改善事業','学校図書館\n活用・読書\n活動推進事\n業']){
    const atInBody=body.indexOf('事業概要\n\n'+raw+'\n\n');if(atInBody<0)continue;
    const at=start+atInBody+'事業概要\n\n'.length,name=raw.replace(/\n/g,'');
    const p=project(i,'education-'+at,name,null,raw,at);p.projectCode=null;p.evaluatedFiscalYear=c.year;p.evidence.push(evidence(i,proof,i.text.indexOf(proof)));p.evidence.push(evidence(i,heads[n][0],start));p.warnings.push('概要直後の独立した名称欄を原文照合。施策共通評価・数値は転記しない。');r.projects.push(p);accepted++;r.units.push({start:at,name,status:'supported',reason:'Reviewed complete post-overview title paragraph, before narrative description'});
   }
  }
  r.units.push({start,status:'layout_review',reason:accepted?'Complete contiguous title accepted; other rows in this sheet require separate column review.':'No reviewed complete title in pre-overview span; title fragments may be interleaved later in the sheet. Not an access denial.'});
 }
 const reviewed=[taketaReviewed,...taketaEarlierReviewed].find(x=>x.sourceId===i.sourceId);
 if(reviewed&&createHash('sha256').update(i.text).digest('hex')===reviewed.sourceFullTextSha256){
 if(i.sourceId===taketaReviewed.sourceId){
  r.status='reviewed_r7_activity_sheets';r.reason='All 44 actual-year activity sheets plus the blank example reviewed; literal names accepted, unresolved identities and title boundaries held individually.';
  for(const unit of r.units)if(unit.status==='layout_review'){unit.status='reviewed_sheet';unit.reason='All R7 activity sheets reviewed; unresolved identities and reversed title fragments are recorded separately.';}
  for(const hold of taketaReviewed.holds)r.units.push({start:heads[hold.sheet].index!,status:'individual_identity_hold',reason:hold.reason});
 }
  for(const row of reviewed.rows){
   if(i.text.slice(row.start,row.start+row.raw.length)!==row.raw||createHash('sha256').update(row.raw).digest('hex')!==row.sha256)continue;
   for(const name of row.names){
    const p=project(i,'education-reviewed-'+row.start+'-'+row.names.indexOf(name),name,null,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=c.year;p.evidence.push(evidence(i,proof,i.text.indexOf(proof)));p.warnings.push('確認済み当年度の個別取組欄の文字列を保存。列の入り組みは名称・数値の推測で補わず、金額・評価は転記しない。');r.projects.push(p);r.units.push({start:row.start,name,status:'supported',reason:'Reviewed named activity within complete actual-year sheet; full source and bounded sheet hashes match'});
   }
  }
 }
 return r;
}
