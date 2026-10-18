import { extractNanjoSupplement } from './nanjo-supplement';
import { extractFinalNarrativesSupplement } from './final-narratives-supplement';
import { extractUtsunomiyaNarrativesSupplement } from './utsunomiya-narratives-supplement';
import { extractLongPolicyNarratives } from './long-policy-narratives';
import { extractHigashimatsuyamaSupplement } from './higashimatsuyama-supplement';
import { extractBizenSupplement } from './bizen-supplement';
import { extractBifukaSupplement } from './bifuka-supplement';
import { extractIiyamaSupplement } from './iiyama-supplement';
import { extractChiyodaMinutesSupplement } from './chiyoda-minutes-supplement';
import { extractEducationAssistSupplement } from './education-assist-supplement';
import { extractYotsukaidoSupplement } from './yotsukaido-supplement';
import { extractSuwaSupplement } from './suwa-supplement';
import { extractKawagoe2024Selected } from './kawagoe-supplement';
import { extractTowadaPlanSupplement } from './towada-plan-supplement';
import { extractIizukaRowsSupplement } from './iizuka-rows-supplement';
import { extractKusatsu } from './kusatsu';
import { extractMinamiashigaraPlanSupplement } from './minamiashigara-plan-supplement';
import { extractMatsusakaSupplement } from './matsusaka-supplement';
import { extractSagamiharaRowsSupplement } from './sagamihara-rows-supplement';
import { extractKoganeiRowsSupplement } from './koganei-rows-supplement';
import { extractTakahashiFoldedSupplement } from './takahashi-folded-supplement';
import { extractFuchuHiroshima } from './fuchu-hiroshima';
import { extractTsuruoka } from './tsuruoka';
import { extractAkashiListSupplement } from './akashi-list-supplement';
import { extractBibai } from './bibai';
import { extractToda2024 } from './toda-supplement';
import { extractHitaSupplement } from './hita-supplement';
import { extractHiroshimaReformProjects } from './hiroshima-reform-projects';
import { extractKurashiki2025 } from './kurashiki-supplement';
import { extractShiroi2016 } from './shiroi-supplement';
import { extractMiyakoExternalSupplement } from './miyako-external-supplement';
import { extractSaikiSupplement } from './saiki-supplement';
import { extractYoshikawaSupplement } from './yoshikawa-supplement';
import { extractIzumiRowsSupplement } from './izumi-rows-supplement';
import { extractFussaRowsSupplement } from './fussa-rows-supplement';
import { extractYamatoRowsSupplement } from './yamato-rows-supplement';
import { extractFukuiSupplement } from './fukui-supplement';
import { extractAssistEducationUnitsSupplement } from './assist-education-units-supplement';
import { extractYatsushiroCitizenSupplement } from './yatsushiro-citizen-supplement';
import { extractMakurazakiEducationSupplement } from './makurazaki-education-supplement';
import { extractNakaiListSupplement } from './nakai-list-supplement';
import { extractYufuSupplement } from './yufu-supplement';
import { extractReviewFiveLaterLists } from './review-five-later-lists';
import { extractFukutsuSupplement } from './fukutsu-supplement';
import { extractHokkaidoSingleSupplement } from './hokkaido-single-supplement';
import { extractBatch6HtmlOpinionsSupplement } from './batch6-html-opinions-supplement';
import { extractKofuSupplement } from './kofu-supplement';
import { extractTakahashiResultsSupplement } from './takahashi-results-supplement';
import { extractMoriya } from './moriya';
import { extractOkinoshima } from './okinoshima';
import { extractNarita } from './narita';
import { extractNaka } from './naka';
import { extractTorideSupplement } from './toride-supplement';
import { extractAsakawa } from './asakawa';
import { extractBatch6FinalRowsSupplement } from './batch6-final-rows-supplement';
import { extractNakama } from './nakama';
import { extractRokunohe } from './rokunohe';
import { extractUrumaFacilitySupplement } from './uruma-facility-supplement';
import { extractUrumaEducationSupplement } from './uruma-education-supplement';
import { extractYokoshibahikariListSupplement } from './yokoshibahikari-list-supplement';
import { extractShimotsukeListSupplement } from './shimotsuke-list-supplement';
import { extractHachiojiListSupplement } from './hachioji-list-supplement';
import { extractDaisenTottoriSupplement } from './daisen-tottori-supplement';
import { extractIsesakiListSupplement } from './isesaki-list-supplement';
import { extractReviewedPdfSupplement } from './reviewed-pdf-supplement';
import { extractMiyazakiSupplement } from './miyazaki-supplement';
import { extractWarabiSupplement } from './warabi-supplement';
import { extractFujikawa, extractFujikawa2019, extractFujikawa2013Subsidies } from './fujikawa';
import { extractUonumaSupplement } from './uonuma-supplement';
import { extractShimokawa } from './shimokawa';
import { extractReviewFiveAdditional } from './review-five-additional';
import { extractReviewFiveLists } from './review-five-lists';
import { extractBatch6SmallRowsSupplement } from './batch6-small-rows-supplement';
import { extractMusashinoSupplement } from './musashino-supplement';
import { extractKitahiroshima } from './kitahiroshima';
import { extractNagatoSupplement } from './nagato-supplement';
import { extractImizu } from './imizu';
import { extractKokubunjiSupplement } from './kokubunji-supplement';
import { extractMiharuSupplement } from './miharu-supplement';
import { extractSaiSupplement } from './sai-supplement';
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import type { CachedInput } from './shared';

import { extractKamakura } from './kamakura';
import { extractIkomaSupplement } from './ikoma-supplement';
import { extractKudamatsuSupplement } from './kudamatsu-supplement';

import { extractTaitoSupplement } from './taito-supplement';
import { extractTondabayashiSupplement, extractTondabayashi2025Missing } from './tondabayashi-supplement';
import { extractShunanSupplement } from './shunan-supplement';
import { extractAnamizu } from './anamizu';
import { extractShimantoSupplement, extractShimantoSummarySupplement } from './shimanto-supplement';
import { extractKagoshimaSupplement } from './kagoshima-supplement';
import { extractOtakeSupplement } from './otake-supplement';
import { extractMisawaCombinedSupplement } from './misawa-external-supplement';
import { extractReviewedHtmlSupplement } from './reviewed-html-supplement';
import { extractMiyakoSupplement } from './miyako-supplement';
import { extractFujiSupplement } from './fuji-supplement';
import { extractYasugiSupplement } from './yasugi-supplement';
import { extractTakahashiSupplement } from './takahashi-supplement';
import { extractAtsugi } from './atsugi';
import { extractMinami } from './minami';
import { extractTagami } from './tagami';
import { extractNamie } from './namie';
import { extractReviewFiveHtml } from './review-five-html';
import { extractReviewFiveSummaries } from './review-five-summaries';
import { extractTottoriSupplement, extractTottoriNamedRowsSupplement } from './tottori-supplement';
import { extractMarugameCombinedSupplement } from './marugame-legacy-supplement';
import { extractInaSupplement } from './ina-supplement';
import { extractBatch6TransportSupplement } from './batch6-transport-supplement';
import { extractBatch6RowsSupplement } from './batch6-rows-supplement';
import { extractChihayaakasakaSupplement } from './chihayaakasaka-supplement';
import { extractToin } from './toin';
import { extractMinamiaizu } from './minamiaizu';

/** Separate from the frozen first five extraction batches. */
export const supplementExtractors: Record<string, {
  extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[];
  scope: string;
}> = {
  '47215': { extract: extractNanjoSupplement, scope: '行政改革委員会の事業別総合評価・委託可否の一覧を構造化。対象年度と評価年を区別し、費用や実績値は推測しない。' },
  '08228': { extract: extractFinalNarrativesSupplement, scope: '独立事業の実施説明・所見を部分構造化。事前評価や複数年共同事業は各票に明記し、予測値を実績へ転用しない。' },
  '16321': { extract: extractFinalNarrativesSupplement, scope: '独立事業の実施説明・所見を部分構造化。事前評価や複数年共同事業は各票に明記し、予測値を実績へ転用しない。' },
  '08220': { extract: extractFinalNarrativesSupplement, scope: '独立事業の実施説明・所見を部分構造化。事前評価や複数年共同事業は各票に明記し、予測値を実績へ転用しない。' },
  '09201': { extract: extractUtsunomiyaNarrativesSupplement, scope: '具体的な事業別説明・実績の確定部分を構造化。施策全体の評価と区別し、未確定費用・年度は補わない。' },
  '40220': { extract: extractLongPolicyNarratives, scope: '施策下位の独立事業の評価・現状実績を部分構造化。施策全体の費用・将来計画目標を転用せず、不明年度は保持。' },
  '23201': { extract: extractLongPolicyNarratives, scope: '施策下位の独立事業の評価・現状実績を部分構造化。施策全体の費用・将来計画目標を転用せず、不明年度は保持。' },
  '34213': { extract: extractLongPolicyNarratives, scope: '施策下位の独立事業の評価・現状実績を部分構造化。施策全体の費用・将来計画目標を転用せず、不明年度は保持。' },
  '10212': { extract: extractLongPolicyNarratives, scope: '施策下位の独立事業の評価・現状実績を部分構造化。施策全体の費用・将来計画目標を転用せず、不明年度は保持。' },
  '11212': { extract: extractHigashimatsuyamaSupplement, scope: '施策下位の独立事業の評価・現状実績を部分構造化。施策全体の費用・将来計画目標を転用せず、不明年度は保持。' },
  '33211': { extract: extractBizenSupplement, scope: '施策下位の独立事業の評価・現状実績を部分構造化。施策全体の費用・将来計画目標を転用せず、不明年度は保持。' },
  '01469': { extract: extractBifukaSupplement, scope: '施策下位の独立事業の評価・現状実績を部分構造化。施策全体の費用・将来計画目標を転用せず、不明年度は保持。' },
  '20213': { extract: extractIiyamaSupplement, scope: '施策下位の独立事業の評価・現状実績を部分構造化。施策全体の費用・将来計画目標を転用せず、不明年度は保持。' },
  '13101': { extract: extractChiyodaMinutesSupplement, scope: '評価委員会議事録中の事業別行政説明を部分構造化。個票の評点とは区別し、不明の対象年度・費用は補わない。' },
  '02303': { extract: extractEducationAssistSupplement, scope: '教育の個別事業・実施単位の評価を部分構造化。政策全体の評点は転用せず、未確定年度と費用は補わない。' },
  '07484': { extract: extractEducationAssistSupplement, scope: '教育の個別事業・実施単位の評価を部分構造化。政策全体の評点は転用せず、未確定年度と費用は補わない。' },
  '01585': { extract: extractEducationAssistSupplement, scope: '教育の個別事業・実施単位の評価を部分構造化。政策全体の評点は転用せず、未確定年度と費用は補わない。' },
  '07501': { extract: extractEducationAssistSupplement, scope: '教育の個別事業・実施単位の評価を部分構造化。政策全体の評点は転用せず、未確定年度と費用は補わない。' },
  '15213': { extract: extractEducationAssistSupplement, scope: '教育の個別事業・実施単位の評価を部分構造化。政策全体の評点は転用せず、未確定年度と費用は補わない。' },
  '04208': { extract: extractEducationAssistSupplement, scope: '教育の個別事業・実施単位の評価を部分構造化。政策全体の評点は転用せず、未確定年度と費用は補わない。' },
  '36204': { extract: extractEducationAssistSupplement, scope: '教育の個別事業・実施単位の評価を部分構造化。政策全体の評点は転用せず、未確定年度と費用は補わない。' },
  '46203': { extract: extractEducationAssistSupplement, scope: '教育の個別事業・実施単位の評価を部分構造化。政策全体の評点は転用せず、未確定年度と費用は補わない。' },
  '10523': { extract: extractEducationAssistSupplement, scope: '教育の個別事業・実施単位の評価を部分構造化。政策全体の評点は転用せず、未確定年度と費用は補わない。' },
  '12228': { extract: extractYotsukaidoSupplement, scope: '原文の独立事業と評価・実施結果が対応する確定部分を構造化。年度・費用範囲の不明点と一次評価・外部意見の違いは各票に明記。' },
  '20206': { extract: extractSuwaSupplement, scope: '原文の独立事業と評価・実施結果が対応する確定部分を構造化。年度・費用範囲の不明点と一次評価・外部意見の違いは各票に明記。' },
  '11201': { extract: extractKawagoe2024Selected, scope: '原文の独立事業と評価・実施結果が対応する確定部分を構造化。年度・費用範囲の不明点と一次評価・外部意見の違いは各票に明記。' },
  '02206': { extract: extractTowadaPlanSupplement, scope: '原文の独立事業と評価・実施結果が対応する確定部分を構造化。年度・費用範囲の不明点と一次評価・外部意見の違いは各票に明記。' },
  '40205': { extract: extractIizukaRowsSupplement, scope: '原文の独立事業と評価・実施結果が対応する確定部分を構造化。年度・費用範囲の不明点と一次評価・外部意見の違いは各票に明記。' },
  '25206': { extract: extractKusatsu, scope: '施策内の主要事業一覧の確定評価行を構造化。全体版・分冊の同じ事業は根拠を統合し、施策全体の費用は転用しない。' },
  '14217': { extract: extractMinamiashigaraPlanSupplement, scope: '事業別評価行または独立実施事業の部分構造化。複数年計画の期間総括・活動指標評価は単年度の事業総合評価と区別する。' },
  '24204': { extract: extractMatsusakaSupplement, scope: '事業別評価行または独立実施事業の部分構造化。複数年計画の期間総括・活動指標評価は単年度の事業総合評価と区別する。' },
  '14150': { extract: extractSagamiharaRowsSupplement, scope: '事業別評価行または独立実施事業の部分構造化。複数年計画の期間総括・活動指標評価は単年度の事業総合評価と区別する。' },
  '13210': { extract: extractKoganeiRowsSupplement, scope: '事業別評価行または独立実施事業の部分構造化。複数年計画の期間総括・活動指標評価は単年度の事業総合評価と区別する。' },
  '34208': { extract: extractFuchuHiroshima, scope: '具体的な事業調書・事業別評価の確定部分を構造化。政策全体の評点は個別事業へ転用しない。' },
  '06203': { extract: extractTsuruoka, scope: '具体的な事業調書・事業別評価の確定部分を構造化。政策全体の評点は個別事業へ転用しない。' },
  '34209': { extract: extractReviewFiveLaterLists, scope: '一覧の事業名・評価・明示費用の確定部分を構造化。既存個票との重複と折返し名称断片を除外する。' },
  '28203': { extract: extractAkashiListSupplement, scope: '一覧の事業名・評価・明示費用の確定部分を構造化。既存個票との重複と折返し名称断片を除外する。' },
  '01215': { extract: extractBibai, scope: '一覧の事業名・評価・明示費用の確定部分を構造化。既存個票との重複と折返し名称断片を除外する。' },
  '11224': { extract: extractToda2024, scope: '施策末尾の独立事業の確定部分を構造化。親施策の数値・方向性は転用しない。' },
  '44204': { extract: extractHitaSupplement, scope: '施策下位の事業別評価行を部分構造化。同名再掲の証拠を統合し、施策全体の費用を個別事業へ配賦しない。' },
  '34100': { extract: extractHiroshimaReformProjects, scope: '一覧または施策・改革資料内の具体的な事業単位を部分構造化。政策全体の評価や成果は転用せず、未確定欄を保持。' },
  '33202': { extract: extractKurashiki2025, scope: '一覧または施策・改革資料内の具体的な事業単位を部分構造化。政策全体の評価や成果は転用せず、未確定欄を保持。' },
  '12232': { extract: extractShiroi2016, scope: '一覧または施策・改革資料内の具体的な事業単位を部分構造化。政策全体の評価や成果は転用せず、未確定欄を保持。' },
  '44205': { extract: extractSaikiSupplement, scope: '個別業務の民間委託等の改革検証を部分抽出。通常の予算事業個票とは異なり、対象期間不明は保持する。' },
  '11243': { extract: extractYoshikawaSupplement, scope: '既存票との名称照合後に追加する事業別評価の部分構造化。不明値は補わず原文根拠を保持。' },
  '46208': { extract: extractIzumiRowsSupplement, scope: '事業別一覧の明示評価欄を部分構造化。重点個票と方向性のみの行を区別し、再掲や原典の相反評点は各票に明記する。' },
  '13218': { extract: extractFussaRowsSupplement, scope: '事業別一覧の明示評価欄を部分構造化。重点個票と方向性のみの行を区別し、再掲や原典の相反評点は各票に明記する。' },
  '14213': { extract: extractYamatoRowsSupplement, scope: '事業別一覧の明示評価欄を部分構造化。重点個票と方向性のみの行を区別し、再掲や原典の相反評点は各票に明記する。' },
  '18201': { extract: extractFukuiSupplement, scope: '原文の独立事業・費用・成果の確定部分を構造化。評価本文未分離や施策指標との違いは各票の注記で明示。' },
  '13102': { extract: extractReviewFiveLaterLists, scope: '原文の独立事業・費用・成果の確定部分を構造化。評価本文未分離や施策指標との違いは各票の注記で明示。' },
  '11349': { extract: extractAssistEducationUnitsSupplement, scope: '原文で識別可能な事業別評価の部分構造化。教育の施策評価と独立事業、市民回答の対象数と回答数は区別する。' },
  '11348': { extract: extractAssistEducationUnitsSupplement, scope: '原文で識別可能な事業別評価の部分構造化。教育の施策評価と独立事業、市民回答の対象数と回答数は区別する。' },
  '43202': { extract: extractYatsushiroCitizenSupplement, scope: '原文で識別可能な事業別評価の部分構造化。教育の施策評価と独立事業、市民回答の対象数と回答数は区別する。' },
  '46204': { extract: extractMakurazakiEducationSupplement, scope: '原文で識別可能な事業別評価の部分構造化。教育の施策評価と独立事業、市民回答の対象数と回答数は区別する。' },
  '14361': { extract: extractNakaiListSupplement, scope: '原文で識別可能な事業別評価の部分構造化。教育の施策評価と独立事業、市民回答の対象数と回答数は区別する。' },
  '44213': { extract: extractYufuSupplement, scope: '行政改革資料中の具体的な業務・事業の評価を部分構造化。改革54項目全体を事業数としていない。' },
  '11232': { extract: extractReviewFiveLaterLists, scope: '保存原文の個票・事業別一覧で確認できる評価を部分構造化。切断票と再掲を除き、未確定の年度や数値は補わない。' },
  '32202': { extract: extractReviewFiveLaterLists, scope: '保存原文の個票・事業別一覧で確認できる評価を部分構造化。切断票と再掲を除き、未確定の年度や数値は補わない。' },
  '40224': { extract: extractFukutsuSupplement, scope: '保存原文の個票・事業別一覧で確認できる評価を部分構造化。切断票と再掲を除き、未確定の年度や数値は補わない。' },
  '01425': { extract: extractHokkaidoSingleSupplement, scope: '保存済み個別評価本文の部分構造化。年度・交付金対象期間は原文に従い、不明欄は補完しない。' },
  '01462': { extract: extractHokkaidoSingleSupplement, scope: '保存済み個別評価本文の部分構造化。年度・交付金対象期間は原文に従い、不明欄は補完しない。' },
  '15205': { extract: extractBatch6HtmlOpinionsSupplement, scope: '保存済み個別評価本文の部分構造化。年度・交付金対象期間は原文に従い、不明欄は補完しない。' },
  '01429': { extract: extractBatch6HtmlOpinionsSupplement, scope: '保存済み個別評価本文の部分構造化。年度・交付金対象期間は原文に従い、不明欄は補完しない。' },
  '19201': { extract: extractKofuSupplement, scope: '外部事業評価資料の個別事業の概要・現状・意見を部分構造化。対象年度不明は保持。' },
  '08224': { extract: extractMoriya, scope: '保存本文の事業別評価を部分構造化。再掲・年度不明・政策評価と教育事業評価の区分は各票の注記を参照。' },
  '32528': { extract: extractOkinoshima, scope: '保存本文の事業別評価を部分構造化。再掲・年度不明・政策評価と教育事業評価の区分は各票の注記を参照。' },
  '12211': { extract: extractNarita, scope: '保存本文の事業別評価を部分構造化。再掲・年度不明・政策評価と教育事業評価の区分は各票の注記を参照。' },
  '08226': { extract: extractNaka, scope: '保存本文の事業別評価を部分構造化。再掲・年度不明・政策評価と教育事業評価の区分は各票の注記を参照。' },
  '08217': { extract: extractTorideSupplement, scope: '保存本文の事業別評価を部分構造化。再掲・年度不明・政策評価と教育事業評価の区分は各票の注記を参照。' },
  '07504': { extract: extractAsakawa, scope: '保存本文の事業別評価を部分構造化。再掲・年度不明・政策評価と教育事業評価の区分は各票の注記を参照。' },
  '14301': { extract: extractBatch6FinalRowsSupplement, scope: '保存原文の独立事業単位を部分構造化。施策全体の評点・費用は個別事業へ転用しない。' },
  '40217': { extract: extractBatch6FinalRowsSupplement, scope: '保存原文の独立事業単位を部分構造化。施策全体の評点・費用は個別事業へ転用しない。' },
  '01213': { extract: extractBatch6FinalRowsSupplement, scope: '保存原文の独立事業単位を部分構造化。施策全体の評点・費用は個別事業へ転用しない。' },
  '40215': { extract: extractNakama, scope: '保存原文の独立事業単位を部分構造化。施策全体の評点・費用は個別事業へ転用しない。' },
  '02405': { extract: extractRokunohe, scope: '保存原文の独立事業単位を部分構造化。施策全体の評点・費用は個別事業へ転用しない。' },
  '47213': { extract: (input) => [...extractUrumaFacilitySupplement(input), ...extractUrumaEducationSupplement(input)], scope: '教育事業の点検評価と指定管理施設運営評価を部分構造化。指定管理施設運営評価は事務事業評価個票ではなく、各レコードの注記で区別する。' },
  '12410': { extract: extractYokoshibahikariListSupplement, scope: '保存原文で確定する事業別評価行の部分構造化。予算・実績・評価区分・期間の不明点は各注記を参照。' },
  '09216': { extract: extractShimotsukeListSupplement, scope: '保存原文で確定する事業別評価行の部分構造化。予算・実績・評価区分・期間の不明点は各注記を参照。' },
  '13201': { extract: extractHachiojiListSupplement, scope: '保存原文で確定する事業別評価行の部分構造化。予算・実績・評価区分・期間の不明点は各注記を参照。' },
  '31386': { extract: extractDaisenTottoriSupplement, scope: '保存原文で確定する事業別評価行の部分構造化。予算・実績・評価区分・期間の不明点は各注記を参照。' },
  '10204': { extract: extractIsesakiListSupplement, scope: '保存原文で確定する事業別評価行の部分構造化。予算・実績・評価区分・期間の不明点は各注記を参照。' },
  '33205': { extract: extractReviewedPdfSupplement, scope: '保存原文で確定する事業別評価行の部分構造化。予算・実績・評価区分・期間の不明点は各注記を参照。' },
  '08211': { extract: extractReviewedPdfSupplement, scope: '保存原文で確定する事業別評価行の部分構造化。予算・実績・評価区分・期間の不明点は各注記を参照。' },
  '39305': { extract: extractReviewedPdfSupplement, scope: '原文で確認できる個別事業の部分評価。予算審査と実施後評価、未確定金額・年度は各注記を参照。' },
  '07208': { extract: extractReviewedPdfSupplement, scope: '原文で確認できる個別事業の部分評価。予算審査と実施後評価、未確定金額・年度は各注記を参照。' },
  '45201': { extract: extractMiyazakiSupplement, scope: '原文で確認できる個別事業の部分評価。予算審査と実施後評価、未確定金額・年度は各注記を参照。' },
  '11223': { extract: extractWarabiSupplement, scope: '原文で確認できる個別事業の部分評価。予算審査と実施後評価、未確定金額・年度は各注記を参照。' },
  '19368': { extract: (input) => [...extractFujikawa(input), ...extractFujikawa2019(input), ...extractFujikawa2013Subsidies(input)], scope: '事業別・補助金別評価の部分構造化。同一補助金の学校別再掲は統合。' },
  '15225': { extract: extractUonumaSupplement, scope: '保存原文の事業別評価を部分構造化。政策評点や政策全体の成果は転用しない。' },
  '01468': { extract: extractShimokawa, scope: '保存原文の事業別評価を部分構造化。政策評点や政策全体の成果は転用しない。' },
  '12205': { extract: extractReviewFiveHtml, scope: '原文で識別可能な事業別評価の部分構造化。年度・費用の不明欄と個票・一覧の区別は各レコードの注記を参照。' },
  '46219': { extract: extractReviewFiveAdditional, scope: '原文で識別可能な事業別評価の部分構造化。年度・費用の不明欄と個票・一覧の区別は各レコードの注記を参照。' },
  '34212': { extract: extractReviewFiveAdditional, scope: '原文で識別可能な事業別評価の部分構造化。年度・費用の不明欄と個票・一覧の区別は各レコードの注記を参照。' },
  '11215': { extract: extractReviewFiveLists, scope: '原文で識別可能な事業別評価の部分構造化。年度・費用の不明欄と個票・一覧の区別は各レコードの注記を参照。' },
  '04445': { extract: extractReviewFiveLists, scope: '原文で識別可能な事業別評価の部分構造化。年度・費用の不明欄と個票・一覧の区別は各レコードの注記を参照。' },
  '11216': { extract: extractBatch6SmallRowsSupplement, scope: '原文で識別可能な事業別評価の部分構造化。年度・費用の不明欄と個票・一覧の区別は各レコードの注記を参照。' },
  '01460': { extract: extractBatch6SmallRowsSupplement, scope: '原文で識別可能な事業別評価の部分構造化。年度・費用の不明欄と個票・一覧の区別は各レコードの注記を参照。' },
  '13203': { extract: extractMusashinoSupplement, scope: '原文で識別可能な事業別評価の部分構造化。年度・費用の不明欄と個票・一覧の区別は各レコードの注記を参照。' },
  '01234': { extract: extractKitahiroshima, scope: '原文で識別可能な事業別評価の部分構造化。年度・費用の不明欄と個票・一覧の区別は各レコードの注記を参照。' },
  '35211': { extract: extractNagatoSupplement, scope: '原文で識別可能な事業別評価の部分構造化。年度・費用の不明欄と個票・一覧の区別は各レコードの注記を参照。' },
  '16211': { extract: extractImizu, scope: '原文で識別可能な事業別評価の部分構造化。年度・費用の不明欄と個票・一覧の区別は各レコードの注記を参照。' },
  '13214': { extract: extractKokubunjiSupplement, scope: '原文で識別可能な事業別評価の部分構造化。年度・費用の不明欄と個票・一覧の区別は各レコードの注記を参照。' },
  '07521': { extract: extractMiharuSupplement, scope: '原文で識別可能な事業別評価の部分構造化。年度・費用の不明欄と個票・一覧の区別は各レコードの注記を参照。' },
  '02426': { extract: extractSaiSupplement, scope: '原文で識別可能な事業別評価の部分構造化。年度・費用の不明欄と個票・一覧の区別は各レコードの注記を参照。' },
  '07368': { extract: extractMinamiaizu, scope: '事業別の評価単位を部分構造化。年度・費用の不明欄と一覧/詳細個票の区別は原文根拠と各レコードの注記を参照。' },
  '24324': { extract: extractToin, scope: '事業別の評価単位を部分構造化。年度・費用の不明欄と一覧/詳細個票の区別は原文根拠と各レコードの注記を参照。' },
  '03402': { extract: extractReviewedHtmlSupplement, scope: '事業別の評価単位を部分構造化。年度・費用の不明欄と一覧/詳細個票の区別は原文根拠と各レコードの注記を参照。' },
  '27383': { extract: extractChihayaakasakaSupplement, scope: '事業別の評価単位を部分構造化。年度・費用の不明欄と一覧/詳細個票の区別は原文根拠と各レコードの注記を参照。' },
  '14384': { extract: extractBatch6RowsSupplement, scope: '事業別の評価単位を部分構造化。年度・費用の不明欄と一覧/詳細個票の区別は原文根拠と各レコードの注記を参照。' },
  '36489': { extract: extractBatch6RowsSupplement, scope: '事業別の評価単位を部分構造化。年度・費用の不明欄と一覧/詳細個票の区別は原文根拠と各レコードの注記を参照。' },
  '11219': { extract: extractBatch6RowsSupplement, scope: '事業別の評価単位を部分構造化。年度・費用の不明欄と一覧/詳細個票の区別は原文根拠と各レコードの注記を参照。' },
  '01461': { extract: extractBatch6TransportSupplement, scope: '事業別の評価単位を部分構造化。年度・費用の不明欄と一覧/詳細個票の区別は原文根拠と各レコードの注記を参照。' },
  '38207': { extract: extractBatch6TransportSupplement, scope: '事業別の評価単位を部分構造化。年度・費用の不明欄と一覧/詳細個票の区別は原文根拠と各レコードの注記を参照。' },
  '01345': { extract: extractBatch6TransportSupplement, scope: '事業別の評価単位を部分構造化。年度・費用の不明欄と一覧/詳細個票の区別は原文根拠と各レコードの注記を参照。' },
  '11301': { extract: extractInaSupplement, scope: '事業別の評価単位を部分構造化。年度・費用の不明欄と一覧/詳細個票の区別は原文根拠と各レコードの注記を参照。' },
  '37202': { extract: extractMarugameCombinedSupplement, scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '31201': { extract: (input, inputs) => [...extractTottoriSupplement(input), ...extractTottoriNamedRowsSupplement(input, inputs)], scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '21206': { extract: extractReviewedHtmlSupplement, scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '20209': { extract: extractReviewFiveSummaries, scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '26206': { extract: extractReviewFiveSummaries, scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '10521': { extract: extractReviewFiveSummaries, scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '33213': { extract: extractReviewFiveSummaries, scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '33208': { extract: extractReviewFiveSummaries, scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '22130': { extract: extractReviewFiveHtml, scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '07544': { extract: extractReviewFiveHtml, scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '18207': { extract: (input) => [...extractReviewFiveHtml(input), ...extractReviewFiveAdditional(input)], scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '07547': { extract: extractNamie, scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '15361': { extract: extractTagami, scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '36387': { extract: extractMinami, scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '14212': { extract: extractAtsugi, scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '33209': { extract: (input) => [...extractTakahashiSupplement(input), ...extractTakahashiResultsSupplement(input), ...extractTakahashiFoldedSupplement(input)], scope: '個票と一覧の名称等を部分構造化。一覧の自由意見未分離、費用未確定の範囲は各レコードの注記を参照。' },
  '32206': { extract: extractYasugiSupplement, scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '22210': { extract: extractFujiSupplement, scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '03202': { extract: (input) => [...extractMiyakoSupplement(input), ...extractMiyakoExternalSupplement(input)], scope: '保存済み資料の識別可能な事業単位・事業別評価行を部分構造化。完全個票と一覧の区別・数値未変換の範囲は各レコードの注記を参照。全年度の網羅性は未確認。' },
  '22344': { extract: extractReviewedHtmlSupplement, scope: '公式HTML本文の独立した事業評価を部分構造化。訂正値・実績年・将来目標を区別。' },
  '12221': { extract: extractReviewedHtmlSupplement, scope: '公式HTML本文の独立した事業評価を部分構造化。訂正値・実績年・将来目標を区別。' },
  '17204': { extract: extractReviewedHtmlSupplement, scope: '公式HTML本文の独立した事業評価を部分構造化。訂正値・実績年・将来目標を区別。' },
  '02207': { extract: extractMisawaCombinedSupplement, scope: '横長一覧で名称・担当課・評点が同一行で確定する部分評価。混在する隣接行の成果本文は転用しない。' },
  '34211': { extract: extractOtakeSupplement, scope: '事業別指標達成表の部分構造化。施策レベル成果は転用しない。' },
  '46201': { extract: extractKagoshimaSupplement, scope: '一覧の事業名・担当部署・判定が単行で確定する部分評価。年度不明は推定しない。' },
  '39412': { extract: (input) => [...extractShimantoSupplement(input), ...extractShimantoSummarySupplement(input)], scope: '令和6年度評価の個別事業票。共通費用の疑義がある同額配列は数値化せず原文保持。' },
  '17461': { extract: extractAnamizu, scope: 'HTMLに掲載された個別事業評価。将来目標と過年度実績は区別。' },
  '35215': { extract: extractShunanSupplement, scope: '地域づくり・財政事務の個別成果記述。既存同年度事業との再掲を照合する追加候補。' },
  '27214': { extract: (input) => [...extractTondabayashiSupplement(input), ...extractTondabayashi2025Missing(input)], scope: '2024年度事業評価個票。保存本文末尾で切れた個票は除外。' },
  '13106': { extract: extractTaitoSupplement, scope: 'HTML本文の事業別実績・評価表の部分構造化。既存個票の行政経営推進を除外。' },
  '14204': { extract: extractKamakura, scope: '行政評価個表の事業単位を部分構造化。構成する最小事業を別レコードへ重複計上しない。' },
  '29209': { extract: extractIkomaSupplement, scope: '経営的施策の個別アクションプラン事業を追加構造化。全事業・年度の網羅性は未確認。' },
  '35207': { extract: extractKudamatsuSupplement, scope: '教育委員会の過年度事務事業評価個票を部分構造化。列混在する決算は原文保持。' },
};
