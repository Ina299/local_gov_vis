import test from 'node:test';
import assert from 'node:assert/strict';
import {combineNiigataReviews} from '../src/evaluations/expansion/descending-niigata-combine';
import type {LayoutReview} from '../src/evaluations/expansion/descending-layouts-r2';
const review=(ids:string[],status='reviewed'):LayoutReview=>({projects:ids.map(id=>({id})) as LayoutReview['projects'],units:[],proofs:[],status,reason:'pinned source review'});
test('Niigata combined families keep both prior and supplementary records and fail closed on one integrity hold',()=>{
 const a=review(['old']),b=review(['new']);
 assert.deepEqual(combineNiigataReviews(a,b)!.projects.map(p=>p.id),['old','new']);
 assert.equal(combineNiigataReviews(a,null),a);
 assert.equal(combineNiigataReviews(null,b),b);
 assert.deepEqual(combineNiigataReviews(a,review([],'source_integrity_hold'))!.projects,[]);
 assert.deepEqual(combineNiigataReviews(review([],'source_integrity_hold'),b)!.projects,[]);
 assert.deepEqual(a.projects.map(p=>p.id),['old']);
 assert.throws(()=>combineNiigataReviews(a,review(['old'])),/overlap/);
});
