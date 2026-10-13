import copy,importlib.util,pathlib,unittest
P=pathlib.Path(__file__).with_name('build-evaluation-navigation-reviews.py');spec=importlib.util.spec_from_file_location('reviews_upgrade',P);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class CandidateUpgradeTests(unittest.TestCase):
 def setUp(self):
  row={'municipalityCode':'01211','url':'https://www.city.abashiri.hokkaido.jp/example','verification':'verified','format':'html','evaluationRelevant':True,'title':'評価資料','evaluationType':'business_project_evaluation','checkedAt':'2026-10-12T10:00:00Z','publisher':'網走市','evidenceUrl':'https://www.city.abashiri.hokkaido.jp/example','notes':'公式の参照関係を確認。','yearNotes':'年度不明'};self.new=m.source(row,set());self.old=copy.deepcopy(self.new);self.old['id']='a'*24;self.old['verification']['status']='unverified';self.old['role']='candidate';self.city={'sources':[self.old]}
 def test_empty_candidate_becomes_navigation_only(self):
  self.assertEqual(m.merge_reviewed_source(self.city,self.new),'upgraded_unacquired_candidate');self.assertEqual(self.city['sources'],[self.new]);self.assertIsNone(self.new['acquisition']['sourceSha256']);self.assertEqual(self.new['text']['status'],'not_acquired')
 def test_existing_verified_source_is_not_replaced(self):
  self.old['verification']['status']='verified';self.assertEqual(m.merge_reviewed_source(self.city,self.new),'preserved');self.assertIs(self.city['sources'][0],self.old)
 def test_old_acquired_bytes_require_separate_review(self):
  self.old['acquisition']['state']='acquired';self.old['acquisition']['sourceSha256']='b'*64;self.assertEqual(m.merge_reviewed_source(self.city,self.new),'retained_candidate_requires_archive_review')
 def test_old_text_requires_separate_review(self):
  self.old['text']['preview']='old body';self.assertEqual(m.merge_reviewed_source(self.city,self.new),'retained_candidate_requires_archive_review')
 def test_old_http_evidence_is_not_promoted(self):
  self.old['acquisition']['httpStatus']=200;self.assertEqual(m.merge_reviewed_source(self.city,self.new),'retained_candidate_requires_archive_review')
 def test_dependent_evidence_is_preserved(self):
  other=copy.deepcopy(self.old);other['id']='b'*24;other['url']+='child';other['verification']['evidenceSourceId']=self.old['id'];self.city['sources'].append(other);self.assertEqual(m.merge_reviewed_source(self.city,self.new),'retained_candidate_has_dependents')
 def test_candidate_review_never_upgrades(self):
  self.new['verification']['status']='unverified';self.assertEqual(m.merge_reviewed_source(self.city,self.new),'preserved')
 def test_non_null_archive_and_text_evidence_is_never_promoted(self):
  cases=[('acquisition','inputStatus','fetched'),('acquisition','containerSha256','c'*64),('acquisition','memberPath','doc.pdf'),('acquisition','memberIndex',0),('text','assetBytes',1),('text','extractionMethod','cached'),('verification','evidenceSha256','c'*64),('verification','evidenceSourceId','b'*24)]
  for section,key,value in cases:
   with self.subTest(section=section,key=key):
    self.setUp();self.old[section][key]=value;self.assertEqual(m.merge_reviewed_source(self.city,self.new),'retained_candidate_requires_archive_review')
 def test_existing_year_evidence_requires_review(self):
  self.old['years']=[{'year':2025}];self.assertEqual(m.merge_reviewed_source(self.city,self.new),'retained_candidate_requires_archive_review')
 def test_duplicate_archive_members_are_not_replaced_by_url(self):
  self.city['sources'].append(copy.deepcopy(self.old));self.assertEqual(m.merge_reviewed_source(self.city,self.new),'preserved')
if __name__=='__main__':unittest.main()
