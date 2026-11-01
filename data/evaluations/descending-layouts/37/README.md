# Kagawa offline candidate review — ongoing

Descending-code isolated cohort: 16 municipalities from Manno (37406) to Takamatsu (37201), excluding Marugame (37202) and all 53 recent-master municipalities. Read-only master observation: afa1c415e26f2f63d5d3f2c397b8dcf167f522a6. User unpublished edits are not observable.

95 source entries, 86 hash-verified complete cached bodies, 6 verified continuation parts and 9 absent bodies. This checkpoint contains 205 candidate records in six municipalities: Manno, Tadotsu, Ayagawa, Shodoshima, Tonosho and Higashikagawa. Production additions and existing-field changes are zero. No acquisition or external writes.

All exact quotations, offsets, source/full-text hashes and fiscal-year proofs are preserved. Financial allocation rows are not separate projects. Policy chapters, KPI rows and explanatory templates are excluded. Publication year is distinct from the evaluated year. Future fiscal-year starts explicitly dated in the source are retained with their own year; numeric fields are omitted.

Work remains: eight Manno review units and fifteen source layouts, including prior Sanuki reviews requiring comparison with the preserved PR branch. Higashikagawa's 36 covered sheets have normalized-text containment and exact existing-year/name matches recorded in higashikagawa-coverage.json; three previously absent projects are candidates. Tonosho's reversed title-column fragments and Tadotsu's unmatched printed row number retain explicit evidence holds. This is not complete prefectural or national coverage.

Reproduce from repository root:

```
python apps/crawler/scripts/descending-cache/build-kagawa-map.py
node --import tsx apps/crawler/src/review-descending-cache.ts data/evaluations/descending-layouts/37/cohort.json data/evaluations/descending-layouts/37 data/evaluations/descending-offline
node --import tsx apps/crawler/src/validate-descending-cache.ts --layouts
node --import tsx --test apps/crawler/tests/descending-kagawa.test.ts
```

The canonical reviewed input is apps/crawler/scripts/descending-cache/kagawa-reviewed.json. Full regression results must be recorded separately for each saved head. No municipality fetch is allowed while the original six manifests or provenance-verified complete cumulative holds ledger remain unavailable. No push, PR changes, merge or deployment is authorized.
