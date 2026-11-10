import{combineNiigataReviews}from'./descending-niigata-combine';
import{reviewUonumaExtra}from'./descending-niigata-uonuma-extra';
import { reviewUonumaSummary } from './descending-niigata-uonuma';
import { reviewUonumaHistory } from './descending-niigata-uonuma-history';
import type { CachedInput } from './shared';
/** Pinned complete table rows inside two incomplete cached books; never approve the missing tail. */
export function boundedNiigataScope(i:CachedInput){
 const originalCharacters=i.sourceId==='cfcf90a2f8f4d9a15f11368c'?390806:i.sourceId==='3c30261b9d3a197216c19d81'?226600:null;
 if(originalCharacters===null)return null;
 const reviewed=reviewUonumaSummary(i)??combineNiigataReviews(reviewUonumaHistory(i),reviewUonumaExtra(i));
 if(!reviewed?.projects.length)return null;
 // Source-specific reviewers prove title, closed table/row, annual columns, units, and full sum.
 // Retain exact approved outputs so validation also checks all numeric fields and citations.
 return {kind:'niigata-complete-table-rows' as const,originalCharacters,sourceId:i.sourceId,projects:reviewed.projects};
}
export function reviewBoundedNiigata(i:CachedInput){return reviewUonumaSummary(i)??combineNiigataReviews(reviewUonumaHistory(i),reviewUonumaExtra(i));}
