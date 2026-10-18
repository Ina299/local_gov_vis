import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,project,evidence} from './shared';
const kakuda:Record<string,[number,number]>={'7bfab964f6b2aed52d402100':[2024,2023],'caae103adb9e7e30f3634a30':[2025,2024],'f6c6ec29bd174c709890af25':[2023,2022]};
const kanoya:Record<string,number>={'37298fa69b2dbe4e32cb9a95':2024,'a0eb25e36271922dd96f2df9':2025};
function base(input:CachedInput,name:string,year:number|null,fy:number,raw:string,start:number){const p=project(input,`${fy}:${name}`,name,year,raw,start);p.evaluatedFiscalYear=fy;p.evidence.push(evidence(input,input.text.split('\n').slice(0,3).join('\n')));return p;}
export function extractEducationAssistSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.format!=='pdf'||input.truncated)return [];
 const out:ProjectEvaluation[]=[];
 if(input.municipalityCode==='04208'&&kakuda[input.sourceId]){
 const [year,fy]=kakuda[input.sourceId];const heads=[...input.text.matchAll(/^事 業 名 (.+)$/gm)];
 for(let i=0;i<heads.length;i++){const h=heads[i],start=h.index!,part=input.text.slice(start,heads[i+1]?.index??input.text.length);const footer=[...part.split('３ ま')[0].matchAll(/\n- ?\d+ ?-/g)].at(-1);if(!footer)continue;const raw=part.slice(0,footer.index!+footer[0].length);if(!raw.includes('事業の内容'))continue;
 const p=base(input,h[1],year,fy,raw,start);p.warnings.push('事業名欄のある個別評価票のみ抽出。名称が広い場合も原典の一評価単位を維持し、構成事業を別レコードへ分割しない。縦中央配置の目的・内容・評価欄は混線するため全文根拠で保持、金額・評点は未抽出。');out.push(p);}
 }
 if(input.municipalityCode==='46203'&&kanoya[input.sourceId]){
 const fy=kanoya[input.sourceId];const heads=[...input.text.matchAll(/^１ 検証事業について$/gm)];
 for(let i=0;i<heads.length;i++){const start=heads[i].index!,part=input.text.slice(start,heads[i+1]?.index??input.text.length);const name=/^事 業 名 等 (.+)$/m.exec(part);if(!name||name[1].startsWith('グローカル'))continue;const ends=['Ⅲ 資 料','その他の質疑等'].map(x=>part.indexOf(x)).filter(x=>x>=0);const end=ends.length?Math.min(...ends):-1;const raw=end>=0?part.slice(0,end):part;if(!raw.includes('３ 外部評価'))continue;const p=base(input,name[1],fy,fy,raw,start);p.department=/^担 当 課 (\S+)/m.exec(raw)?.[1]??null;p.warnings.push('評価事業名欄の個票。評価年度と対象年度は当年度、報告書発行は翌年3月。決算や指標に当年度見込が含まれるため実績値として変換しない。関連4事業をまとめたグローカル教育は除外。');out.push(p);}
 }
 if(input.municipalityCode==='02303'&&input.sourceId==='288e9bc5ecc6663efdb7496a'){
 for(const m of input.text.matchAll(/^(?:(?:[１-４]) [^\n]+? )?(\d+) (\S+事業) ([1-4]) (.+)$/gm)){
 const p=base(input,m[2],2022,2021,m[0],m.index!);p.ratings.push({kind:'self',label:'事務事業評価',value:m[3],scale:null,evidence:evidence(input,m[0],m.index!)});p.warnings.push('重点項目内の個別事業行から名称と評点のみ部分抽出。番号は節ごとに繰り返されるため名称で識別。横長の自己評価・実施状況・金額は未分離。');out.push(p);}
 }

 if(input.municipalityCode==='07501'&&input.sourceId==='bc5b06a13317fb6184b51600'){
 const heads=[...input.text.matchAll(/^平成 24 年度教育委員会点検・評価表（平成 23 年度事業実施状況）$/gm)];
 const allowed=new Set([0,2,4,5,7,8,10,11,14,15]);
 for(let i=0;i<heads.length;i++){if(!allowed.has(i))continue;const start=heads[i].index!,raw=input.text.slice(start,heads[i+1]?.index??input.text.length).replace(/（別紙 2）\n?$/,'');const n=/1. 点検・評価項目 ([^\n]+)|1. 点検・評価項目\n([^\n]+)/.exec(raw);if(!n||!raw.includes('６．課題と改善'))continue;
 const name=(n[1]??n[2]).replace(/^\([12]\)\s*/,'');const p=base(input,name,2012,2011,raw,start);p.department=/担当係 ([^\n]+)/.exec(raw)?.[1]??null;p.warnings.push('平成24年度評価・平成23年度実施の独立票。教育委員全般活動、複数施設整備、体育振興、ICTと英語の束等は除外。費用・実績値の細分化は未実施。');out.push(p);}
 }

 if(input.municipalityCode==='15213'&&input.sourceId==='d49ce997f23e373d6ae67d67'){
 const heads=[...input.text.matchAll(/^点検項目 (.+)$/gm)];
 const normalize=(s:string)=>s.normalize('NFKC').replaceAll(' ','');
 for(const h of heads){const start=h.index!,end=input.text.indexOf('】',input.text.indexOf('【所管：',start));if(end<0)continue;const raw=input.text.slice(start,end+1);const p=base(input,h[1],null,2024,raw,start);p.department=/【所管：(.+)】/.exec(raw)?.[1]??null;p.warnings.push('令和6年度対象の独立点検項目票。外部委員会開催は令和7年6〜7月だが表題は対象年度と解し評価実施年度は未確定。施設・活動を含む事業は原典の一評価単位を維持し、構成施設ごとに複製しない。費用・指標は未抽出。');out.push(p);}
 const from=input.text.indexOf('Ⅲ．教育委員会の事業一覧',1000);const until=input.text.indexOf('Ⅳ．教育委員会',from);const table=input.text.slice(from,until<0?input.text.length:until);
 const lines=[...table.matchAll(/^(\d+) (\S+(?:事業|費))(?: |$)[^\n]*/gm)];const counts=new Map<string,number>();for(const m of lines)counts.set(m[2],(counts.get(m[2])??0)+1);
 for(const m of lines){if(counts.get(m[2])!==1||out.some(p=>normalize(p.projectName)===normalize(m[2])))continue;const p=base(input,m[2],null,2024,m[0],from+m.index!);p.warnings.push('実施主要事業一覧から番号と同一行で完結する名称のみ部分抽出。評価票6件の再掲は除外。同名の小学校・中学校別行は分類列の欠落により両方保留。折返し名称・数値・実績文章の混線は未復元。');out.push(p);}
 }

 if(input.municipalityCode==='10523'&&['52bf4ca5c361627a5561f460','b06fa28ecf671be7293cf956'].includes(input.sourceId)){
 const fy=input.sourceId==='52bf4ca5c361627a5561f460'?2022:2021;
 for(const [begin,end,name] of [['(11) 安全安心な学校給食の提供','【生涯学習の充実】','安全安心な学校給食の提供'],['①行政区別生涯学習推進事業の奨励','②生涯学習指導者の有効利用','行政区別生涯学習推進事業の奨励']]){
 const start=input.text.indexOf(begin),stop=input.text.indexOf(end,start);if(start<0||stop<0)continue;const raw=input.text.slice(start,stop);const p=base(input,name,null,fy,raw,start);const grade=/^[Ａ-Ｄ]$/m.exec(raw);if(grade)p.ratings.push({kind:'self',label:'自己評価',value:grade[0],scale:null,evidence:evidence(input,raw,start)});p.warnings.push('対象年度の実施記述と単独評価が対応する給食運営・地区補助の項目を部分抽出。教育施策群全体は分割せず除外。評価実施年と金額は未確定。');out.push(p);}
 }
 if(input.municipalityCode==='36204'&&input.sourceId==='d69d8b4837ac44044cd56ad6'){
 for(const [code,next,name] of [['1-3-2','1-3-3','センター理科学習の拡充'],['1-3-3','1-3-4','天文教育関連事業の充実']]){const start=input.text.indexOf(code+' '),end=input.text.indexOf(next+' ',start);if(start<0||end<0)continue;const raw=input.text.slice(start,end);const p=base(input,name,2024,2023,raw,start);p.department='科学センター';p.warnings.push('科学センターの特定学習・観望事業の実施評価単位のみ部分抽出。左右の計画／実績列が交互に並ぶため全文根拠で保持し、数値・文章を別欄へ推測配分しない。');out.push(p);}
 }
 if(input.municipalityCode==='01585'&&input.sourceId==='b8cfca162d8d99c5bb2e5d35'){
 for(const name of ['生涯学習フェスティバルでの団体への支援','町民自らが企画・立案・運営する学習活動に対する支援','鉄道資料館整備事業に係る検討の推進']){const start=input.text.indexOf(name+' 評 価 ');if(start<0)continue;const end=input.text.indexOf('点検・評価項目及び評価',start);if(end<0)continue;const raw=input.text.slice(start,end);const p=base(input,name,null,2024,raw,start);const grade=/評 価 ([A-D])/.exec(raw);if(grade)p.ratings.push({kind:'self',label:'評価',value:grade[1],scale:null,evidence:evidence(input,raw,start)});p.warnings.push('令和6年度対象。報告は令和7年で評価実施年度は未確定。催事支援・活動補助・資料館検討の独立評価のみ抽出。後段の同項目再掲は追加せず、構想・検討を整備完了とみなさない。');out.push(p);}
 }
 if(input.municipalityCode==='07484'&&input.sourceId==='4265a5b9aa3eb45ca60de6b3'){
 for(const name of ['地域学校協働本部事業の活動充実','チャレンジスクール（こども未来塾への移行）','学校給食の充実','学習支援員の配置と活用','家庭教育学級の実践','学校運営協議会の運用（コミュニティースクール）']){const start=input.text.indexOf(name+' ');if(start<0)continue;const end=input.text.indexOf('\n',start);const raw=input.text.slice(start,end<0?input.text.length:end);if(!/ \d+ \d+ \d+ \d+$/.test(raw))continue;const p=base(input,name,null,2024,raw,start);p.warnings.push('令和6年度行動計画の特定事業行。末尾4列は未実施・検討中・進行中・実施済への回答分布であり、成果指標や確定評点へ変換しない。同じ協働本部の設置を別事業として重複追加しない。評価実施年は未確定。');out.push(p);}
 }
 if(input.municipalityCode==='07501'&&input.sourceId==='c7083160f3b6d9ef27e1da39'){
 const from=input.text.indexOf('Ⅳ 評価委員会からいただいた主な意見',1000);const body=input.text.slice(from);
 const names:Record<string,string>={'１':'教育委員会会議の実施状況','３':'学校統合の推進','５':'野木沢小学校校舎・耐震補強大規模改造事業','６':'学力向上推進事業の推進','７':'「いしかわ交流・連携」の推進','９':'放課後児童対策事業（放課後子ども教室）','１１':'公民館図書室利用の促進','１２':'埋蔵文化財出前体験学習事業'};
 const heads=[...body.matchAll(/^([１-９]|１[０-５]) (.+)$/gm)];for(let n=0;n<heads.length;n++){const h=heads[n],name=names[h[1]];if(!name)continue;const start=from+h.index!,raw=input.text.slice(start,from+(heads[n+1]?.index??body.indexOf('Ⅴ 点検・評価結果')));if(!raw.includes('①'))continue;const p=base(input,name,2018,2017,raw,start);p.warnings.push('平成29年度事業に対する平成30年度外部評価意見の個別項目のみ部分抽出。別冊の自己評価票は本資料にないため実績値・決算額を補完しない。複数事業をまとめた施策群は除外。');out.push(p);}
 }
 return out;
}
