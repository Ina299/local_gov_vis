import type {ProjectEvaluation} from '../../../../../web/src/types/evaluation';
import type {CachedInput} from '../shared';
import {entries as ageo} from './g2-ageo';
import {entries as date} from './g2-date';
import {entries as higashiyamato} from './g2-higashiyamato';
import {entries as ishioka} from './g2-ishioka';
import {entries as kami} from './g2-kami';
import {entries as kuriyama} from './g2-kuriyama';
import {entries as moriya} from './g2-moriya';
import {entries as motomiya} from './g2-motomiya';
import {entries as toshima} from './g2-toshima';
/** 第7バッチ g2 担当分。杉戸町(11464)・つくば市(08220)・佐野市(09204)・多摩市(13224)は事務事業評価票が無いか既存と同一のため対象外。 */
export const entries:Record<string,{extract:(input:CachedInput,inputs:CachedInput[])=>ProjectEvaluation[];scope:string}>={
 ...motomiya,...toshima,...moriya,...higashiyamato,...date,...ishioka,...kami,...ageo,...kuriyama,
};
