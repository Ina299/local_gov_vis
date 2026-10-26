/* Run only AFTER the final subpath build and local server are ready.
   BASE_URL=http://127.0.0.1:8765/local_gov_vis/ node apps/crawler/scripts/enrichment/browser-check.cjs
   No external network: fonts/tiles are replaced locally, original-source links are inspected only.
*/
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const repo=process.env.REPO_ROOT||path.resolve(__dirname,'../../../..');
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:8765/local_gov_vis/');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname),'Only a loopback server is allowed');
assert.ok(base.pathname!=='/'&&base.pathname.endsWith('/'),'Require a non-root trailing-slash subpath build');
const output=process.env.BROWSER_RESULT||path.resolve('browser-enrichment-result.json');
const report={startedAt:new Date().toISOString(),baseUrl:base.href,externalNetwork:'disabled; original links not fetched',results:[],legacy:[],pageErrors:[],consoleErrors:[],httpErrors:[],requestFailures:[],blockedExternal:[],failures:[]};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1xkAAAAASUVORK5CYII=','base64');
async function count(page,n){await page.waitForFunction(expected=>{const el=document.querySelector('.evaluation-results .evaluation-section-heading [role="status"]');return el&&Number(el.textContent.match(/^[\d,]+/)?.[0].replaceAll(',',''))===expected;},n,{timeout:30000});}
(async()=>{
 const manifest=read(path.join(repo,'data/evaluations/enrichment-provenance.json'));
 const selectedIds=process.env.ENRICHMENT_INPUT_PATH?new Set(read(path.resolve(repo,process.env.ENRICHMENT_INPUT_PATH)).patches.map(p=>p.projectId)):null;
 const indexBytes=fs.readFileSync(path.join(repo,'apps/web/public/evaluations-index.json')),index=JSON.parse(indexBytes);
 assert.equal(sha(indexBytes),manifest.outputIndexSha256,'Final public index must match supplemental manifest');
 assert.ok(index.cohorts?.supplemental,'Final supplemental index is not installed yet');
 const originals=new Map(manifest.baseIndex.municipalities.map(x=>[x.municipalityCode,x]));
 const changed=index.municipalities.filter(x=>x.datasetSha256!==originals.get(x.municipalityCode)?.datasetSha256);
 assert.ok(changed.length>0,'No changed municipality shards');
 assert.deepEqual(changed.map(x=>x.municipalityCode).sort(),manifest.shards.map(x=>x.municipalityCode).sort());
 report.indexSha256=sha(indexBytes);report.expectedMunicipalities=changed.filter(x=>!process.env.ONLY_CODES||process.env.ONLY_CODES.split(',').includes(x.municipalityCode)).length;report.expectedRecords=changed.reduce((n,x)=>n+x.primaryEvaluationRecords,0);
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1365,height:900}});let current='setup';
  await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.origin===base.origin)return route.continue();report.blockedExternal.push({case:current,url:u.href,type:req.resourceType()});if(req.resourceType()==='image')return route.fulfill({status:200,contentType:'image/png',body:png});return route.fulfill({status:200,contentType:req.resourceType()==='stylesheet'?'text/css':'text/plain',body:''});});
  const page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',e=>report.pageErrors.push({case:current,message:e.message}));
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push({case:current,message:m.text(),location:m.location()});});
  page.on('response',r=>{if(new URL(r.url()).origin===base.origin&&r.status()>=400)report.httpErrors.push({case:current,url:r.url(),status:r.status()});});
  page.on('requestfailed',r=>{if(new URL(r.url()).origin===base.origin)report.requestFailures.push({case:current,url:r.url(),error:r.failure()?.errorText});});
  // Bind what is served to the exact final public index; never silently test an older build.
  const served=await page.request.get(new URL('evaluations-index.json',base).href);assert.equal(served.status(),200);assert.equal(sha(await served.body()),report.indexSha256,'Server is serving a stale/different build');
  for(const row of changed.filter(x=>!process.env.ONLY_CODES||process.env.ONLY_CODES.split(',').includes(x.municipalityCode)).sort((a,b)=>a.municipalityCode.localeCompare(b.municipalityCode))){
   current=row.municipalityCode;const result={code:current,expected:row.primaryEvaluationRecords,status:'pending'};
   try{
    assert.ok(row.datasetPath&&!row.datasetPath.includes('..'));
    const shardBytes=fs.readFileSync(path.join(repo,'apps/web/public',row.datasetPath));assert.equal(sha(shardBytes),row.datasetSha256);
    const data=JSON.parse(shardBytes);assert.equal(data.projects.length,row.primaryEvaluationRecords);
    await page.goto(new URL(`evaluations/?municipality=${current}&view=normalized`,base).href,{waitUntil:'networkidle'});
    await count(page,row.primaryEvaluationRecords);
    const selected=page.locator('.evaluation-selected'),text=await selected.innerText();
    for(const note of ['全事業の網羅性：未確認','一意の事業数ではありません','空欄・未取得はゼロや低評価を意味せず'])assert.ok(text.includes(note),`${current}: missing caveat ${note}`);
    const validUrls=new Set(data.projects.flatMap(p=>p.evidence.map(e=>new URL(e.sourceUrl).href)));
    const card=page.locator('.evaluation-project-card').first();await card.waitFor();
    const sourceLinks=await card.locator('a').evaluateAll(nodes=>nodes.map(a=>({href:a.href,target:a.target,rel:a.rel})));
    assert.ok(sourceLinks.length>0,`${current}: missing source link`);for(const link of sourceLinks){assert.ok(validUrls.has(link.href));assert.equal(link.target,'_blank');assert.ok(link.rel.includes('noopener'));}
    await card.locator('.evaluation-project-details > summary').click();
    const evidence=card.locator('.evaluation-detail-body > section').last().locator('.evaluation-evidence').first();await evidence.locator('summary').click();
    await evidence.locator('.evaluation-raw-text').waitFor();assert.ok((await evidence.locator('.evaluation-raw-text').innerText()).length>0);
    assert.ok((await evidence.innerText()).includes('SHA-256'));
    // Unknown years must remain searchable and never become zero/current-year.
    const unknown=[];
    for(const [label,key] of [['評価年度（資料表記）','evaluationYear'],['評価対象年度','evaluatedFiscalYear']]){
     const n=data.projects.filter(p=>p[key]===null).length;const select=page.locator('.evaluation-project-filters select').nth(key==='evaluationYear'?0:1);
     if(n){assert.ok(await select.locator('option[value="unknown"]').count());await select.selectOption('unknown');await count(page,n);unknown.push({field:key,count:n});await select.selectOption('');await count(page,row.primaryEvaluationRecords);}
    }
    const original=originals.get(current);assert.ok(original?.datasetPath);
    const old=read(path.join(repo,'apps/web/public',original.datasetPath));
    const oldRecords=new Map(old.projects.map(p=>[p.id,p]));
    assert.deepEqual(data.projects.map(p=>p.id),old.projects.map(p=>p.id),'Enrichment must preserve project identity and order');
    const enriched=data.projects.filter(p=>JSON.stringify(p)!==JSON.stringify(oldRecords.get(p.id)));
    assert.ok(enriched.length>0,'Changed shard has no enriched record');
    const targets=selectedIds?enriched.filter(p=>selectedIds.has(p.id)):enriched;
    assert.ok(targets.length>0,'No record from requested enrichment input');
    const target=targets.find(p=>data.projects.filter(q=>q.projectName===p.projectName).length===1)||targets[0];
    const search=page.locator('.evaluation-project-filters input[type="search"]');await search.fill(target.projectName);
    await page.waitForFunction(name=>Array.from(document.querySelectorAll('.evaluation-project-card h3')).some(h=>h.textContent===name),target.projectName);
    const matching=page.locator('.evaluation-project-card').filter({has:page.getByRole('heading',{name:target.projectName,exact:true})});
    // Iterate stable article locators: opening details removes them from :not([open]).
    for(const article of await matching.all()){
      const details=article.locator(':scope > .evaluation-project-details');
      if(await details.getAttribute('open')===null)await details.locator(':scope > summary').click();
      await details.locator(':scope > .evaluation-detail-body').waitFor({state:'visible'});
    }
    const shown=(await matching.allTextContents()).join(' ').replace(/\s+/g,'');
    const checked=[];
    for(const key of ['purpose','activities','outcomes']){
      if(oldRecords.get(target.id)[key]===null&&target[key]!==null){assert.ok(shown.includes(target[key].replace(/\s+/g,'')),`${current}: enriched ${key} is absent`);checked.push(key);}
    }
    result.status='passed';result.sourceLinks=sourceLinks.length;result.rawEvidenceOpened=true;result.unknownYearChecks=unknown;result.enrichedRecords=enriched.length;result.enrichedNameVisible=target.projectName;result.enrichedFieldsVisible=checked;
   }catch(e){result.status='failed';result.error=e.stack||String(e);report.failures.push({case:current,error:result.error});await page.screenshot({path:path.join(path.dirname(output),`browser-failure-${current}.png`),fullPage:false}).catch(()=>{});}
   report.results.push(result);save();console.log(JSON.stringify(result));
  }
  current='legacy';
  try{
   await page.goto(base.href,{waitUntil:'networkidle'});await page.locator('.metric-menu-button').waitFor();
   const selectCategory=async name=>{await page.locator('.metric-menu-button').click();await page.getByRole('menuitemradio',{name,exact:true}).click();await page.waitForLoadState('networkidle');};
   await selectCategory('財政指標');await page.getByRole('button',{name:'財政力指数',exact:true}).click();assert.ok((await page.locator('[aria-label="表示指標"] .active').innerText()).includes('財政力指数'));report.legacy.push({category:'finance',status:'passed'});
   await selectCategory('歳入・歳出');await page.getByRole('button',{name:'道路の国費',exact:true}).click();await page.getByRole('group',{name:'道路の国費の見方'}).waitFor();
   for(const name of ['配分額','前年度比','要確認度']){await page.getByRole('group',{name:'道路の国費の見方'}).getByRole('button',{name,exact:true}).click();await page.waitForLoadState('networkidle');}report.legacy.push({category:'road-funding',variants:3,status:'passed'});
   await selectCategory('選挙');await page.getByLabel('選挙',{exact:true}).waitFor();assert.ok(await page.getByLabel('選挙',{exact:true}).locator('option').count());assert.ok(await page.locator('[aria-label="表示指標"] button').count());report.legacy.push({category:'election',status:'passed'});
   await page.screenshot({path:path.join(path.dirname(output),'browser-final-legacy.png'),fullPage:false});
  }catch(e){report.failures.push({case:current,error:e.stack||String(e)});}
 }finally{await browser.close();}
 report.finishedAt=new Date().toISOString();report.passed=report.results.length===report.expectedMunicipalities&&report.failures.length===0&&report.pageErrors.length===0&&report.consoleErrors.length===0&&report.httpErrors.length===0&&report.requestFailures.length===0;
 save();console.log(JSON.stringify({passed:report.passed,municipalities:report.results.length,failures:report.failures.length,consoleErrors:report.consoleErrors.length,httpErrors:report.httpErrors.length}));if(!report.passed)process.exitCode=1;
})().catch(e=>{report.failures.push({case:'harness',error:e.stack||String(e)});report.passed=false;report.finishedAt=new Date().toISOString();save();console.error(e);process.exitCode=1;});
