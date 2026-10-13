import copy,json,pathlib,tempfile,unittest
from evaluation_identity_corrections import apply_identity_corrections
ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'data/evaluations/navigation-identity-corrections.json').read_text())
class IdentityCorrectionsTests(unittest.TestCase):
 def trial(self,mutate=None):
  with tempfile.TemporaryDirectory() as tmp:
   root=pathlib.Path(tmp);out=root/'out';(root/'data/evaluations').mkdir(parents=True);out.mkdir();payload=copy.deepcopy(DATA);row=payload['corrections'][0]
   e={'municipalityCode':row['municipalityCode'],'municipalityName':row['municipalityName'],'prefectureCode':row['prefectureCode'],'officialFallback':{'url':row['removeFallbackUrl'],'evidenceSha256':row['evidenceSha256']},'officialHomepage':None,'sourceCount':0,'textDocumentCount':0,'shardPath':'city.json'}
   city={'officialFallback':copy.deepcopy(e['officialFallback']),'officialDirectoryLinks':[copy.deepcopy(e['officialFallback'])]};(out/'city.json').write_text(json.dumps(city));index={'municipalities':[e]}
   if mutate:mutate(payload)
   (root/'data/evaluations/navigation-identity-corrections.json').write_text(json.dumps(payload));n=apply_identity_corrections(root,out,index);return n,index,json.loads((out/'city.json').read_text())
 def test_remove_proven_wrong_fallback_without_guessing_replacement(self):
  n,index,city=self.trial();self.assertEqual(n,1);self.assertIsNone(index['municipalities'][0]['officialFallback']);self.assertEqual(city['officialDirectoryLinks'],[]);self.assertEqual(index['municipalities'][0]['evidenceStatus'],'no_verified_sources')
 def test_wrong_prefecture_rejected(self):
  with self.assertRaises(AssertionError):self.trial(lambda p:p['corrections'][0].update(prefectureCode='43'))
 def test_wrong_evidence_hash_rejected(self):
  with self.assertRaises(AssertionError):self.trial(lambda p:p['corrections'][0].update(evidenceSha256='a'*64))
if __name__=='__main__':unittest.main()
