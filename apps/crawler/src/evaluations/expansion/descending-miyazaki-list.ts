import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput,project,evidence} from './shared';
export function reviewMiyazakiList(input:CachedInput):LayoutReview|null{
 if(input.municipalityCode!=='45201'||input.sourceId!=='91ab0e9a58445dbff019516c')return null;
 const header='令和７年度（令和８年度分） 新規事業評価一覧';
 const r:LayoutReview={projects:[],units:[],status:'reviewed_proposal_list',reason:'113 proposed FY2026 budget items assessed in2025; no actual-expenditure or successful-execution claim',proofs:[header]};
 if(input.truncated||input.format!=='pdf'||!input.text.startsWith(header))return r;
 const hs=[...input.text.matchAll(/^(\d+) (.+?) (一般|介護|国保|市場|住宅) (採択|不採択) (\d+)$/gm)];
 if(hs.length!==113||hs.some((h,i)=>+h[1]!==i+1||h[1]!==h[5])){r.status='layout_boundary_hold';r.reason='Exact113 sequential project/page rows required';return r;}
 const aliases:Record<string,string>={
 '9':'cached-45201-bafab8a079afcb6364a94e84: same proposal list page9; individual sheet calls it 公開型地図情報システム運用管理事業',
 '27':'cached-45201-a5af47a38b97b2afd6290c51: same annual business name without funding qualifier（基金事業）',
 '34':'cached-45201-2d1bd2edf1f7fb84187bf949: existing 地域生活支援給付事業（訪問入浴）; parent/variant identity unresolved',
 '39':'cached-45201-4b4aaf34cf18edfdb902bfcf: existing 高齢者施設への価格高騰重点支援事業, title variation; no duplicate added',
 '60':'cached-45201-c477a482585d8d2a72ddaf27: existing same title with（組換新規）qualifier',
 '68':'cached-45201-6af948ca44a577bb7c00be31: existing same title with（森林環境譲与税）qualifier'};
 for(const h of hs){let start=h.index!,raw=h[0],name='',department='';const fields=/^(\S+(?:部|支所)|教育委員会) (\S+課)(?: (.*))?$/.exec(h[2]);
 if(fields){department=fields[1]+fields[2];name=fields[3]??'';}
 if(!name){const previousStart=input.text.lastIndexOf('\n',start-2)+1,previous=input.text.slice(previousStart,start-1),nextStart=start+h[0].length+1,nextEnd=input.text.indexOf('\n',nextStart),next=input.text.slice(nextStart,nextEnd<0?input.text.length:nextEnd);
 if(h[1]==='101'&&h[2]==='佐土原・地域市民福祉課'&&previous==='佐土原総合支 郷土の偉人「根井三郎」顕彰推進事業（常'&&next==='所 設展示場)'){name='郷土の偉人「根井三郎」顕彰推進事業（常設展示場)';department='佐土原総合支所佐土原・地域市民福祉課';}
 else if(fields&&!/^\d|区分|会計|No\.|令和/.test(previous)&&/事業|事務|費|分）|支援）|整備事|進追加分）|体制整備|作成業務|力発電|PR）|協会分）|重点調査/.test(previous+next)&&next.length<30&&!/^\d|令和/.test(next)){name=previous+next;}
 if(name){start=previousStart;raw=input.text.slice(start,nextEnd<0?input.text.length:nextEnd);}
 }
 if(!name){r.units.push({start,name:h[1],status:'held',reason:'Complete name/department row cannot be recovered from reviewed wrapping'});continue;}
 if(aliases[h[1]]){r.units.push({start,name,status:'identity_hold',reason:aliases[h[1]]});continue;}
 const p=project(input,'proposal-list-'+h[1],name,2025,raw,start);p.projectCode=h[1];p.evaluatedFiscalYear=null;p.department=department;p.evidence.push(evidence(input,header));p.warnings.push('令和7年度に評価した令和8年度新規事業案の一覧。評価年度2025のみ記録し、2026年度の実施・決算を意味しない。不採択を含む審査対象の名称を保持し、既存個票の値は更新しない。');r.projects.push(p);r.units.push({start,name,status:'supported',reason:'Complete proposal-list identity; requested-year scope distinguished from actual implementation'});
 }return r;
}
