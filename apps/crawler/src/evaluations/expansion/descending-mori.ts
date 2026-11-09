import {createHash} from 'node:crypto';
import {project,evidence,type CachedInput} from './shared';
import type {LayoutReview} from './descending-layouts-r2';
import {configs as data} from './descending-mori-map';
export const configs=data as any[];
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export function reviewMori(i:CachedInput):LayoutReview|null {
 const c=configs.find(c=>c.sourceId===i.sourceId&&c.municipalityCode===i.municipalityCode);if(!c)return null;
 const r:LayoutReview={projects:[],units:[],status:'reviewed_literal_businesses',reason:'Reviewed annual business-name list with official linked year evidence; no score or cost assignment.',proofs:[]};
 if(i.sourceUrl!==c.sourceUrl||i.sourceSha256!==c.sourceSha256||i.format!=='pdf'||i.truncated||sha(i.text)!==c.fullTextSha256){r.status='source_integrity_hold';return r;}
 const n=c.navigationInput as CachedInput,y=c.year,era=y<=2018?'平成'+(y-1988):'令和'+(y===2019?'元':y-2018),label='主な事業 '+era+'年度評価内訳';
 if(!Number.isInteger(y)||y<2017||y>2024||c.navigationProof!==label||!n.text.includes(label)||n.municipalityCode!==i.municipalityCode||n.format!=='html'||n.truncated||n.sourceId!=='6bce556470119c541899fe37'||n.sourceSha256!=='34323d7b74748dd66222bdf1794b029838e9f56615dc69daae40bf40fb425669'||sha(n.text)!==c.navigationTextSha256||n.sourceUrl!=='https://www.town.morimachi.shizuoka.jp/gyosei/choseijoho/machinokeikaku_torikumi/5687.html'||c.navigationReview.evidenceUrl!==n.sourceUrl||!c.navigationReview.notes.includes(n.sourceSha256))throw Error('Mori official linked year proof mismatch');
 if(!i.text.includes(c.proof)||c.annualColumnCount!==y-2016||[...i.text.matchAll(/^\s*[ABCSＡＢＣＳ]\s*$/gm)].length!==199*c.annualColumnCount||c.rows.length!==199||new Set(c.rows.map((x:any)=>x.number)).size!==199)throw Error('Mori annual matrix coverage mismatch');
 for(const row of c.rows){if(!Number.isInteger(row.number)||row.number<1||row.number>199||!Number.isInteger(row.start)||row.start<0||i.text.slice(row.start,row.start+row.raw.length)!==row.raw||row.titleSegments.map((s:any)=>s.raw).join('')!==row.name)throw Error('Mori literal row identity mismatch');let end=row.start;for(const s of row.titleSegments){if(!Number.isInteger(s.start)||s.start<end||s.start+s.raw.length>row.start+row.raw.length||i.text.slice(s.start,s.start+s.raw.length)!==s.raw)throw Error('Mori title segment mismatch');end=s.start+s.raw.length;}
 const p=project(i,'mori-annual-'+y+'-'+row.number,row.name,y,row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=null;p.evidence.push(evidence(i,c.proof),evidence(n,label));for(const s of row.titleSegments)p.evidence.push(evidence(i,s.raw,s.start));p.warnings.push('総合計画の主な事業の年度別評価対象名。年度は保存済み公式リンクと評価表の対応に基づく評価年度。会計年度の実績額・個別評点・完了を推測していません。原文の表記を保持し、年度間の異表記を統合していません。');r.projects.push(p);r.units.push({start:row.start,name:row.name,status:'supported',reason:'Explicit annual evaluated business-name row; 199-row matrix, no inferred numeric association.'});
 }r.proofs=[c.proof];return r;
}
