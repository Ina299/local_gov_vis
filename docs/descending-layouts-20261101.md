# Descending cached-layout review, 2026-11-01

Local candidate branch based on preserved `3fba0972c3f6cb00b8a7b3393a82374162b1ff79`. Master read-only reference remains `afa1c415e26f2f63d5d3f2c397b8dcf167f522a6`; the prior53-municipality exclusion is preserved. Unpublished user changes cannot be observed. No municipal requests, external writes or production index changes.

## Kagoshima milestone

43 municipalities,128 sources;93 hash-verified cached bodies (92 complete,1 incomplete),35 missing bodies. New candidate records:1,271 across11 municipalities, with2,928 validated exact evidence references. This is additional to the earlier43 Kagoshima candidates. Existing fields changed:0. Production records added:0.

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

## Miyazaki milestone

26 municipalities,67 sources:47 cached bodies hash-verified,45 complete,2 incomplete;20 absent bodies.813 additional candidates across7 municipalities:新富町765,諸塚村22,延岡市12,三股町8,椎葉村3,宮崎市2,美郷町1. Combined with Kagoshima this phase contains2,084 candidates and5,312 validated exact evidence references. No production changes.

Shintomi's five annual verification books contain numbered operational items, explicitly described by the saved official landing page as each department's annual individual businesses. Chapter headings and KPI tables are not records. No numeric/outcome alignment is inferred; deferred/unexecuted activities are not labelled successful. The purported2022 verification link actually caches a July2022 plan: it is held pending the correct result text. The same cached landing page explicitly establishes2015/2016 grant execution years for seven further named projects.

Miyazaki city's113-row new-proposal list is reviewed completely: six title variants are held against named existing IDs,105 entries are already represented, and two new entries are isolated.2025 is the assessment year; proposed2026 implementation is not treated as actual expenditure. Mimata's eight newspaper evaluation entries keep2013 assessment year and unknown execution year.

All67 sources have dispositions in the source and coverage ledgers.20 absent bodies,2 incomplete bodies, the wrong Shintomi planning artifact, mixed-year benefits, six identity collisions, regional/shared-scope attribution and documents containing only population/aggregate/entity evaluations remain distinguished. Layout labels alone are not used as terminal reasons. Original access gates remain intact.

Validation: crawler full suite382/382 and final focused4/4 (383 unique tests across runs); Web256/256; lint, typecheck and national verification passed. Static export with `/local_gov_vis` passed with the documented build-only optional-font setting and exact config restoration. These are local checks, not remote CI or publication.

## Oita work in progress

16 selected municipalities,104 sources:93 cached bodies hash-verified (92 complete,1 incomplete),11 absent.465 isolated candidates:豊後高田市151,竹田市132,九重町82,由布市27,宇佐市26,国東市24,姫島村23. This is356 more than the109-record checkpoint; production additions and existing-field changes are0. The combined46/45/44 phase has2,549 candidates and6,361 exact evidence references. Shared indexes are unchanged. Master was rechecked read-only at afa1c415e26f2f63d5d3f2c397b8dcf167f522a6; unpublished user edits remain unobservable.

Kunisaki's report has24 named activities retaining2023 execution and2024 committee evaluation. Generic governance, unnamed shared subactivities and future plans are excluded or held. Usa uses actual sheet years rather than misleading cover years, preserving two year-conflict holds. Bungotakada maps154 raw annual titles with per-row execution periods, cached official annual link labels for early books, and one record per shared-funding business. The2022-heading/2021-body telework sheet is held. No amounts/ratings transferred. Original PDF hashes are retained provenance; cached text and assets were cryptographically verified.

Taketa's grant table has16 plan rows:3 completed single-year businesses,1 duplicate school-lunch funding portion,12 carryover/mixed-year holds. Education books contribute129 names:27 fromFY2020,42 fromFY2021 and60 fromFY2025. These are annual reviewed business/activity identities, not a claim that every activity was completed or every cost is actual. Exact complete-source and bounded-sheet hashes protect manually reviewed interleaved names. The44 actual FY2025 sheets are reviewed; reversed title fragments, repeated generic identities and shared activities retain individual reasons. The older books retain67 actionable sheet-review units; source-level processed status does not mean full coverage.

The parser ledger retains35 unsupported sources. A separate hash-checked content audit classifies7 Beppu facility/operator assessments and2 Oita committee rosters as related evidence, leaving26 for content/layout review, including Bungotakada policy/KPI books, Saiki, Beppu reform reports and Oita city. The9 documents are not converted into individual businesses. See remaining-source-triage.json. No acquisition is authorized while original cumulative stop evidence is missing; missing-body sources remain held. Do not start Kumamoto before finishing Oita or establishing source-specific genuine evidence blockers. This checkpoint is not exhaustion of Oita or nationwide work.

Validation: full crawler393/393; final focused10/10; typecheck, Web256/256, lint, national verification and static export109pages with `/local_gov_vis` passed. Optional remote fonts were disabled only during build and the exact config restored. The final full crawler run passed on the latest parser code at e5741bf85cecc87234619eacc3c9349d8b2cfa50. These are local results, not remote CI/publication.

## Oita KPI checkpoint — offline, unpublished

Four complete hash-matched Bungotakada tables add 250 name/year-only activity candidates (50 per FY2020–2024), bringing Oita to715 and combined46/45/44 to2799. Individual activity identity is distinct from budget-business identity; no amounts or shared KPI values transferred. One grant/activity identity collision per book stays held. Focused11/11, independent2799-record/6861-evidence validation and typecheck pass. Full393-test regression belongs to the previous465-record snapshot; the extension still needs full regression. Source and unit review remains unfinished; no network or publication action.
