import{reviewNanao}from'./descending-ishikawa-nanao';
import{reviewKaga}from'./descending-ishikawa-kaga';
import{reviewNonoichi}from'./descending-ishikawa-nonoichi';
import{reviewUchinada}from'./descending-ishikawa-uchinada';
import{reviewNakanoto}from'./descending-ishikawa-nakanoto';
import{reviewFukuiEducation}from'./descending-fukui-education';
import{reviewTsuruga}from'./descending-fukui-tsuruga';
import{reviewOoi2017}from'./descending-fukui-ooi-2017';
import{reviewOoi}from'./descending-fukui-ooi';
import{reviewYamanashiPolicy}from'./descending-yamanashi-policy';
import{reviewYamanashiInitial}from'./descending-yamanashi-initial';
import{reviewNagisoRoads}from'./descending-nagano-roads';
import{reviewSuwaTourism}from'./descending-nagano-suwa-tourism';
import{reviewYasuoka2018}from'./descending-nagano-yasuoka-2018';
import{reviewNamedGrantPeriods}from'./descending-nagano-named-grant-periods';
import{reviewTenryuKpi}from'./descending-nagano-tenryu-kpi';
import{reviewAsahiExternal}from'./descending-nagano-asahi-external';
import{reviewAsahiKpi}from'./descending-nagano-asahi-kpi';
import{reviewUeda}from'./descending-nagano-ueda';
import{reviewOkayaProgress}from'./descending-nagano-okaya-progress';
import{reviewTatsunoExtra}from'./descending-nagano-tatsuno-extra';
import{reviewOkayaMore}from'./descending-nagano-okaya-more';
import{reviewNagisoMore}from'./descending-nagano-nagiso-more';
import{reviewOkaya}from'./descending-nagano-okaya';
import{reviewKoumi}from'./descending-nagano-koumi';
import{reviewIijima2021Extra}from'./descending-nagano-iijima-2021-extra';
import{reviewKawakami}from'./descending-nagano-kawakami';
import{reviewSakuho}from'./descending-nagano-sakuho';
import{reviewKaruizawa}from'./descending-nagano-karuizawa';
import{reviewTateshina}from'./descending-nagano-tateshina';
import{reviewKomagane}from'./descending-nagano-komagane';
import{reviewIijima2021}from'./descending-nagano-iijima-2021';
import{reviewIijimaSheets}from'./descending-nagano-iijima-sheet';
import{reviewTakamori}from'./descending-nagano-takamori';
import{reviewShimojo}from'./descending-nagano-shimojo';
import{reviewTenryu}from'./descending-nagano-tenryu';
import{reviewYasuoka}from'./descending-nagano-yasuoka';
import{reviewKisoNext}from'./descending-nagano-kiso-next';
import{reviewToyooka}from'./descending-nagano-toyooka';
import{reviewOshika}from'./descending-nagano-oshika';
import{reviewNagisoNext}from'./descending-nagano-nagiso-next';
import{reviewKiso}from'./descending-nagano-kiso';
import{reviewNagiso}from'./descending-nagano-nagiso';
import{reviewStrategy}from'./descending-nagano-strategy';
import{reviewNaganoGrants}from'./descending-nagano-grants';
import{reviewNaganoInitial}from'./descending-nagano-initial';
import{reviewGifuTail}from'./descending-gifu-tail';
import{reviewGifuActivities}from'./descending-gifu-activities';
import{reviewMizuhoPrimary}from'./descending-gifu-mizuho';
import{reviewGifuEducationNames}from'./descending-gifu-education';
import{reviewKaniMizunami}from'./descending-gifu-council';
import{reviewGifuNext}from'./descending-gifu-bounded';
import{reviewGifu}from'./descending-gifu-shirakawa';
import{reviewMitake}from'./descending-gifu-mitake';
import{reviewTomika}from'./descending-gifu-tomika';
import {reviewIwata} from './descending-iwata';
import {reviewMori} from './descending-mori';
import {reviewShizuokaSheets} from './descending-shizuoka-sheets';
import {reviewAichi} from './descending-aichi';
import {reviewMie} from './descending-mie';
import {reviewShiga} from './descending-shiga';
import {reviewKyoto} from './descending-kyoto';
import {reviewOsaka} from './descending-osaka';
import {reviewHyogo} from './descending-hyogo';
import {reviewNara} from './descending-nara';
import {reviewWakayama} from './descending-wakayama';
import {reviewTottori} from './descending-tottori';
import {reviewShimane} from './descending-shimane';
import {reviewOkayama} from './descending-okayama';
import {reviewHiroshima} from './descending-hiroshima';
import {reviewYamaguchi} from './descending-yamaguchi';
import {reviewTokushima} from './descending-tokushima';
import {reviewKagawa} from './descending-kagawa';
import {reviewEhime} from './descending-ehime';
import {reviewKochi} from './descending-kochi';
import {reviewFukuoka} from './descending-fukuoka';
import {reviewSaga} from './descending-saga';
import {reviewNagasaki} from './descending-nagasaki';
import {reviewKumamoto} from './descending-kumamoto';
import {reviewOitaRelated} from './descending-oita-related';
import {reviewOitaNamed} from './descending-oita-named';
import {reviewOitaGrants} from './descending-oita-grants';
import {reviewBungoKpi} from './descending-bungotakada-kpi';
import {reviewTaketaR2} from './descending-taketa-r2';
import {reviewBungotakada} from './descending-bungotakada';
import {reviewOitaR2} from './descending-oita-r2';
import {reviewMiyazakiList} from './descending-miyazaki-list';
import {reviewShintomiR2} from './descending-shintomi-r2';
import {reviewMiyazakiR2} from './descending-miyazaki-r2';
import {reviewKagoshimaWraps} from './descending-kagoshima-wraps';
import {reviewSouthernLiterals} from './descending-south-literals';
import {reviewKirishimaList} from './descending-kirishima-list';
import {reviewMinamikyushu} from './descending-minamikyushu';
import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {satsumaRows} from './descending-satsuma-map';
import {nagashimaRows} from './descending-nagashima-map';
import {type CachedInput,evidence,project} from './shared';
export interface LayoutReview {projects:ProjectEvaluation[];units:{start:number;name?:string;status:string;reason:string}[];status:string;reason:string;proofs:string[]}
const evidenceHolds:Record<string,{code:string;proof:string;reason:string;status:string}>={
"eff744cc7bee83b7cfbb024f":{"code": "46303", "status": "annual_identity_hold", "reason": "KPI/policy matrix mixes2017 actual events and2018/2019 plans without an annual report/evaluation date or separately bounded business sheets. Baseline H27 is not an evaluation year.", "proof": "三島村まち・ひと・しごと創生総合戦略効果検証検討結果\n重要業績評価指標（KPI）\n\n基本\n目標\n\n主な施策\n\n主な取組内容\n\n災害に強い住環境の整備\n\n評価指標\n\n基準値\n[H27年度]\n\n目標値\n\n"},
"6ae59ba0a765273d1049bf2b":{"code": "46225", "status": "excluded_policy_summary", "reason": "Aggregate progress and narrative by seven reform policies; the230 and625 detailed reform-item registers are referenced but not included. Counts and policy chapters are not individual business identities.", "proof": "第２次姶良市行政改革大綱\n実施計画\n平成 29 年度実績報告\n平成 31 年３月\n\n行政管理課\n\n\n目次\nⅠ 趣 旨.........................................."},
"5c2003fec901762bec5551a6":{"code": "46218", "status": "excluded_counts", "reason": "Department counts total536; no business names. The corresponding complete536-row list has been processed independently.", "proof": "令和７年度に公表する令和６年度に実施した事\n務事業の一覧（課別件数）\n令和７年度事務事業評価シート\n作成担当課等\n市長公室秘書広報課 4\n市長公室安心安全課 18\n市長公室ジオパーク推進課 1\n総務部"},
"ab2ccfd975cf203486497045":{"code": "46218", "status": "excluded_counts", "reason": "Department counts total530; no business names. The corresponding complete530-row list has been processed independently.", "proof": "令和８年度に公表する令和７年度に実施した事\n務事業の一覧（課別件数）\n令和８年度事務事業評価シート\n作成担当課等\n市長公室秘書広報課 5\n市長公室安心安全課 18\n市長公室ジオパーク推進課 1\n総務部"},
"2ad547ffddd30782bd3a4ebc":{"code": "46216", "status": "excluded_area_indicator_report", "reason": "2009 area-level follow-up with five indicators and combined housing/road/park effects. No independently named evaluated business sheet; do not assign the area evaluation date to constituent projects mentioned in prose.", "proof": "様式４\n\nまちづくり交付金 フォローアップ報告書\nい\n\nじ\n\nゅ\n\nう\n\nい\n\nん\n\n・\n\nみ\n\nょ\n\nう\n\nえ\n\nん\n\nじ\n\nち\n\nく\n\n伊集院・妙円寺地区\n\n平成２１年６月\n鹿児島県日置市\n\n\n１"},
"6e993ce2ad2b82148743d055":{"code": "46216", "status": "annual_identity_hold", "reason": "Multiyear2004–2008 area settlement with constituent facilities and fragmented start/end columns. No explicit evaluation year or uniquely bounded annual execution sheet. Need per-project period evidence, not a guessed allocation of multiyear spending.", "proof": "せ い さ ん ほ う こ く\n\n都市再生整備計画（精算報告）\nい じ ゅ う い ん\n\nみょう え ん\n\nじ\n\n伊集院・妙円寺地区\n\nか ご し ま けん\n\nひ お き\n\nし\n\n鹿児島県 日置市\n\n"},
"376e2039854cdefeecebdd31":{"code": "46213", "status": "excluded_template", "reason": "Annotated instructions and example policy management form; example indicators/years are not actual business observations.", "proof": "施策マネジメントシート ～平成30年度の振り返りから2019年度の取組へ～\n①計画⇒実施 （Plan⇒Do）\n\n（５月中に記入）\n担当課\n\nまちづくり分野 くらし分野\n\n長期振興計画\nの位置づけ\n\n第"},
"b1b59d49ecaf583ae257582c":{"code": "46213", "status": "excluded_template", "reason": "Blank/annotated instructions for simplified business form; no actual evaluated business identity.", "proof": "事業名\n\n①\n\n計画\n\n総事業費\n\n（Plan）\n施策名\n\n長期振興計画\nの位置づけ\n\n②\n\n実施\n\n千円\n\n基本事業名\n\n第6次長期振興計画の政策体系上の位置づ\nけを記載しています\n\n（Do）\n\n事"},
"6e2bd2e8f9b27fe61e3c9469":{"code": "46208", "status": "excluded_counts", "reason": "Evaluation outcome counts by category; individual business names absent.", "proof": "１ 施策評価結果\n総合評価（達成度）\nA B C D 合計\n事業数（件） 15 15 2 1 33\n構成比（％） 46 46 6 3 100\n※評価（達成度）は指標の目標値に対する実績値の達成度により"},
"70c13df9e9455385ca78fd43":{"code": "46201", "status": "excluded_policy_summary", "reason": "Evaluation process/calendar and aggregate findings; explicitly refers readers to separate policy sheets. No individual business sheets in this overview.", "proof": "令和 7 年度 行政評価（施策評価・事務事業評価）について\n１１行政評価（概要）\n(1) 目 的 本市総合計画の効率的かつ計画的な推進に資するとともに、市民の視点に立った\n成果重視型の行財政運営の実現"},
 'd94500c0b4c9d3fc3f851b32':{code:'46535',proof:'第６次総合振興計画総括評価（令和４年度～令和５年度(第1期)）（内部評価用）',status:'annual_identity_hold',reason:'Two-year policy/project matrix: named subactivities, agency cells and annual/combined costs interleave. No unique evaluation year or individually bounded annual project sheet. Need source-bound project/year mapping or original table coordinates; no numeric or annual identity inferred.'},
 '6d6231546f2839a239a3054f':{code:'46529',proof:'指標名（KPI）',status:'excluded_indicator_table',reason:'31 strategy KPI rows (enterprise counts, employment, etc.), not independent business identities. KPI indicators cannot become business records.'},
 '63a73dfce5257c92f321181b':{code:'46523',proof:'第六次大和村総合振興計画',status:'excluded_policy_plan',reason:'Comprehensive development policy/conditions text; no business-name labels or actual-results labels in the complete saved text. Annual individual evaluation identities are absent.'},
 '0bdf3b7ed3dd422f81df12d2':{code:'46505',proof:'屋久島町公共施設個別計画',status:'excluded_facility_plan',reason:'Facility-condition and utilization assessment/maintenance plan, not individual annual business evaluations. Do not turn facilities or planned repairs into executed project records.'},
 'c5410daadda697a5969dba23':{code:'46468',proof:'③R５,R６の累計給付金額',status:'annual_identity_hold',reason:'Six rows mix R5/R6 cumulative benefit amounts, administrative/benefit components, and R7 allocations. No unique execution/evaluation year in the saved body; tax/reference-year names are not execution years. Requires source-bound per-row period/identity evidence, not a new network route.'},
 '0a23c81c6c6ae8a10e4fd6cd':{code:'46492',proof:'２．2020 年度実績（\n「宇宙乃浦」創生・「スペースサイエンスタウン構想」実現プロジェクト）',status:'joint_project_identity_hold',reason:'2020 actual report jointly covers two named projects with shared activities/budget, followed by2021 plans and forecast KPI cells. Individual allocation and boundaries are absent; do not split or assign shared figures.'}
};
export function reviewDescendingLayout(input:CachedInput,inputs:CachedInput[]=[]):LayoutReview|null{
 const kisoReview=reviewKiso(input,inputs);if(kisoReview)return kisoReview;
 const nagisomoreReview=reviewNagisoMore(input);if(nagisomoreReview){const prior=reviewNagisoNext(input),roads=reviewNagisoRoads(input);if(!prior||!roads||prior.status==='source_integrity_hold'||nagisomoreReview.status==='source_integrity_hold'||roads.status==='source_integrity_hold')return {projects:[],units:[],proofs:[],status:'source_integrity_hold',reason:'All three source reviews must pass'};return {...prior,projects:[...prior.projects,...nagisomoreReview.projects,...roads.projects],units:[...prior.units,...nagisomoreReview.units,...roads.units]};}
 const nagisonextReview=reviewNagisoNext(input);if(nagisonextReview)return nagisonextReview;
 const oshikaReview=reviewOshika(input);if(oshikaReview)return oshikaReview;
 const toyookaReview=reviewToyooka(input,inputs);if(toyookaReview)return toyookaReview;
 const kisonextReview=reviewKisoNext(input);if(kisonextReview)return kisonextReview;
 const yasuokaReview=reviewYasuoka(input);if(yasuokaReview)return yasuokaReview;
 const tenryuReview=reviewTenryu(input,inputs);if(tenryuReview)return tenryuReview;
 const shimojoReview=reviewShimojo(input);if(shimojoReview)return shimojoReview;
 const takamoriReview=reviewTakamori(input);if(takamoriReview)return takamoriReview;
 const iijimasheetReview=reviewIijimaSheets(input);if(iijimasheetReview)return iijimasheetReview;
 const iijima2021extraReview=reviewIijima2021Extra(input);if(iijima2021extraReview){const prior=reviewIijima2021(input,inputs)!;if(prior.status==='source_integrity_hold'||iijima2021extraReview.status==='source_integrity_hold')return {projects:[],units:[],proofs:[],status:'source_integrity_hold',reason:'Both source reviews must pass'};return {...prior,projects:[...prior.projects,...iijima2021extraReview.projects],units:[...prior.units,...iijima2021extraReview.units]};}
 const iijima2021Review=reviewIijima2021(input,inputs);if(iijima2021Review)return iijima2021Review;
 const komaganeReview=reviewKomagane(input);if(komaganeReview)return komaganeReview;
 const tateshinaReview=reviewTateshina(input);if(tateshinaReview)return tateshinaReview;
 const karuizawaReview=reviewKaruizawa(input);if(karuizawaReview)return karuizawaReview;
 const sakuhoReview=reviewSakuho(input);if(sakuhoReview)return sakuhoReview;
 const kawakamiReview=reviewKawakami(input);if(kawakamiReview)return kawakamiReview;
 const koumiReview=reviewKoumi(input);if(koumiReview)return koumiReview;
 const okayamoreReview=reviewOkayaMore(input);if(okayamoreReview){const prior=reviewOkaya(input)!;if(prior.status==='source_integrity_hold'||okayamoreReview.status==='source_integrity_hold')return {projects:[],units:[],proofs:[],status:'source_integrity_hold',reason:'Bothsource reviews must pass'};return {...prior,projects:[...prior.projects,...okayamoreReview.projects],units:[...prior.units,...okayamoreReview.units]};}
 const okayaReview=reviewOkaya(input);if(okayaReview)return okayaReview;
 const tatsunoextraReview=reviewTatsunoExtra(input);if(tatsunoextraReview)return tatsunoextraReview;
 const okayaprogressReview=reviewOkayaProgress(input);if(okayaprogressReview)return okayaprogressReview;
 const uedaReview=reviewUeda(input);if(uedaReview)return uedaReview;
 const asahiKpiReview=reviewAsahiKpi(input,inputs);if(asahiKpiReview)return asahiKpiReview;
 const asahiexternalReview=reviewAsahiExternal(input,inputs);if(asahiexternalReview)return asahiexternalReview;
 const tenryukpiReview=reviewTenryuKpi(input,inputs);if(tenryukpiReview)return tenryukpiReview;
 const namedgrantperiodsReview=reviewNamedGrantPeriods(input);if(namedgrantperiodsReview)return namedgrantperiodsReview;
 const yasuoka2018Review=reviewYasuoka2018(input);if(yasuoka2018Review)return yasuoka2018Review;
 const suwaTourismReview=reviewSuwaTourism(input);if(suwaTourismReview)return suwaTourismReview;
 const yamanashiinitialReview=reviewYamanashiInitial(input);if(yamanashiinitialReview)return yamanashiinitialReview;
 const yamanashipolicyReview=reviewYamanashiPolicy(input);if(yamanashipolicyReview)return yamanashipolicyReview;
 const fukuiooiReview=reviewOoi(input);if(fukuiooiReview)return fukuiooiReview;
 const fukuiooi_2017Review=reviewOoi2017(input);if(fukuiooi_2017Review)return fukuiooi_2017Review;
 const fukuitsurugaReview=reviewTsuruga(input);if(fukuitsurugaReview)return fukuitsurugaReview;
 const fukuieducationReview=reviewFukuiEducation(input);if(fukuieducationReview)return fukuieducationReview;
 const ishikawanakanotoReview=reviewNakanoto(input);if(ishikawanakanotoReview)return ishikawanakanotoReview;
 const ishikawauchinadaReview=reviewUchinada(input);if(ishikawauchinadaReview)return ishikawauchinadaReview;
 const ishikawanonoichiReview=reviewNonoichi(input);if(ishikawanonoichiReview)return ishikawanonoichiReview;
 const ishikawakagaReview=reviewKaga(input);if(ishikawakagaReview)return ishikawakagaReview;
 const ishikawananaoReview=reviewNanao(input);if(ishikawananaoReview)return ishikawananaoReview;
 const grantsReview=reviewNaganoGrants(input);if(grantsReview)return grantsReview;
 const strategyReview=reviewStrategy(input);if(strategyReview)return strategyReview;
 const nagisoReview=reviewNagiso(input);if(nagisoReview)return nagisoReview;
 const nagano=reviewNaganoInitial(input);if(nagano)return nagano;
 const gifu=reviewGifuTail(input,inputs)??reviewGifuActivities(input)??reviewMizuhoPrimary(input)??reviewGifuEducationNames(input)??reviewKaniMizunami(input)??reviewGifuNext(input)??reviewGifu(input)??reviewMitake(input)??reviewTomika(input);if(gifu)return gifu;
 const shizuoka=reviewMori(input)??reviewShizuokaSheets(input)??reviewIwata(input);if(shizuoka)return shizuoka;
 const aichi=reviewAichi(input);if(aichi)return aichi;
 const mie=reviewMie(input);if(mie)return mie;
 const shiga=reviewShiga(input);if(shiga)return shiga;
 const kyoto=reviewKyoto(input,inputs);if(kyoto)return kyoto;
 const osaka=reviewOsaka(input,inputs);if(osaka)return osaka;
 const hyogo=reviewHyogo(input,inputs);if(hyogo)return hyogo;
 const nara=reviewNara(input,inputs);if(nara)return nara;
 const wakayama=reviewWakayama(input,inputs);if(wakayama)return wakayama;
 const tottori=reviewTottori(input,inputs);if(tottori)return tottori;
 const shimane=reviewShimane(input,inputs);if(shimane)return shimane;
 const okayama=reviewOkayama(input,inputs);if(okayama)return okayama;
 const hiroshima=reviewHiroshima(input,inputs);if(hiroshima)return hiroshima;
 const yamaguchi=reviewYamaguchi(input,inputs);if(yamaguchi)return yamaguchi;
 const tokushima=reviewTokushima(input,inputs);if(tokushima)return tokushima;
 const kagawa=reviewKagawa(input,inputs);if(kagawa)return kagawa;
 const ehime=reviewEhime(input,inputs);if(ehime)return ehime;
 const kochi=reviewKochi(input,inputs);if(kochi)return kochi;
 const fukuoka=reviewFukuoka(input,inputs);if(fukuoka)return fukuoka;
 const saga=reviewSaga(input,inputs);if(saga)return saga;
 const nagasaki=reviewNagasaki(input,inputs);if(nagasaki)return nagasaki;
 const kumamoto=reviewKumamoto(input,inputs);if(kumamoto)return kumamoto;
 const related=reviewOitaRelated(input);if(related)return related;
 const named=reviewOitaNamed(input);if(named)return named;
 const grants=reviewOitaGrants(input);if(grants)return grants;
 if(input.municipalityCode==='46392'&&satsumaRows.some(r=>r.sourceId===input.sourceId)&&input.format==='pdf')return reviewSatsuma(input);
 if(input.municipalityCode==='46404'&&input.sourceId==='dd96103fb0b585d0826a5bda'&&input.format==='pdf')return reviewNagashima(input);
 if(input.municipalityCode==='46501'&&input.sourceId==='3c7ba97b8a20f7cbe62c263c'&&input.format==='pdf')return reviewNakatane(input);
 const kpi=reviewBungoKpi(input);if(kpi)return kpi;
 const taketa=reviewTaketaR2(input);if(taketa)return taketa;
 const bungo=reviewBungotakada(input,inputs);if(bungo)return bungo;
 const oita=reviewOitaR2(input);if(oita)return oita;
 const ml=reviewMiyazakiList(input);if(ml)return ml;
 const shintomi=reviewShintomiR2(input);if(shintomi)return shintomi;
 const miya=reviewMiyazakiR2(input,inputs);if(miya)return miya;
 const kago=reviewKagoshimaWraps(input,inputs);if(kago)return kago;
 const southern=reviewSouthernLiterals(input);if(southern)return southern;
 const kiri=reviewKirishimaList(input);if(kiri)return kiri;
 const minami=reviewMinamikyushu(input);if(minami)return minami;
 const hold=evidenceHolds[input.sourceId];if(hold&&input.municipalityCode===hold.code&&input.format==='pdf'&&!input.truncated&&input.text.includes(hold.proof))return{projects:[],units:[{start:input.text.indexOf(hold.proof),status:hold.status,reason:hold.reason}],status:hold.status,reason:hold.reason,proofs:[hold.proof]};
 if(input.municipalityCode==='46527'&&input.sourceId==='487dd601c42252165049bdc3'&&input.format==='pdf')return reviewTatsugo(input);
 if(input.municipalityCode!=='46525'||input.sourceId!=='3f37aaff32d9a416a01a89da'||input.format!=='pdf')return null;
 const result:LayoutReview={projects:[],units:[],status:'reviewed_individual_sheets',reason:'Each saved annual business sheet has a disposition; account labels are not business titles',proofs:[]};
 if(input.truncated){result.status='missing_complete_body';result.reason='Complete source required';return result;}
 const heading='（令和３年度分）第２期「瀬戸内町まち・ひと・しごと創生総合戦略」における評価・検証';
 const heads=[...input.text.matchAll(new RegExp(heading,'g'))];
 if(!heads.length){result.status='annual_identity_hold';result.reason='Exact annual source heading absent';return result;}
 const pending:{p:ProjectEvaluation;u:LayoutReview['units'][number]}[]=[];
 for(let n=0;n<heads.length;n++){
  const start=heads[n].index!,body=input.text.slice(start,heads[n+1]?.index??input.text.length),names=[...body.matchAll(/^事業名\n/gm)];
  const u={start,name:undefined as string|undefined,status:'held',reason:''};result.units.push(u);
  if(names.length!==1||!body.includes('【評価】')||!body.includes('【経費内訳】')||!body.includes('施策の目的')){u.reason='Individual name/evaluation/expense/purpose boundaries incomplete or multiple';continue;}
  const tail=body.slice(names[0].index!+names[0][0].length);
  const lines=tail.split('\n');let name='';
  for(const line of lines){if(!line.trim()||line==='会計名'||/^令和３年度$/.test(line)||/^(巡回診療施設|船舶交通事業)特別会計$/.test(line))continue;name=line.trim();break;}
  u.name=name;
  if(!name||/^(施策|具体的|一般会計|特別会計)|^令和|^会計/.test(name)||name.length>130){u.reason='No unambiguous business title after excluding explicit account labels';continue;}
  const rawStart=start+names[0].index!,rawEnd=start+names[0].index!+names[0][0].length+tail.indexOf(name)+name.length;
  const p=project(input,'sheet-'+start,name,null,input.text.slice(rawStart,rawEnd),rawStart);p.projectCode=null;p.evaluatedFiscalYear=2021;
  p.evidence.push(evidence(input,heading,start));p.warnings.push('総合戦略冊子内で「事業名」「令和３年度分」「経費内訳」「評価」を備えた独立事業票。名称と対象年度のみ抽出。会計名・施策項目番号を事業名／事業番号に転用せず、将来目標・予算を実績にしない。');pending.push({p,u});
 }
 const norm=(s:string)=>s.normalize('NFKC').replace(/\s/g,'');
 for(const {p,u}of pending){if(pending.filter(q=>norm(q.p.projectName)===norm(p.projectName)).length>1){u.reason='Same name/year appears on multiple distinct sheets; purpose/identity needs explicit reconciliation';continue;}u.status='supported';u.reason='Explicit annual individual sheet; no financial or indicator alignment inferred';result.projects.push(p);}
 result.proofs=[heading];return result;
}
export function extractDescendingLayouts(input:CachedInput,inputs:CachedInput[]=[]):ProjectEvaluation[]{return reviewDescendingLayout(input,inputs)?.projects??[];}

/** Historical implementation tables only; excludes the plan's future provision tables and KPI chapters. */
function reviewTatsugo(input:CachedInput):LayoutReview{
 const r:LayoutReview={projects:[],units:[],status:'reviewed_annual_implementation_tables',reason:'Historical named business tables, not future plan chapters; annual numeric columns intentionally omitted',proofs:[]};
 const begin='基本目標ごとの主な事業・取組の実施状況',endLabel='基本目標ごとの評価指標達成状況',start=input.text.lastIndexOf(begin),end=input.text.indexOf(endLabel,start);
 if(input.truncated||start<0||end<=start){r.status='missing_complete_body';r.reason='Bounded historical implementation chapter absent';return r;}
 const text=input.text.slice(start,end),heads=[...text.matchAll(/^([^\n]+)（([^）\n]*(?:課|委員会))）$|^(放課後児童クラブ（学童保育）)\n（(子ども子育て応援課)）$/gm)];
 for(let n=0;n<heads.length;n++){
  const h=heads[n],offset=start+h.index!,body=text.slice(h.index!,heads[n+1]?.index??text.length),name=h[1]??h[3],department=h[2]??h[4],u={start:offset,name,status:'held',reason:''};r.units.push(u);
  if(name.startsWith('（再掲）')){u.status='duplicate';u.reason='Explicit reprint of a preceding named table';continue;}
  if((body.match(/^実績$/gm)??[]).length!==1||!body.includes('概要')){u.reason='Historical overview and actual-results boundary not unique';continue;}
  const years=['２','３','４','５'];if(years.some(y=>(body.match(new RegExp('^令和'+y+'年度$','gm'))??[]).length!==1)){u.reason='Four explicit historical fiscal-year headings not uniquely bounded';continue;}
  for(let j=0;j<years.length;j++){
   const fy=2020+j,label='令和'+years[j]+'年度',m=new RegExp('^'+label+'$','m').exec(body)!;
   const p=project(input,'implementation-'+offset+'-'+fy,name,null,h[0],offset);p.projectCode=null;p.evaluatedFiscalYear=fy;p.department=department;
   p.evidence.push(evidence(input,label,offset+m.index),evidence(input,begin,start),evidence(input,'実績',offset+body.indexOf('実績')));
   p.warnings.push('第３期計画のうち第２期の事業別実施状況表に明記された令和２〜５年度。将来計画・政策章・KPI表は対象外。年度別名称のみで、列位置が乱れた実績値・費用・評価点は未収録。空欄やゼロから実施の有無を推測しない。');r.projects.push(p);
  }
  u.status='supported';u.reason='Four explicitly labelled annual scopes; no inferred indicator/year alignment';
 }
 r.proofs=[begin,endLabel];return r;
}

function reviewNakatane(input:CachedInput):LayoutReview{
 const r:LayoutReview={projects:[],units:[],status:'reviewed_infrastructure_element',reason:'One named constituent road project; evaluation year is explicit and implementation fiscal year remains null',proofs:[]};
 const name='(2)下馬通線・野間工区',code='A01‑001',date='事後評価の実施時期\n令和5年2月',period='平成３１年度\n\n〜\n\n令和０４年度';
 if(input.truncated||![name,code,date,period,'要素となる事業名'].every(q=>input.text.includes(q))){r.status='identity_hold';r.reason='Required constituent-project name/code, evaluation date or period missing';return r;}
 const p=project(input,code,name,2023,name);p.evaluatedFiscalYear=null;p.evidence.push(evidence(input,code),evidence(input,date),evidence(input,period));p.warnings.push('社会資本整備計画の単一要素事業。事後評価実施は令和5年2月、事業期間は平成31〜令和4年度。計画名を個別事業名に転用せず、複数年の全体事業費118百万円を単年度決算として収録しない。');r.projects.push(p);r.units.push({start:input.text.indexOf(name),name,status:'supported',reason:r.reason});r.proofs=[date,period];return r;
}

function reviewNagashima(input:CachedInput):LayoutReview{
 const r:LayoutReview={projects:[],units:[],status:'reviewed_grant_title_rows',reason:'All45 grant rows accounted for; columns for amounts, departments and outcomes remain unassigned',proofs:['令和４年度']};
 if(input.truncated||!input.text.startsWith('令和４年度\n')||!input.text.includes('新型コロナウイルス対応地方創生臨時交付金を活用した事業の効果検証')){r.status='annual_identity_hold';r.reason='Complete annual grant report required';return r;}
 for(const row of nagashimaRows){
  if(row.raw===undefined||row.start===undefined||row.name===undefined){r.units.push({start:0,name:'row '+row.unit,status:'held',reason:'Reviewed title mapping is incomplete'});continue;}
  if(input.text.slice(row.start,row.start+row.raw.length)!==row.raw){r.units.push({start:row.start,name:row.name,status:'held',reason:'Reviewed literal title fragment or offset differs'});continue;}
  const p=project(input,'title-'+row.unit,row.name,null,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=2022;p.evidence.push(evidence(input,'令和４年度',0));p.warnings.push('令和４年度交付金効果検証の事業名欄を個別確認。折返し名称のみ連結し、項番・担当・金額・実績との列対応は推測しない。15番は名称欄の複合表記を原文どおり1項目として保持。26/27番は交付金制度名ではなく明記された実施事業名を使用。');r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:'Literal name and annual report scope verified; no cross-column financial alignment'});
 }return r;
}

function reviewSatsuma(input:CachedInput):LayoutReview{
 const r:LayoutReview={projects:[],units:[],status:'reviewed_grant_title_fragments',reason:'Specific title fragments mapped; no number-to-name/amount-column inference',proofs:[]};
 if(input.truncated){r.status='annual_identity_hold';r.reason='Complete annual report absent';return r;}
 for(const row of satsumaRows.filter(r=>r.sourceId===input.sourceId)){
  if(input.text.slice(row.start,row.start+row.raw.length)!==row.raw){r.units.push({start:row.start,name:row.name,status:'held',reason:'Exact reviewed fragments differ'});continue;}
  const p=project(input,'title-'+row.start,row.name,null,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=row.year;const label='令和'+String(row.year-2018).replace(/\d/g,d=>'０１２３４５６７８９'[+d])+'年度';if(!input.text.includes(label))throw new Error('Reviewed source year missing');p.evidence.push(evidence(input,label));r.proofs.push(label);p.warnings.push('事業名欄の折返しを原文の文字列から個別に復元。項番・金額・所管との対応は推測しない。実績・評価本文にある将来見込や補助額を決算へ転用しない。');r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:'Reviewed literal name and document fiscal scope'});
 }
 if(input.sourceId==='3b42ea94c6ad2ff4091041ec'){r.units.push({start:input.text.indexOf('光ブロードバンド基盤整'),status:'held',reason:'Broadband report has two funding components for one shared infrastructure implementation; independent project identity is unresolved without table geometry.'},{start:input.text.indexOf('学校保健特別対策事業'),status:'held',reason:'Two same-title school health subsidy rows and split camera/microphone funding cannot safely be converted into separate annual project identities. Need explicit identity/parent-child associations.'},{start:input.text.indexOf('令和４年度'),status:'excluded_forecast',reason:'FY2022 voucher row has empty actual/evaluation cells and expected allocation only; actual FY2022 voucher is independently documented in the later report.'});}
 else if(input.sourceId==='7f8013a83ccf1d2977ec6534'){r.units.push({start:input.text.indexOf('デジタル田園都市国家'),status:'held',reason:'This row names a grant programme; description covers multiple system installations. No unique implementation-project name; do not create a programme as a business.'});
 r.units.push({start:0,status:'held',reason:'Printed numbers run to20, but remaining number/name associations are not identifiable in interleaved text. Distinct further business identities require original table geometry or a source-bound name list; no guessed records.'});}
 else if(input.sourceId==='f7ebb002e6a580c53287a363')r.units.push({start:input.text.indexOf('低所得者世帯への事務費'),status:'duplicate_component',reason:'Benefit administrative spending belongs to the same named benefit scheme; no extra administrative-cost project created. Premium voucher already saved in previous tranche.'});
 else r.units.push({start:0,status:'held',reason:'Three benefit/tax-year rows include carried-over or cumulative payments and shared benefit/administrative components. Execution-year and project identity not uniquely established; retain no guessed annual records. Existing livestock FY2024 candidate preserved.'});return r;
}
