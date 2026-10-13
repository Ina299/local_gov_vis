"""Offline public-content extraction; forms are not themselves public content.

Only explicit article/main/CMS content regions survive. Authentication forms,
controls, scripts, hidden/configuration nodes, contacts and navigation are removed.
No requests or script execution are performed. HTTP non-2xx fails closed.
"""
import hashlib,html,re,unicodedata
from urllib.parse import urlsplit,urljoin,urlunsplit,parse_qsl
from lxml import html as LH,etree

METHOD='public_form_content_from_verified_bytes'
SECRET=re.compile(r'__VIEWSTATE|__EVENTVALIDATION|__EVENTTARGET|__VIEWSTATEGENERATOR|csrf|xsrf|access[_ -]?token|refresh[_ -]?token|api[_ -]?key|client[_ -]?secret|sessionid|set-cookie|authorization\s*:|bearer\s+|document\.|window\.|function\s*\(|(?:const|let|var)\s+[A-Za-z_$]+\s*=|API_ROOT|SEARCH_ROOT|gcse\.|\$\(|jQuery\(',re.I)
EMAIL=re.compile(r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}',re.I)
PHONE=re.compile(r'(?<!\d)\d{2,5}[-－‐ー]\d{1,4}[-－‐ー]\d{3,4}(?!\d)')
TOKEN=re.compile(r'(?<![A-Za-z0-9])[A-Za-z0-9_+/=-]{48,}(?![A-Za-z0-9])')
AUTH=re.compile(r'(?:^|[/ _-])(?:login|signin|sign-in|authenticate|authentication|auth|session|password)(?:$|[/ ._-])',re.I)
REMOVE={'sidebar','sidenav','gnav','nav','navigation','navibar','pankuzu','topicpath','breadcrumb','breadcrumbs','footer','header','globalnav','global-nav','contact','contact_us','contact-us','contactus','inquiry','feedback','questionnaire','form_section','info_section','kengen_tantoka','tel','fax','mail','snsbutton','hidemenu','leftarea','classmenuarea','search','searchbox','search-box','config','configuration','cms-config','hidden','d-none','is-hidden','recommendblock','recommended','button-page-top','pagetoplink','locus','mokuteki'}
PUBLIC_IDS={'contentpane','mainshosai','main_section','content','article'}
PUBLIC_CLASSES={'contents','contents-container','article','widemenu','rightarea','entry-content','post-content','elementor-widget-theme-post-content'}
BOILERPLATE={'印刷','印刷用ページを開く','大きな文字で印刷','読み上げる','Tweet','シェア','もっと見る','ページ上部に戻る','このページの先頭へ','分類メニュー','ここから本文','ここから本文です。','トップに戻る','上へ戻る'}

def clean(text):
 text=html.unescape(text);text=re.sub(r'[\x00-\x08\x0b\x0e-\x1f\x7f]','',text)
 out=[]
 for line in text.splitlines():
  line=re.sub(r'[\s\u3000]+',' ',line).strip()
  if not line or line in BOILERPLATE or SECRET.search(line):continue
  if PHONE.search(line) or re.search(r'〒\s*[0-9０-９]{3}|メールアドレス',line) or re.fullmatch(r'(?:電話番号?|TEL|FAX|ファクス|ファックス|郵便番号)[:：]?',line,re.I):continue
  if EMAIL.search(line):continue
  line=TOKEN.sub('[長い識別子を省略]',line)
  out.append(line)
 return '\n'.join(out)

def safe_url(value,base):
 try:
  u=urlsplit(urljoin(base,html.unescape(value)))
  if u.scheme not in ('http','https') or not u.hostname or u.username or u.password or u.port not in (None,80,443):return None
  if any(re.search('token|secret|password|session|csrf|auth|signature|credential|api.?key',k,re.I) for k,_ in parse_qsl(u.query)):return None
  return urlunsplit((u.scheme,u.netloc,u.path,u.query,''))
 except ValueError:return None

def extract_public_body(raw,url,http_status,expected_sha256=None):
 if not isinstance(http_status,int) or not 200<=http_status<300:return {'status':'excluded_non_success_http','httpStatus':http_status,'text':'','body':'','links':[]}
 if expected_sha256 and hashlib.sha256(raw).hexdigest()!=expected_sha256:return {'status':'excluded_hash_mismatch','text':'','body':'','links':[]}
 try:decoded=raw.decode('utf-8',errors='strict')
 except UnicodeDecodeError:return {'status':'excluded_decode_error','text':'','body':'','links':[]}
 if '\ufffd' in decoded:return {'status':'excluded_replacement_characters','text':'','body':'','links':[]}
 try:tree=LH.fromstring(raw,parser=LH.HTMLParser(encoding='utf-8',no_network=True,recover=True))
 except (etree.ParserError,ValueError):return {'status':'excluded_html_parse_error','text':'','body':'','links':[]}
 title=clean(' '.join(tree.xpath('/html/head/title//text()')))
 forms=list(tree.xpath('//form'));auth_removed=0
 # Detect credential forms BEFORE dropping controls. Removing the whole credential
 # form also prevents a misleading <main> nested inside it being exported.
 for form in forms:
  marker=' '.join(form.get(k,'') for k in ('id','name','action'))
  if form.xpath('.//input[translate(@type,"PASSWORD","password")="password"]') or AUTH.search(marker):
   form.drop_tree();auth_removed+=1
 for e in list(tree.xpath('//script|//style|//noscript|//template|//iframe|//object|//embed|//svg|//canvas|//head|//input|//textarea|//select|//option|//button|//datalist|//label[@for]')):
  if e.getparent() is not None:e.drop_tree()
 for e in list(tree.xpath('//*[@hidden or @aria-hidden="true" or @style]')):
  if e.getparent() is not None and (e.get('hidden') is not None or e.get('aria-hidden')=='true' or re.search(r'display\s*:\s*none|visibility\s*:\s*hidden',e.get('style',''),re.I)):e.drop_tree()
 for e in list(tree.xpath('//nav|//aside|//header|//footer')):
  if e.getparent() is not None:e.drop_tree()
 for e in list(tree.xpath('//*[@id or @class]')):
  marks={e.get('id','').lower(),*e.get('class','').lower().split()}
  if e.getparent() is not None and (marks&REMOVE or any(m.startswith(('footer','breadcrumb','contact_','contact-','cmsconfig','jsconfig','classmenuarea')) for m in marks)):e.drop_tree()
 # A surviving public WebForms wrapper is unwrapped, never emitted or submitted.
 for e in list(tree.xpath('//form')):
  if e.getparent() is not None:e.drop_tag()
 candidates=[]
 for e in tree.iter():
  if not isinstance(e.tag,str):continue
  ident=e.get('id','').lower();classes=set(e.get('class','').lower().split())
  priority=120 if classes&{'contents','contents-container'} else 100 if ident in PUBLIC_IDS or classes&PUBLIC_CLASSES else 90 if e.tag in ('article','main') else 50 if ident in ('main','mainblock','contents') else 0
  if not priority:continue
  body=clean('\n'.join(e.itertext()))
  # Stop before a residual contact/feedback section, after structural removal.
  body=re.split(r'\n(?:(?:この記事|このページ).{0,18}(?:お問い合わせ|問い合わせ|アンケート)|お問い合わせ先\s*(?:\n|$)|お問合せ先\s*(?:\n|$)|掲載内容に関するお問い合わせはこちら)',body,maxsplit=1)[0].strip()
  candidates.append((priority,len(body),e,body))
 if not candidates:return {'status':'excluded_no_public_region','title':title,'text':'','body':'','links':[],'authenticationFormsRemoved':auth_removed}
 _,_,node,body=max(candidates,key=lambda x:(x[0],x[1]))
 links=[]
 for a in node.xpath('.//a[@href]'):
  u=safe_url(a.get('href'),url);label=clean(' '.join(a.itertext()))
  if u and label:links.append({'url':u,'label':label})
 # Require actual body content, not a long title plus an empty page shell.
 heading_texts={clean(' '.join(e.itertext())) for e in node.xpath('.//h1')}
 substantive_body='\n'.join(line for line in body.splitlines() if line!=title and line not in heading_texts)
 if len(re.sub(r'\s','',substantive_body))<40:status='excluded_insufficient_public_body'
 else:status='candidate_public_body'
 text=clean(title+'\n'+body) if status=='candidate_public_body' else ''
 return {'status':status,'title':title,'text':text,'body':body,'links':links,'selectedNode':{'tag':node.tag,'id':node.get('id'),'class':node.get('class')},'authenticationFormsRemoved':auth_removed,'formsObserved':len(forms),'method':METHOD}

def source_eligibility(source):
 """Narrow eligibility for additive text recovery, not metadata reclassification."""
 a=source['acquisition'];t=source['text']
 if a.get('httpStatus')!=200:return 'excluded_non_success_http'
 if a.get('inputStatus')!='fetched':return 'excluded_input_status_'+str(a.get('inputStatus'))
 if source.get('format')!='html' or a.get('method')!='network' or any(a.get(k) is not None for k in ('containerSha256','memberPath','memberIndex')):return 'excluded_non_plain_html'
 if source['verification']['status']!='verified':return 'excluded_unverified_identity'
 if t['status']!='no_readable_text' or any(t.get(k) is not None for k in ('assetPath','assetSha256','textSha256','preview')):return 'excluded_existing_text'
 return None
