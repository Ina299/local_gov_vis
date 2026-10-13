import copy,hashlib,json,unittest
from pathlib import Path
from evaluation_public_html import extract_public_body,source_eligibility
Q=Path(__file__).resolve().parent/'fixtures/evaluation-public-html'
BODY='令和七年度行政評価の結果を公表します。事業の目的、評価方法、改善方針を確認できる公開資料をご覧ください。'
def doc(inner):return ('<html><head><title>行政評価｜試験町</title></head><body>'+inner+'</body></html>').encode()
class SafeFormTests(unittest.TestCase):
 def ex(self,inner,status=200):return extract_public_body(doc(inner),'https://www.town.test.lg.jp/report.html',status)
 def test_nested_public_main_survives_webforms(self):self.assertIn(BODY,self.ex('<form id="aspnetForm"><main>'+BODY+'</main></form>')['text'])
 def test_nested_article_survives(self):self.assertIn(BODY,self.ex('<form><div><article>'+BODY+'</article></div></form>')['text'])
 def test_hidden_viewstate_controls_are_not_exported(self):
  x=self.ex('<form><input type="hidden" name="__VIEWSTATE" value="secret-state"><main>'+BODY+'<input value="private"> <textarea>private</textarea><select><option>private</option></select><button>private</button></main></form>')['text'];self.assertNotIn('private',x);self.assertNotIn('secret',x)
 def test_password_form_is_not_recovered(self):self.assertEqual(self.ex('<form><input type="password"><main>'+BODY+'</main></form>')['text'],'')
 def test_login_action_without_password_is_excluded(self):self.assertEqual(self.ex('<form action="/login.aspx"><main>'+BODY+'</main></form>')['text'],'')
 def test_separate_login_does_not_remove_public_article(self):self.assertIn(BODY,self.ex('<form action="/signin"><div>private</div></form><article>'+BODY+'</article>')['text'])
 def test_hidden_nodes_are_removed(self):
  x=self.ex('<main>'+BODY+'<p hidden>private1</p><p aria-hidden="true">private2</p><p style="display:none">private3</p><p style="visibility:hidden">private4</p><p class="hidden">private5</p></main>')['text'];self.assertNotIn('private',x)
 def test_script_style_and_cms_configuration_are_removed(self):
  x=self.ex('<main>'+BODY+'<script>SECRET_SCRIPT</script><style>SECRET_STYLE</style><div id="CMSConfig">SECRET_CONFIG</div><p>const secret = "SECRET_VAR";</p></main>')['text'];self.assertNotIn('SECRET_',x)
 def test_contact_sidebar_is_removed(self):
  x=self.ex('<main>'+BODY+'<aside>PRIVATE_ADDRESS</aside><div class="contact_us">PRIVATE_CONTACT</div><div class="sidebar">PRIVATE_SIDEBAR</div></main>')['text'];self.assertNotIn('PRIVATE_',x)
 def test_public_layout_sidebar_reverse_is_not_a_sidebar(self):self.assertIn(BODY,self.ex('<div class="sidebar-reverse"><main>'+BODY+'</main><div class="sidebar">private</div></div>')['text'])
 def test_403_article_is_not_recovered(self):self.assertEqual(self.ex('<form><main>'+BODY+'</main></form>',403)['status'],'excluded_non_success_http')
 def test_non_success_and_unknown_status_rejected(self):
  for status in (None,401,429,500):self.assertEqual(self.ex('<main>'+BODY+'</main>',status)['text'],'')
 def test_source_input_status_is_guarded(self):
  s=copy.deepcopy(json.loads((Q/'baseline-selected-sources.json').read_text())[0]['source']);s['acquisition']['inputStatus']='blocked';self.assertEqual(source_eligibility(s),'excluded_input_status_blocked');s['acquisition']['inputStatus']='unsupported';self.assertEqual(source_eligibility(s),'excluded_input_status_unsupported')
 def test_real_two_403_sources_rejected(self):
  sources=json.loads((Q/'baseline-selected-sources.json').read_text());blocked=[x for x in sources if x['source']['acquisition']['httpStatus']==403];self.assertEqual(len(blocked),2)
  for x in blocked:self.assertEqual(source_eligibility(x['source']),'excluded_non_success_http')
 def test_no_public_region_no_body_fallback(self):self.assertEqual(self.ex('<form>'+BODY+'</form>')['text'],'')
 def test_title_only_is_not_readable(self):self.assertEqual(self.ex('<main>行政評価</main>')['status'],'excluded_insufficient_public_body')
 def test_long_title_does_not_promote_empty_body(self):
  raw=('<html><head><title>'+BODY+'</title></head><body><main>行政評価</main></body></html>').encode();self.assertEqual(extract_public_body(raw,'https://example.lg.jp/',200)['text'],'')
 def test_long_h1_alone_does_not_promote_body(self):self.assertEqual(self.ex('<main><h1>'+BODY+'</h1></main>')['text'],'')
 def test_hash_mismatch_is_rejected(self):self.assertEqual(extract_public_body(doc('<main>'+BODY+'</main>'),'https://example.lg.jp/',200,'a'*64)['status'],'excluded_hash_mismatch')
 def test_bad_utf8_rejected(self):self.assertEqual(extract_public_body(b'\xff','https://example.lg.jp/',200)['status'],'excluded_decode_error')
 def test_plain_table_values_preserved_without_normalization(self):
  x=self.ex('<main>'+BODY+'<table><tr><td>事業A</td><td>1,234</td><td>改善</td></tr></table></main>')['text'];self.assertIn('1,234',x);self.assertIn('改善',x)
 def test_links_literal_and_safe(self):
  x=self.ex('<main>'+BODY+'<a href="report.pdf">評価報告書</a><a href="javascript:submit()">実行</a><a href="x?token=secret">非公開</a></main>');self.assertEqual(x['links'],[{'url':'https://www.town.test.lg.jp/report.pdf','label':'評価報告書'}])
 def test_existing_text_not_replaced(self):
  s=copy.deepcopy(json.loads((Q/'baseline-selected-sources.json').read_text())[0]['source']);s['text']['status']='available';self.assertEqual(source_eligibility(s),'excluded_existing_text')
 def test_real_recovery_changes_only_text(self):
  old={x['source']['id']:x['source'] for x in json.loads((Q/'baseline-selected-sources.json').read_text())};items=json.loads((Q/'reviewed-cache-gap-candidates.json').read_text())['sources'];self.assertEqual(len(items),25)
  for item in items:
   source=item['source'];before=old[source['id']];self.assertEqual({k:v for k,v in source.items() if k!='text'},{k:v for k,v in before.items() if k!='text'})
   encoded=(json.dumps(before,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode();self.assertEqual(item['textRecovery']['previousSourceSha256'],hashlib.sha256(encoded).hexdigest())
 def test_real_sanitized_bodies_have_no_contact_footer(self):
  items=json.loads((Q/'reviewed-cache-gap-candidates.json').read_text())['sources']
  for item in items:
   for marker in ('お問い合わせ先','お問合せ先','住所：','電話番号/','__VIEWSTATE','__EVENTVALIDATION','SEARCH_ROOT','API_ROOT','@'):self.assertNotIn(marker,item['document']['text'])
 def test_long_h1_alone_does_not_promote_body(self):self.assertEqual(self.ex('<main><h1>'+BODY+'</h1></main>')['text'],'')
 def test_utf8_xml_declaration_is_supported(self):
  raw=b'<?xml version="1.0" encoding="UTF-8"?>'+doc('<form><main>'+BODY+'</main></form>');self.assertIn(BODY,extract_public_body(raw,'https://example.lg.jp/',200)['text'])
 def test_empty_markup_is_rejected_without_crashing(self):self.assertEqual(extract_public_body(b'   ','https://example.lg.jp/',200)['status'],'excluded_html_parse_error')
 def test_wordpress_post_content_is_generic_public_region(self):
  for cls in ('entry-content','post-content','elementor-widget-theme-post-content'):self.assertIn(BODY,self.ex('<div class="'+cls+'">'+BODY+'</div>')['text'])
 def test_breadcrumb_title_update_shell_is_not_readable(self):
  inner='<main>ここから本文<div class="navibar">トップ&gt;財務課&gt;行財政改革&gt;行政評価&gt;財務課&gt;行財政改革</div><h1>'+BODY+'</h1><p>更新：2026年02月27日</p>トップに戻る</main>';self.assertEqual(self.ex(inner)['text'],'')
if __name__=='__main__':unittest.main()
