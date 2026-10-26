/** Offline, evidence-bound field enrichment; record counts never increase. */
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {importEnrichment,verifyEnrichedEvaluations,ENRICHMENT_MANIFEST} from './evaluations/enrichment-integration';
const args=process.argv.slice(2),inputFiles:string[]=[];let generatedAt:string|undefined,verify=false;
for(let i=0;i<args.length;i++){if(args[i]==='--input')inputFiles.push(resolve(args[++i]));else if(args[i]==='--generated-at')generatedAt=args[++i];else if(args[i]==='--verify')verify=true;else throw new Error(`Unknown argument: ${args[i]}`);}
if(verify?inputFiles.length||generatedAt:!inputFiles.length||!generatedAt)throw new Error('Use --verify or --input <patch.json> (repeatable) --generated-at <ISO date>');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const assets=verify?await verifyEnrichedEvaluations(root):await importEnrichment({root,inputFiles,generatedAt:generatedAt!});
let statistics=null;try{statistics=JSON.parse(await readFile(resolve(root,ENRICHMENT_MANIFEST),'utf8')).statistics;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
console.log(JSON.stringify({verified:true,offlineOnly:true,primaryEvaluationRecords:assets.index.primaryEvaluationRecords,statistics}));
