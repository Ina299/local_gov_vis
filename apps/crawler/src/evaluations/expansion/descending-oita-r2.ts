import {reviewOitaReports} from './descending-oita-reports';
import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput,project,evidence} from './shared';
export function reviewOitaR2(input:CachedInput):LayoutReview|null{
 const reports=reviewOitaReports(input);if(reports)return reports;
 const kuni=reviewKunisaki(input);if(kuni)return kuni;
 const hime=reviewHimeshima(input);if(hime)return hime;
 if(input.municipalityCode!=='44461'||input.sourceId!=='470d8bab6f9c499dfeefd122')return null;
 const header='第２期「九重町まち・ひと・しごと創生総合戦略」事業進捗表';
 const r:LayoutReview={projects:[],units:[],status:'reviewed_two_year_business_sheets',reason:'41 explicitly named business sheets with2020/2021 situation sections;2022–2024 plans/targets excluded from annual records',proofs:[header]};
 if(input.truncated||input.format!=='pdf'||!input.text.startsWith(header))return r;
 const hs=[...input.text.matchAll(/〔整理番号〕([０-９\d]+)/g)];if(hs.length!==41||hs.some((h,i)=>+h[1].normalize('NFKC')!==i+1)){r.status='layout_boundary_hold';r.reason='41 sequential complete sheet identifiers required';return r;}
 for(let j=0;j<hs.length;j++){
 const start=hs[j].index!,raw=input.text.slice(start,hs[j+1]?.index??input.text.length),name=/事 業 名\s+([^\n]+)/.exec(raw);
 if(!name||(raw.match(/^Ｒ２$/gm)??[]).length!==1||(raw.match(/^Ｒ３$/gm)??[]).length!==1||(raw.match(/^状況$/gm)??[]).length!==2||!raw.includes('2020 年度')||!raw.includes('2021 年度')||!raw.includes('取組')||!raw.includes('予定')){r.units.push({start,name:name?.[1],status:'held',reason:'Exact annual situation and future-plan boundaries missing'});continue;}
 for(const fy of [2020,2021]){const p=project(input,'situation-'+j+'-'+fy,name[1],null,name[0],start+name.index);p.projectCode=null;p.evaluatedFiscalYear=fy;p.evidence.push(evidence(input,raw,start));p.warnings.push('事業名欄のある独立進捗表。令和2・3年度の状況・課題欄がある2年度のみ。令和4年度以降の取組予定や2024目標値を実績として追加しない。年度別数値の列対応と累積/単年の分離は未確定のため金額・KPIは未収録。');r.projects.push(p);}
 r.units.push({start,name:name[1],status:'supported',reason:'Two explicit historical situation sections; names/year scopes only, no inferred per-year financial alignment'});
 }return r;
}

/** Reviewed named programs only; broad education policy and personnel/governance rows excluded. */
function reviewHimeshima(input:CachedInput):LayoutReview|null{
 if(input.municipalityCode!=='44322'||input.sourceId!=='31564eed127d9666250d6163')return null;
 const header='教育に関する事務の管理及び執行の状況の点検及び評価（平成31年4月～令和2年3月）';
 const names=[
 '公民館講座','高齢者教室の実施','家庭教育学級の実施','人権講演会','公民館図書室の事業','読み聞かせの会',
 '地域「協育力」向上支援事業','福祉体験教室','芸術鑑賞','高齢者との交流','地域との交流','ボランティア体験活動',
 '文化財防火訓練','文化祭の実施','文化財の管理',
 'パークゴルフ大会','グランドゴルフ大会','村長杯争奪地区対抗\n第３５回ナイターソフトボール大会',
 '村長杯争奪地区対抗\n第２７回ナイターゲートボール大会','村民体育大会','第２３回さわやかマラソン大会',
 '第２９回姫島村区長杯ゲートボール大会','県民すこやかスポーツ祭'];
 const r:LayoutReview={projects:[],units:[],status:'reviewed_named_education_programs',reason:'23 named education/culture/sport programs with explicit2019 annual reporting period. Broad policies, personnel, facility stock and generic teaching actions not promoted; no ratings/numbers aligned from flattened columns.',proofs:[header,'姫島村教育委員会']};
 if(input.truncated||input.format!=='pdf'||!input.text.includes(header)||!input.text.includes('姫島村教育委員会')){r.status='annual_identity_hold';r.reason='Complete village report and exact annual scope required';return r;}
 for(const raw of names){
 // A complete line prevents matching a shorter tournament title inside another title or narrative.
 const escaped=raw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const matches=[...input.text.matchAll(new RegExp('^(?:・)?'+escaped+'(?= \u30fb|$)','gm'))];
 if(matches.length!==1){r.units.push({start:0,name:raw,status:'held',reason:'Named program title is not uniquely bounded'});continue;}
 const start=matches[0].index!+(matches[0][0].startsWith('・')?1:0),p=project(input,'education-'+start,raw.replace(/\n/g,''),null,raw,start);p.projectCode=null;p.evaluatedFiscalYear=2019;p.evidence.push(evidence(input,header,input.text.indexOf(header)));
 p.warnings.push('教育委員会の年度点検表内の具体的事業・行事名。政策章・一般指導方針・施設一覧は除外。評価記号、参加者数、費用は列対応が確定していないため未収録。開催中止を含み、実施成功を意味しない。');r.projects.push(p);r.units.push({start,name:p.projectName,status:'supported',reason:'Explicit named annual program; shared outcome fields omitted'});
 }
 r.units.push({start:0,status:'excluded_policy_and_generic_actions',reason:'Education governance, teaching policy, staffing and equipment-stock headings do not establish independent program identities. Wrapped cultural-transmission subsidy needs a distinct source-bound title mapping; not guessed.'});
 return r;
}

function reviewKunisaki(input:CachedInput):LayoutReview|null{
 if(input.municipalityCode!=='44214'||input.sourceId!=='6345c171cf1e40e7691b3010')return null;
 const header='（令和５年４月～令和６年３月）',date='令和 ６年１０月２５日';
 const r:LayoutReview={projects:[],units:[],status:'reviewed_named_programs_with_scope_holds',reason:'24 explicitly named programs/works. Generic policy and teaching/governance actions excluded; shared and unnamed activity identities held separately. No shared figures or ratings allocated.',proofs:[header,date,'国東市教育委員会']};
 if(input.truncated||input.format!=='pdf'||![header,date,'国東市教育委員会'].every(x=>input.text.includes(x)))return r;
 const rows=[
 ['国東小学校校舎長寿命化改修工事（管理棟）','・国東小学校校舎長寿命化改修工事（管理棟）を\n行った。'],
 ['安岐小学校校舎改修工事及び富来小学校屋内運動場長寿命化改修工事の設計','・安岐小学校校舎改修工事及び富来小学校屋内運\n動場長寿命化改修工事の設計を行った。'],
 ['あかちゃんおはなし会','「あかちゃんおはなし会」9 回/年（参加：21 組）、'],
 ['おはなし会','「おはなし会」4 館とも月 1 回を目安に実施。（参\n加者：411 人）'],
 ["公営進学塾「国東夢道塾」", "公営進学塾「国東夢道塾」を運営し、"],
 ["放課後学習塾", "・安岐中学校に加え、国見中学校と国東中学校の\n３校が放課後学習塾に取り組んだ。"],
 ["中央公民館講座", "市民の生涯学習を推進するため、中央公民館講座\nを１３３講座開設した。"],
 ["文化芸能発表会（国見地域）", "文化芸能発表会（国見地域）"],
 ["総合文化祭（国東地域）", "総合文化祭（国東\n地域の活性化、地域リーダーを育成します。\n地域）"],
 ["カルティバル（武蔵地域）", "カルティバル（武蔵地域）"],
 ["公民館祭り（安岐地域）", "公民館祭り\n（安岐地域）を開催した。"],
 ["協育ネットワーク事業", "次世代を担う青少年を育成するため、協育ネット\nワーク事業に取り組んだ。"],
 ["レクリエーション大会", "①レクリエーション大会を１０月１５日に開催。"],
 ["新春書初め展", "②新春書初め展を開催。"],
 ["ナイターソフトボール", "ナイターソフトボール（6 月）"],
 ["プロスポーツ教室", "プロスポーツ教室（12 月：サッカー（トリ\nニータ選手））"],
 ["国見Ｂ＆Ｇ海洋センター改修（体育館・プール）", "国見\nＢ＆Ｇ海洋センター改修（体育館・プール）"],
 ["安岐テニスコート改修（オムニコート化、LED 照明化）", "安\n岐テニスコート改修（オムニコート化、LED 照明\n化）"],
 ["国東野球場改修設計", "国東\n野球場改修設計"],
 ["安岐体育館整備", "安岐体育館整備などを実施。"],
 ["地区人権学習会", "・地区人権学習会を開催した行政区（自治会等を\n含む）と参加者数"],
 ["身になる人権講座", "・身になる人権講座を以下の内容で開催しました。"],
 ["人権フェスティバル", "・旧 4 町毎に開催している人権フェスティバルは、"],
 ["第４７回全国遺跡環境整備会議", "全国から３６自治体が参加し、第４７回全国遺\n跡環境整備会議を開催した。"]
 ];
 for(const [name,raw]of rows){const start=input.text.indexOf(raw);if(start<0||input.text.indexOf(raw,start+1)!==-1){r.units.push({start:0,name,status:'held',reason:'Unique exact implementation evidence absent'});continue;}const p=project(input,'named-'+start,name,null,raw,start);p.projectCode=null;p.evaluatedFiscalYear=2023;p.evaluationYear=2024;p.evidence.push(evidence(input,header,input.text.indexOf(header)),evidence(input,date,input.text.indexOf(date)));p.warnings.push('年度報告内の明示された具体的取組名のみ。設計業務を工事完成と扱わず、政策単位の共通評価・費用・参加者数を各事業に配賦しない。');r.projects.push(p);r.units.push({start,name,status:'supported',reason:'Exact named implementation and annual/committee-date evidence; no allocated shared ratings'});}
 r.units.push({start:0,status:'individual_identity_hold',reason:'Childcare and gender-policy rows have only department names in implementation cells; broad teaching/governance policies and stock indicators do not identify independent businesses. Generic lectures, maintenance/equipment components and concert descriptions lack distinct project identities. Japanese-heritage joint subactivities and the Miura anniversary aggregate need an independent project/register mapping before splitting. Future2024 learning-card production is excluded. Named implementation review is complete; not a claim of complete program coverage.'});return r;
}
