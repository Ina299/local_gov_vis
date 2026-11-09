"""Rebuild pinned, reviewed Shizuoka maps; never fetch municipal sources."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[4]
for filename,output,export in [('shizuoka-mori-reviewed.json','descending-mori-map.ts','configs'),('shizuoka-sheets-reviewed.json','descending-shizuoka-sheets-map.ts','sheets')]:
 data=json.loads(Path(__file__).with_name(filename).read_text())
 (root/'apps/crawler/src/evaluations/expansion'/output).write_text('export const '+export+' = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n')
