# Kagawa offline candidate review — reviewed cached cohort

Descending-code isolated cohort: 16 municipalities from Manno (37406) to Takamatsu (37201), excluding Marugame (37202) and all 53 recent-master municipalities. Read-only master observation: afa1c415e26f2f63d5d3f2c397b8dcf167f522a6. User unpublished edits are not observable.

95 source entries, 86 hash-verified complete cached bodies, 6 verified continuation parts and 9 absent bodies. This cohort contains 338 candidate records in nine municipalities: まんのう町、多度津町、綾川町、小豆島町、土庄町、東かがわ市、さぬき市、観音寺市、善通寺市. This increment adds 133 candidates to the saved 205; existing-field enrichment is zero. Production additions and existing-field changes are zero. No acquisition or external writes.

All exact quotations, offsets, source/full-text hashes and fiscal-year proofs are preserved. Financial allocation rows are not separate projects. Policy chapters, KPI rows and explanatory templates are excluded. Publication year is distinct from the evaluated year. Future fiscal-year starts explicitly dated in the source are retained with their own year; numeric fields are omitted.

All 95 source entries have a disposition. The 21 retained evidence-hold units include missing row-level fiscal years in mixed-year reports, unclear municipal responsibility, reversed title fragments without column coordinates, aliases and unmatched printed row boundaries. Nine missing bodies remain blocked without acquisition. Generic layout-review units are zero; this is a bounded cached review, not complete prefectural or national collection.

Sanuki's 20 additional annual candidates use verified covers and complete two/three-page sheet boundaries. The preserved PR head d618e01fc476e73488cc5dce22f41d95d8ea12c2 contains 430 earlier records, which were not reimported or edited. Exact normalized name/year comparison (including unknown-period collisions) found no collisions for these 20. Prior unknown-period and alias decisions are retained in sanuki-prior-review-audit.json. All six continuation parts were rehashed before review.

Zentsuji's two same-name school projects retain their literal titles. Only their exact source-pinned candidate identities and distinct elementary/middle-school purpose quotations bypass name-only candidate deduplication. Changed identities, years or evidence cannot use this exception. Kanonji's cancelled triathlon retains its cancellation narrative; no actual participation or expenditure is inferred. Higashikagawa's 36 covered sheets remain suppressed; only three absent projects are candidates. Manno's named-activity disposition and mixed-year holds are recorded separately.


Reproduce from repository root:

```
python apps/crawler/scripts/descending-cache/build-kagawa-map.py
node --import tsx apps/crawler/src/review-descending-cache.ts data/evaluations/descending-layouts/37/cohort.json data/evaluations/descending-layouts/37 data/evaluations/descending-offline
node --import tsx apps/crawler/src/validate-descending-cache.ts --layouts
node --import tsx --test apps/crawler/tests/descending-kagawa.test.ts
```

The canonical reviewed input is apps/crawler/scripts/descending-cache/kagawa-reviewed.json. Full regression results must be recorded separately for each saved head. No municipality fetch is allowed while the original six manifests or provenance-verified complete cumulative holds ledger remain unavailable. No push, PR changes, merge or deployment is authorized.
