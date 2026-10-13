import copy,importlib.util,json,pathlib,tempfile,unittest
from evaluation_cache_overlay import apply_cache_overlay,digest,encode
ROOT=pathlib.Path(__file__).resolve().parents[1]
INPUT=json.loads((ROOT/'data/evaluations/reviewed-cache-sources.json').read_text())
class CacheOverlayTests(unittest.TestCase):
 def trial(self,mutate=None):
  with tempfile.TemporaryDirectory() as tmp:
   root=pathlib.Path(tmp);out=root/'public';(root/'data/evaluations').mkdir(parents=True);(out/'municipalities').mkdir(parents=True)
   payload=copy.deepcopy(INPUT);payload['sources']=[next(x for x in payload['sources'] if x['municipalityCode']=='07544' and x['document'])]
   item=payload['sources'][0];code=item['municipalityCode'];name=item['municipalityName']
   if mutate:mutate(item)
   (root/'data/evaluations/reviewed-cache-sources.json').write_bytes(encode(payload))
   city={'sources':[],'discovery':{'status':'discovered','coverageCompleteness':'not_established','omittedRejectedSources':1},'evaluationPages':[]}
   (out/f'municipalities/{code}.json').write_bytes(encode(city))
   index={'snapshotAt':'2026-10-12T00:00:00Z','counts':{},'municipalities':[{'municipalityCode':code,'municipalityName':name,'shardPath':f'municipalities/{code}.json','officialHomepage':None,'officialFallback':None}]}
   return apply_cache_overlay(root,out,index),index,json.loads((out/f'municipalities/{code}.json').read_text())
 def test_substantive_html_is_readable_source_not_numeric_normalization(self):
  report,index,city=self.trial();self.assertEqual(report['textAssets'],1);self.assertEqual(city['sources'][0]['format'],'html');self.assertEqual(city['sources'][0]['role'],'evaluation_document');self.assertEqual(index['municipalities'][0]['textDocumentCount'],1)
 def test_tampered_source_hash_rejected(self):
  with self.assertRaises(AssertionError):self.trial(lambda x:x['source']['acquisition'].update(sourceSha256='a'*64))
 def test_tampered_text_rejected(self):
  with self.assertRaises(AssertionError):self.trial(lambda x:x['document'].update(text='invented'))
 def test_cross_municipality_document_rejected(self):
  with self.assertRaises(AssertionError):self.trial(lambda x:x['document'].update(municipalityCode='00000'))
 def test_wrong_document_id_rejected(self):
  with self.assertRaises(AssertionError):self.trial(lambda x:x['document'].update(sourceId='a'*24))
 def test_unsafe_asset_path_rejected(self):
  with self.assertRaises(AssertionError):self.trial(lambda x:x['source']['text'].update(assetPath='../outside.json'))
 def test_guidelines_are_supporting_sources(self):
  item=next(x for x in INPUT['sources'] if x['municipalityCode']=='31386' and '設置要綱' in x['source']['title']);self.assertEqual(item['source']['role'],'supporting_document')
 def test_meeting_minutes_are_supporting_sources(self):
  items=[x for x in INPUT['sources'] if x['municipalityCode']=='01428' and x['source']['acquisition']['state']=='discovered'];self.assertEqual(len(items),6)
  for item in items:self.assertEqual(item['source']['role'],'supporting_document');self.assertEqual(item['source']['verification']['evaluationRelevance'],'not_established')
 def test_education_child_not_inherited_business_evaluation(self):
  item=next(x for x in INPUT['sources'] if x['source']['url'].endswith('/tenkenhyoka.html'));self.assertEqual(item['source']['evaluationType'],'education_inspection')
 def test_wrong_city_and_contact_sources_not_promoted(self):
  accepted={x['municipalityCode'] for x in INPUT['sources']};self.assertFalse(accepted & {'07548','17386','20303','20306','29442'});self.assertEqual(len(INPUT['excludedSources']),13)
if __name__=='__main__':unittest.main()
