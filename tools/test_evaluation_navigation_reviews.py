import importlib.util,pathlib,unittest
P=pathlib.Path(__file__).with_name('build-evaluation-navigation-reviews.py')
spec=importlib.util.spec_from_file_location('reviews',P);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ReviewsTests(unittest.TestCase):
 def row(self):return {'municipalityCode':'01211','url':'https://www.city.abashiri.hokkaido.jp/soshiki/2/1115.html','verification':'verified','format':'html','evaluationRelevant':True,'title':'公開資料案内','evaluationType':'business_project_evaluation','checkedAt':'2026-10-12T10:00:00Z','publisher':'網走市','evidenceUrl':'https://www.city.abashiri.hokkaido.jp/soshiki/2/1115.html','notes':'資料への公式リンクを確認。','yearNotes':'令和6年度対象。'}
 def test_raw_acquisition_never_invented(self):
  s=m.source(self.row(),set());self.assertEqual(s['role'],'evaluation_landing_page');self.assertEqual(s['acquisition']['state'],'discovered');self.assertIsNone(s['acquisition']['sourceSha256']);self.assertEqual(s['text']['status'],'not_acquired');self.assertEqual(s['years'],[])
 def test_candidate_never_promoted(self):
  r=self.row();r['verification']='candidate';s=m.source(r,set());self.assertEqual(s['role'],'candidate');self.assertEqual(s['verification']['status'],'unverified')
 def test_quarantine_prevents_new_verification(self):
  with self.assertRaises(ValueError):m.source(self.row(),{'www.city.abashiri.hokkaido.jp'})
 def test_candidate_on_quarantined_host_is_blocked(self):
  r=self.row();r['verification']='candidate';self.assertEqual(m.source(r,{'www.city.abashiri.hokkaido.jp'})['acquisition']['state'],'blocked')
 def test_www_alias_does_not_bypass_host_hold(self):
  with self.assertRaises(ValueError):m.source(self.row(),{'city.abashiri.hokkaido.jp'})
  r=self.row();r['verification']='candidate';self.assertEqual(m.source(r,{'city.abashiri.hokkaido.jp'})['acquisition']['state'],'blocked')
 def test_urls_require_safe_protocol_and_no_userinfo(self):
  for url in ['javascript:alert(1)','file:///tmp/a','//example.com/a','https://user:password@example.com/a']:
   with self.assertRaises(ValueError):m.safe_url(url)
 def test_same_url_different_cities_never_share_identity(self):
  self.assertNotEqual(m.source_id('13206','https://example.lg.jp/a.pdf'),m.source_id('34208','https://example.lg.jp/a.pdf'))
 def test_year_notes_do_not_become_printed_year_evidence(self):
  r=self.row();r['yearNotes']='年次未確認';self.assertEqual(m.source(r,set())['years'],[])
if __name__=='__main__':unittest.main()
