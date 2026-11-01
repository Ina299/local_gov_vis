/** Reproducible offline extraction from hash-checked, already published text assets. */
import type { ProjectEvaluation } from '../../web/src/types/evaluation';
import { type CachedInput } from './evaluations/expansion/shared';
import { extractOgano } from './evaluations/expansion/ogano';
import { extractMobara } from './evaluations/expansion/mobara';
import { extractAkitakata } from './evaluations/expansion/akitakata';
import { extractMisato } from './evaluations/expansion/misato';
import { extractKaizu } from './evaluations/expansion/kaizu';
import { extractShinjo } from './evaluations/expansion/shinjo';
import { extractTakanabe } from './evaluations/expansion/takanabe';
import { extractOtaki } from './evaluations/expansion/otaki';
import { extractUonuma } from './evaluations/expansion/uonuma';
import { extractShimanto } from './evaluations/expansion/shimanto';
import { extractKuki } from './evaluations/expansion/kuki';
import { extractMiyazaki } from './evaluations/expansion/miyazaki';
import { extractKasukabe } from './evaluations/expansion/kasukabe';
import { extractHakodate } from './evaluations/expansion/hakodate';
import { extractHino } from './evaluations/expansion/hino';
import { extractIkoma } from './evaluations/expansion/ikoma';
import { extractTakahashi } from './evaluations/expansion/takahashi';
import { extractTateyama } from './evaluations/expansion/tateyama';
import { extractShowa } from './evaluations/expansion/showa';
import { extractTanabe } from './evaluations/expansion/tanabe';
import { extractChigasaki } from './evaluations/expansion/chigasaki';
import { extractTakko } from './evaluations/expansion/takko';
import { extractHigashihiroshima } from './evaluations/expansion/higashihiroshima';
import { extractDaigo } from './evaluations/expansion/daigo';
import { extractKasuya } from './evaluations/expansion/kasuya';
import { extractKomagane } from './evaluations/expansion/komagane';
import { extractIsesaki } from './evaluations/expansion/isesaki';
import { extractMarugame } from './evaluations/expansion/marugame';
import { extractChikushino } from './evaluations/expansion/chikushino';
import { extractSannohe } from './evaluations/expansion/sannohe';
import { extractYazu } from './evaluations/expansion/yazu';
import { extractHadano } from './evaluations/expansion/hadano';
import { extractHita } from './evaluations/expansion/hita';
import { extractIizuka } from './evaluations/expansion/iizuka';
import { extractMunakata } from './evaluations/expansion/munakata';
import { extractTomisato } from './evaluations/expansion/tomisato';
import { extractHanamaki } from './evaluations/expansion/hanamaki';
import { extractOfunato } from './evaluations/expansion/ofunato';
import { extractMinamiashigara } from './evaluations/expansion/minamiashigara';
import { extractHirao } from './evaluations/expansion/hirao';
import { extractKamisato } from './evaluations/expansion/kamisato';
import { extractToshima } from './evaluations/expansion/toshima';
import { extractKumamoto } from './evaluations/expansion/kumamoto';
import { extractMiura } from './evaluations/expansion/miura';
import { extractKomatsu } from './evaluations/expansion/komatsu';
import { extractOyama } from './evaluations/expansion/oyama';
import { extractNanbuAomori } from './evaluations/expansion/nanbu-aomori';
import { extractNanbuYamanashi } from './evaluations/expansion/nanbu-yamanashi';
import { extractYuzawa } from './evaluations/expansion/yuzawa';
import { extractMisatoSaitama } from './evaluations/expansion/misato-saitama';
import { extractTaito } from './evaluations/expansion/taito';
import { extractNikaho } from './evaluations/expansion/nikaho';
export const originalExtractors: Record<string,(input:CachedInput, inputs:CachedInput[])=>ProjectEvaluation[]> = {
 '11381':extractMisatoSaitama,'13106':extractTaito,'05214':extractNikaho,
 '03205':extractHanamaki,
 '03203':extractOfunato,
 '14217':extractMinamiashigara,
 '35344':extractHirao,
 '11385':extractKamisato,
 '13116':extractToshima,
 '43100':extractKumamoto,
 '14210':extractMiura,
 '17203':extractKomatsu,
 '09208':extractOyama,
 '02445':extractNanbuAomori,
 '19366':extractNanbuYamanashi,
 '15461':extractYuzawa,
 '05434':extractMisato,'11365':extractOgano,'12210':extractMobara,'34214':extractAkitakata,
 '21221':(input,inputs)=>extractKaizu(input,inputs.find(d=>d.sourceId==='982b3dbd86b80c24870b5012')),
 '01202':extractHakodate,'06205':extractShinjo,'11214':extractKasukabe,'11232':extractKuki,
 '12441':extractOtaki,'13212':extractHino,'15225':extractUonuma,'39412':extractShimanto,
 '45201':extractMiyazaki,'45401':extractTakanabe,'29209':extractIkoma,'33209':extractTakahashi,
 '10204':extractIsesaki,'37202':extractMarugame,'40217':extractChikushino,
 '08364':extractDaigo,'40349':extractKasuya,'20210':extractKomagane,
 '14207':extractChigasaki,'02443':extractTakko,'34212':extractHigashihiroshima,
 '02441':extractSannohe,
 '31329':extractYazu,
 '14211':extractHadano,
 '44204':extractHita,
 '40205':extractIizuka,
 '40220':extractMunakata,
 '12233':extractTomisato,
 '16323':extractTateyama,'07446':extractShowa,'30206':extractTanabe,
};
