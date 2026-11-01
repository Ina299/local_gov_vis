# Descending cached-layout review, 2026-11-01

Local candidate branch based on preserved `3fba0972c3f6cb00b8a7b3393a82374162b1ff79`. Master read-only reference remains `afa1c415e26f2f63d5d3f2c397b8dcf167f522a6`; the prior53-municipality exclusion is preserved. Unpublished user changes cannot be observed. No municipal requests, external writes or production index changes.

## Kagoshima milestone

43 municipalities,128 sources;93 complete hash-verified cached bodies,35 missing bodies. New candidate records:1,271 across11 municipalities, with2,928 validated exact evidence references. This is additional to the earlier43 Kagoshima candidates. Existing fields changed:0. Production records added:0.

| Municipality | Additional candidates |
|---|---:|
| 龍郷町 |160|
| 瀬戸内町 |43|
| 中種子町 |1|
| 長島町 |45|
| さつま町 |58|
| 南九州市 |29|
| 霧島市 |887|
| 曽於市 |7|
| 西之表市 |5|
| 指宿市 |25|
| 鹿児島市 |11|

Names, explicit fiscal/evaluation years, exact cached-text quotes and source provenance are preserved. Annual actual/forecast/requested amounts are not guessed. Source PDF byte hashes are recorded provenance, not a claim that absent original PDF bytes were rehashed. Cache asset/text hashes were recomputed. Kirishima lists account for530+536 original rows before deduplication. Kagoshima city11 wrapped rows require exact annual attribution from a separately hash-verified cached landing page.

`data/evaluations/descending-layouts/46/source-ledger.json` and `coverage-review.json` retain every source and individual parser disposition. Mixed-year grants, ambiguous same-name identities, aggregate policy/indicator reports, templates and incomplete text are explicitly distinguished. Isa's preface announces33 projects while cached individual purpose blocks total31; two identities are not invented.35 absent bodies and one incomplete Kagoshima book remain held. These are not current network denials. Acquisition still requires the six original hash-matching manifests or provenance-verifiable cumulative hold ledger.

Reproduce:

```
node --import tsx apps/crawler/src/review-descending-cache.ts data/evaluations/descending-offline/46/cohort.json data/evaluations/descending-layouts/46 data/evaluations/descending-offline
node --import tsx apps/crawler/src/validate-descending-cache.ts --layouts
node --import tsx --test apps/crawler/tests/descending-layouts-r2.test.ts
```

The coverage review contains additional manual findings and is preserved separately from regenerated parser outputs. Candidate import inputs remain outside public assets. The national source-layout queue is not exhausted; next cohort is Miyazaki45, after completing this milestone's validation. Do not interpret this checkpoint as nationwide collection completion.

Validation: crawler full suite378/378 plus final focused14/14 (379 unique tests); Web256/256; final typecheck, lint and national verification pass. Static export with `/local_gov_vis` passed using build-only `optimizeFonts=false` to omit optional font download; original config bytes restored. One existing custom-font lint warning. All candidate citations independently validated. Logs accompany the local recovery artifact.
