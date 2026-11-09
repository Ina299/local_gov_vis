import assert from 'node:assert/strict';
import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {boundedSourceScope} from './descending-bounded-review';
/** Validate saved outputs against the exact approved sheet range and source-specific period. */
export function assertBoundedCandidate(p:ProjectEvaluation,text:string,scope:NonNullable<ReturnType<typeof boundedSourceScope>>){
 if('kind' in scope){assert.equal(scope.kind,'niigata-complete-table-rows');const expected=scope.projects.find(x=>x.id===p.id);assert.ok(expected,'Only reviewed Niigata identity/year accepted');assert.deepEqual(p,expected,'Every approved annual field and citation must reproduce');return;}
 const row=scope.rows.find(r=>r.name===p.projectName);assert.ok(row);
 assert.equal(p.evaluatedFiscalYear,scope.year);
 assert.equal(p.evaluationYear,'evaluationYear' in scope?scope.evaluationYear:null);
 assert.equal(p.amounts.length+p.ratings.length+p.indicators.length,0);
 const start='contextStart' in row?row.contextStart:row.start;
 assert.ok(typeof start==='number');
 assert.ok(p.evidence.some(ev=>ev.rawText===text.slice(start,row.end)&&ev.cell===`extracted-text:chars:${start}-${row.end}`));
}
