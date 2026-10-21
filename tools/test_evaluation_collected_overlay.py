import copy,json,pathlib,tempfile,unittest
from evaluation_collected_overlay import apply_collected_overlay,digest,encode
ROOT=pathlib.Path(__file__).resolve().parents[1]
INPUT=json.loads((ROOT/'data/evaluations/collected-sources-batch7.json').read_text(encoding='utf-8'))
class CollectedOverlayTests(unittest.TestCase):
 def trial(self,mutate_item=None,mutate_old=None):
  item=copy.deepcopy(next(x for x in INPUT['sources'] if x['text']['status']=='available'))
  code=item['municipalityCode']
  with tempfile.TemporaryDirectory() as tmp:
   root=pathlib.Path(tmp);out=root/'public';docs=root/'apps/web/public/evaluation-evidence/documents'
   (root/'data/evaluations').mkdir(parents=True);(out/'municipalities').mkdir(parents=True);docs.mkdir(parents=True)
   asset=(ROOT/'apps/web/public/evaluation-evidence'/item['text']['assetPath']).read_bytes();(docs/f"{item['sourceId']}.json").write_bytes(asset)
   if mutate_item:mutate_item(item)
   (root/'data/evaluations/collected-sources-batch7.json').write_bytes(encode({**INPUT,'sources':[item]}))
   old={'id':item['sourceId'],'url':item['url'],'role':'supporting_document','verification':{'status':'verified'},
    'acquisition':{'state':item['previousAcquisitionState'],'sourceSha256':None},'text':{'status':'not_acquired'}}
   if mutate_old:mutate_old(old)
   (out/f'municipalities/{code}.json').write_bytes(encode({'sources':[old],'discovery':{'status':'discovered'}}))
   index={'snapshotAt':'2026-10-12T00:00:00Z','counts':{'truncatedTextDocuments':0},'municipalities':[{'municipalityCode':code,'municipalityName':item['municipalityName'],'shardPath':f'municipalities/{code}.json','sourceCount':1,'officialHomepage':None,'officialFallback':None}]}
   report=apply_collected_overlay(root,out,index,root/'data/evaluations/collected-sources-batch7.json')
   return report,index,json.loads((out/f'municipalities/{code}.json').read_text(encoding='utf-8'))
 def test_upgrades_unacquired_row_with_pinned_text(self):
  report,index,city=self.trial()
  self.assertEqual(report['textAssets'],1);self.assertEqual(city['sources'][0]['acquisition']['state'],'acquired')
  self.assertEqual(city['discovery']['status'],'fetched');self.assertEqual(index['municipalities'][0]['evidenceStatus'],'text_available')
 def test_tampered_text_hash_rejected(self):
  with self.assertRaises(AssertionError):self.trial(lambda x:x['text'].update(assetSha256='a'*64))
 def test_never_replaces_already_acquired_bytes(self):
  with self.assertRaises(AssertionError):self.trial(mutate_old=lambda o:o['acquisition'].update(state='acquired',sourceSha256='b'*64))
 def test_unverified_row_rejected(self):
  with self.assertRaises(AssertionError):self.trial(mutate_old=lambda o:o['verification'].update(status='unverified'))
if __name__=='__main__':unittest.main()
