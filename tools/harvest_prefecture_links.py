#!/usr/bin/env python3
"""Harvest further links from the saved official prefecture evaluation pages into a prefecture discovery file (offline).

  PYTHONUTF8=1 python tools/harvest_prefecture_links.py --collections I:/local_gov_crawler_sources/prefecture-r1a ... \
      --out data/evaluations/prefecture-discovery-r2.json [--per-prefecture 400]

Reads only HTML pages of evaluation-evidence-prefectures whose original bytes are saved (and re-hashed). A link is kept when it
is a literal <a href> on that page, stays on the same official host, and either points to a document file whose link text or
path names evaluation material, or (as a further page) is an HTML page whose link text names evaluation material. Links that
are already known are skipped. Nothing is fetched; collection is a separate run. Output shape = prefecture-discovery-r1.json.
"""
import argparse,datetime,json,pathlib,re,sys,urllib.parse
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from lxml import html as LH
from harvest_evaluation_links import originals,decode,DOC_EXT,KEYWORDS,EXCLUDE
from prepare_collected_sources import digest

# 下位ページは評価資料の語を含むリンク文字列だけ。公共事業評価・環境影響評価・事業者向け案内などは対象外
PAGE_LABEL=re.compile(r'事務事業|政策評価|施策評価|行政評価|事業評価|政策等の評価|重点課題に関する評価|点検|検証票|レビュー|成果|調書|シート|PDCA|事業整理|事業体系')
PAGE_EXCLUDE=re.compile(r'トップ|ホーム|サイトマップ|お問い合わせ|問合せ|English|ふりがな|文字サイズ|検索|ログイン|RSS|プライバシー|個人情報|アクセシビリティ|事業者|公共事業|環境影響|障がい|障害|サービス|入札|監査|道州制|分権|制度|基本方針|実施計画|ってどんな|について$')
HTML_PATH=re.compile(r'(\.html?|/)$|^[^.]*$',re.I)

def harvest(root,dirs,per_prefecture):
 public=root/'apps/web/public/evaluation-evidence-prefectures';found=originals(dirs)
 index=json.loads((public/'index.json').read_text(encoding='utf-8'))
 shards=[json.loads((public/e['shardPath']).read_text(encoding='utf-8')) for e in index['municipalities']]
 known={s['url'] for sh in shards for s in sh['sources']}
 out=[];report={'pages':0,'documents':0,'pagesAdded':0,'capped':0}
 for sh in shards:
  m=sh['municipality'];docs=[];pages=[]
  for s in sh['sources']:
   a=s['acquisition']
   if a['state']!='acquired' or s['format'] not in ('html','htm') or a.get('sourceSha256') not in found:continue
   path,ctype=found[a['sourceSha256']];raw=path.read_bytes()
   if digest(raw)!=a['sourceSha256']:raise ValueError('Original integrity failure')
   text=decode(raw,ctype)
   if text is None:continue
   try:tree=LH.fromstring(text)
   except Exception:continue
   report['pages']+=1;host=(urllib.parse.urlsplit(s['url']).hostname or '').lower()
   for el in tree.xpath('//a[@href]'):
    try:u=urllib.parse.urlsplit(urllib.parse.urljoin(s['url'],el.get('href').strip()))
    except ValueError:continue
    if u.scheme not in ('http','https') or u.username or u.password or (u.hostname or '').lower()!=host:continue
    url=urllib.parse.urlunsplit(('https',u.netloc,u.path,u.query,''))
    if url in known:continue
    label=re.sub(r'\s+',' ',' '.join(el.itertext())).strip()[:300]
    if DOC_EXT.search(u.path):
     if not (KEYWORDS.search(label) or KEYWORDS.search(urllib.parse.unquote(u.path))) or EXCLUDE.search(label):continue
     known.add(url);docs.append({'url':url,'title':label or urllib.parse.unquote(u.path.rsplit('/',1)[-1]),'format':DOC_EXT.search(u.path).group(1).lower(),
      'evaluationType':s['evaluationType'],'yearNotes':'未確認（リンク文字列のみ）','evidenceUrl':s['url']})
    elif HTML_PATH.search(u.path) and label and PAGE_LABEL.search(label) and not PAGE_EXCLUDE.search(label) and not EXCLUDE.search(label) and u.path!=urllib.parse.urlsplit(s['url']).path:
     known.add(url);pages.append({'url':url,'title':label,'format':'html','evaluationType':s['evaluationType'],'yearNotes':'未確認（リンク文字列のみ）','evidenceUrl':s['url']})
  if len(docs)>per_prefecture:report['capped']+=len(docs)-per_prefecture;docs=docs[:per_prefecture]
  if docs or pages:
   out.append({'prefectureCode':m['prefectureCode'],'prefectureName':m['municipalityName'],'landingPages':pages,'documents':docs,'amountsVisible':'unknown',
    'notes':'第1回で保存した公式ページの本文リンクから機械的に収集。リンク先の内容・資料区分は未確認。','notFound':False})
  report['documents']+=len(docs);report['pagesAdded']+=len(pages)
 return out,report

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--collections',nargs='+',required=True);ap.add_argument('--out',required=True);ap.add_argument('--per-prefecture',type=int,default=400)
 a=ap.parse_args();root=pathlib.Path(__file__).resolve().parent.parent
 prefectures,report=harvest(root,[pathlib.Path(c) for c in a.collections],a.per_prefecture)
 (root/a.out if not pathlib.Path(a.out).is_absolute() else pathlib.Path(a.out)).write_text(json.dumps({'prefectures':prefectures},ensure_ascii=False,indent=1),encoding='utf-8')
 report['prefectures']=len(prefectures);print(json.dumps(report,ensure_ascii=False,indent=1))
