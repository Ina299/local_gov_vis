import {createHash} from 'node:crypto';
import type {LayoutReview} from './descending-layouts-r2';
import type {CachedInput} from './shared';
import {oitaRelatedSources} from './descending-oita-related-map';
export function reviewOitaRelated(i:CachedInput):LayoutReview|null{
 const c=oitaRelatedSources.find(c=>c.sourceId===i.sourceId&&c.municipalityCode===i.municipalityCode);if(!c)return null;
 const valid=!i.truncated&&i.format==='pdf'&&createHash('sha256').update(i.text).digest('hex')===c.fullTextSha256;
 return{projects:[],units:[{start:0,status:valid?'related_or_identity_hold':'source_integrity_hold',reason:valid?c.reason:'Reviewed complete source hash no longer matches; disposition must be rechecked.'}],status:valid?'reviewed_related_or_identity_hold':'source_integrity_hold',reason:valid?c.reason:'Source integrity mismatch',proofs:valid?[c.openingQuote]:[]};
}
