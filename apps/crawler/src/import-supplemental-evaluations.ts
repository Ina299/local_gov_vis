/** Offline append-only supplements; original shards remain byte-identical. */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importSupplementalEvaluations, verifySupplementalEvaluations } from './evaluations/supplemental-integration';
const args=process.argv.slice(2);let sourceDirectory:string|undefined;let generatedAt:string|undefined;let verify=false;let decisionsFile:string|undefined;
for(let i=0;i<args.length;i++){
  if(args[i]==='--source-dir')sourceDirectory=args[++i];else if(args[i]==='--generated-at')generatedAt=args[++i];else if(args[i]==='--decisions-file')decisionsFile=args[++i];else if(args[i]==='--verify')verify=true;else throw new Error(`Unknown argument: ${args[i]}`);
}
if(verify ? !!sourceDirectory||!!generatedAt||!!decisionsFile : !sourceDirectory||!generatedAt)throw new Error('Use --verify or --source-dir <directory> --generated-at <ISO timestamp>');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const reviewed=decisionsFile?JSON.parse(await readFile(resolve(decisionsFile),'utf8')):{schemaVersion:1,decisions:[]};
if(reviewed.schemaVersion!==1||!Array.isArray(reviewed.decisions))throw new Error('Invalid distinct-decisions file');
const assets=verify?await verifySupplementalEvaluations(root):await importSupplementalEvaluations({root,sourceDirectory:resolve(sourceDirectory!),generatedAt:generatedAt!,distinctDecisions:reviewed.decisions});
console.log(JSON.stringify({verified:true,offlineOnly:true,primaryMunicipalities:assets.index.primaryMunicipalities,primaryEvaluationRecords:assets.index.primaryEvaluationRecords,cohorts:assets.index.cohorts}));
