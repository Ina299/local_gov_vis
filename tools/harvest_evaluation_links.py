#!/usr/bin/env python3
"""Harvest document links from saved official evaluation pages into a reviewed-sources file (offline).

Only pages whose original HTML bytes are saved (and hash-verified) are read. A link is recorded as verified when
it is a literal <a href> in that page, resolves to the same official host, points to a document file, and its
link text or URL names evaluation material. Nothing is fetched; acquisition is a separate collection run.
"""
import argparse,datetime,glob,json,os,pathlib,re,urllib.parse
from lxml import html as LH
from prepare_collected_sources import digest

DOC_EXT=re.compile(r'\.(pdf|xlsx|xls|docx|doc)$',re.I)
KEYWORDS=re.compile(r'評価|事業|成果|点検|検証|レビュー|シート|調書|棚卸|仕分|行政|実績|達成|進捗')
EXCLUDE=re.compile(r'様式|記入例|記載例|要綱|要領|規程|規則|条例|手引|マニュアル|申請|募集|入札|契約|議事録|会議録|名簿|委員|チラシ|ポスター')
EVALUATION_PAGE=re.compile(r'評価|事業レビュー|点検|検証|成果')

def originals(dirs):
 found={}
 for d in dirs:
  m=d/'manifest.json'
  if not m.exists():continue
  for e in json.loads(m.read_text(encoding='utf-8'))['entries'].values():
   if e['state']=='fetched':found.setdefault(e['sha256'],(d/e['file'],e.get('contentType')))
 return found

def decode(raw,ctype):
 m=re.search(r'charset=([\w-]+)',ctype or '',re.I) or re.search(rb'<meta[^>]+charset=["\']?([\w-]+)',raw[:4096],re.I)
 cs=(m.group(1).decode() if m and isinstance(m.group(1),bytes) else m.group(1) if m else 'utf-8').lower()
 cs={'shift_jis':'cp932','shift-jis':'cp932','sjis':'cp932','x-sjis':'cp932','euc-jp':'euc_jp'}.get(cs,cs)
 try:return raw.decode(cs,errors='strict')
 except (LookupError,UnicodeDecodeError):return None

def harvest(root,dirs,per_municipality,checked_at):
 public=root/'apps/web/public/evaluation-evidence';found=originals(dirs)
 known=set();cities=[]
 for shard in sorted((public/'municipalities').glob('*.json')):
  city=json.loads(shard.read_text(encoding='utf-8'));cities.append(city)
  for s in city['sources']:known.add(s['url'])
 rows=[];report={'pages':0,'pagesWithLinks':0,'links':0,'capped':0}
 for city in cities:
  m=city['municipality'];code=m['municipalityCode'];added=[]
  for s in city['sources']:
   a=s['acquisition']
   if a['state']!='acquired' or s['verification']['status']!='verified' or s['format'] not in ('html','htm','php','aspx'):continue
   if not EVALUATION_PAGE.search(s['title'] or '') and s['role']!='evaluation_landing_page':continue
   if a.get('sourceSha256') not in found:continue
   path,ctype=found[a['sourceSha256']];raw=path.read_bytes()
   if digest(raw)!=a['sourceSha256']:raise ValueError('Original integrity failure')
   text=decode(raw,ctype)
   if text is None:continue
   report['pages']+=1
   try:tree=LH.fromstring(text)
   except Exception:continue
   page=urllib.parse.urlsplit(s['url']);n=0
   for el in tree.xpath('//a[@href]'):
    href=el.get('href').strip()
    try:u=urllib.parse.urlsplit(urllib.parse.urljoin(s['url'],href))
    except ValueError:continue
    if u.scheme not in ('http','https') or u.username or u.password or (u.hostname or '').lower()!=(page.hostname or '').lower():continue
    url=urllib.parse.urlunsplit((u.scheme,u.netloc,u.path,u.query,''))
    label=re.sub(r'\s+',' ',' '.join(el.itertext())).strip()[:300]
    if not DOC_EXT.search(u.path) or url in known:continue
    if not (KEYWORDS.search(label) or KEYWORDS.search(urllib.parse.unquote(u.path))) or EXCLUDE.search(label):continue
    known.add(url);n+=1
    added.append({'municipalityCode':code,'municipalityName':m['municipalityName'],'prefectureCode':m['prefectureCode'],'url':url,
     'title':label or urllib.parse.unquote(u.path.rsplit('/',1)[-1]),'format':DOC_EXT.search(u.path).group(1).lower(),'evaluationType':'unknown',
     'verification':'verified','evaluationRelevant':True,'checkedAt':checked_at,'publisher':m['municipalityName'],
     'evidenceUrl':s['url'],'originEvidenceUrl':None,
     'notes':f"保存済み公式ページ（原本SHA-256 {a['sourceSha256']}）の本文リンクから機械的に収集。リンク先の内容・資料区分は未確認。",
     'yearNotes':'未確認（リンク文字列のみ）','rawArchiveState':'not_downloaded'})
   if n:report['pagesWithLinks']+=1
  if len(added)>per_municipality:report['capped']+=len(added)-per_municipality;added=added[:per_municipality]
  rows+=added;report['links']+=len(added)
 return rows,report

if __name__=='__main__':
 p=argparse.ArgumentParser()
 p.add_argument('--sources-dir',default=os.environ.get('EVALUATION_SOURCES_DIR','apps/crawler/output'))
 p.add_argument('--per-municipality',type=int,default=400)
 p.add_argument('--out',default='data/evaluations/navigation-reviewed-sources-r5.json')
 a=p.parse_args();root=pathlib.Path(__file__).resolve().parents[1];base=pathlib.Path(a.sources_dir)
 if not base.is_absolute():base=root/base
 dirs=sorted(x for x in base.iterdir() if x.is_dir() and x.name.startswith('source-collection'))
 now=datetime.datetime.now(datetime.timezone.utc).isoformat()
 rows,report=harvest(root,dirs,a.per_municipality,now)
 baseline=json.loads((root/'data/evaluations/navigation-reviewed-sources.json').read_text(encoding='utf-8'))
 payload={'schemaVersion':1,'baseCommit':baseline['baseCommit'],'snapshotAt':now,'quarantinedHosts':[],
  'discoveryRound':'2026-10-24 links harvested from saved official evaluation pages (literal anchors, same host, document files)','sources':rows,'notFound':[]}
 (root/a.out).write_text(json.dumps(payload,ensure_ascii=False,indent=1),encoding='utf-8')
 report['municipalities']=len({r['municipalityCode'] for r in rows});print(json.dumps(report,indent=1))
