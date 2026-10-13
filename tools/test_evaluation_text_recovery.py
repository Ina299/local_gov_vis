import copy,gzip,json,pathlib,unittest
from evaluation_cache_overlay import permits_explicit_text_recovery,digest,encode
ROOT=pathlib.Path(__file__).resolve().parents[1]
FROZEN=json.loads(gzip.decompress((ROOT/'data/evaluations/navigation-base-v1.json.gz').read_bytes()))
CITY=json.loads(FROZEN['files']['municipalities/06402.json'])
OLD=next(s for s in CITY['sources'] if s['acquisition']['sourceSha256']=='5ff4ae9dc8130bdc319c8343ce9de00485abfa772dc37c916f1e0734c74198dd')
class ExplicitTextRecoveryTests(unittest.TestCase):
 def fixture(self):
  old=copy.deepcopy(OLD);new=copy.deepcopy(old)
  new['text'].update(status='available',extractionMethod='public_form_content_from_verified_bytes')
  item={'newDownload':False,'document':{},'textRecovery':{'method':'public_form_content_from_verified_bytes','previousSourceSha256':digest(encode(old)),'previousTextStatus':'no_readable_text','rawSourceSha256':old['acquisition']['sourceSha256']}}
  return old,new,item
 def test_explicit_pinned_missing_text_only(self):
  self.assertTrue(permits_explicit_text_recovery(*self.fixture()))
 def test_every_nontext_field_is_immutable(self):
  changes={'title':'Changed','evaluationType':'business_project_evaluation','role':'evaluation_document','years':[{'year':2025}],'url':'https://other.example/','verification':{'status':'verified'},'acquisition':{'state':'acquired'}}
  for key,value in changes.items():
   with self.subTest(key=key):
    old,new,item=self.fixture();new[key]=value;self.assertFalse(permits_explicit_text_recovery(old,new,item))
 def test_403_unsupported_and_non_network_rejected_even_with_matching_proof(self):
  for key,value in [('httpStatus',403),('httpStatus',None),('inputStatus','unsupported'),('inputStatus','blocked'),('method','archive_member'),('containerSha256','a'*64)]:
   with self.subTest(key=key,value=value):
    old,new,item=self.fixture();old['acquisition'][key]=value;new['acquisition'][key]=value;item['textRecovery']['previousSourceSha256']=digest(encode(old));self.assertFalse(permits_explicit_text_recovery(old,new,item))
 def test_stale_preimage_rejected(self):
  old,new,item=self.fixture();item['textRecovery']['previousSourceSha256']='a'*64;self.assertFalse(permits_explicit_text_recovery(old,new,item))
 def test_existing_readable_text_or_assets_cannot_be_replaced(self):
  for key,value in [('status','available'),('assetPath','documents/x.json'),('assetSha256','a'*64),('preview','existing'),('textSha256','a'*64),('exportedCharacters',1),('truncated',True),('assetBytes',1)]:
   with self.subTest(key=key):
    old,new,item=self.fixture();old['text'][key]=value;item['textRecovery']['previousSourceSha256']=digest(encode(old));self.assertFalse(permits_explicit_text_recovery(old,new,item))
 def test_raw_and_input_hash_bindings(self):
  for field in ('proof','oldInput','newInput'):
   with self.subTest(field=field):
    old,new,item=self.fixture()
    if field=='proof':item['textRecovery']['rawSourceSha256']='a'*64
    elif field=='oldInput':old['text']['inputTextSha256']='a'*64;item['textRecovery']['previousSourceSha256']=digest(encode(old))
    else:new['text']['inputTextSha256']='a'*64
    self.assertFalse(permits_explicit_text_recovery(old,new,item))
 def test_no_implicit_or_network_promotion(self):
  for mutate in (lambda i:i.pop('textRecovery'),lambda i:i.update(newDownload=True),lambda i:i.update(document=None)):
   old,new,item=self.fixture();mutate(item);self.assertFalse(permits_explicit_text_recovery(old,new,item))
 def test_only_named_extraction_method(self):
  old,new,item=self.fixture();new['text']['extractionMethod']='anything';self.assertFalse(permits_explicit_text_recovery(old,new,item))
if __name__=='__main__':unittest.main()
