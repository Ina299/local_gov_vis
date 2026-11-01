# Ehime offline named-source review

Isolated descending-code cohort: 19 municipalities, excluding Niihama (38205) and preserving all 53 recent-master exclusions. User unpublished edits are not observable. No production datasets or shared indexes are edited.

92 source entries: 76 hash-verified cached bodies and 16 missing bodies; one listed continuation reconstructed and verified. Current candidate count: 609 in nine municipalities; 638 duplicate outputs suppressed. These are local candidates, not published records. The Shikokuchuo named-source families and older annual coverage have been reviewed. Remaining alternative titles, parent/child identity collisions, source bodies and unassignable columns are documented evidence holds. This is not a claim of complete municipal or national collection. Missing bodies remain held with no network request.

Exact quotes, UTF-16 offsets, fiscal-year evidence and source/text hashes are retained. No amounts, indicators or ratings are inferred from shared columns. Uwajima's 53 title blocks are recorded in uwajima-title-coverage.json. Yawatahama chapter comparison retains ordered text differences, not a claim of identical byte content. Initial-page truncation is rejected unless every listed continuation verifies.

Reproduce from repository root:

```
python apps/crawler/scripts/descending-cache/build-ehime-map.py
node --import tsx apps/crawler/src/review-descending-cache.ts data/evaluations/descending-layouts/38/cohort.json data/evaluations/descending-layouts/38 data/evaluations/descending-offline
node --import tsx apps/crawler/src/validate-descending-cache.ts --layouts
node --import tsx --test apps/crawler/tests/descending-ehime.test.ts
```

The canonical reviewed input is apps/crawler/scripts/descending-cache/ehime-reviewed.json. Full regression results for the final609 candidate version must be recorded separately; the preceding489 checkpoint has passed full regression. Focused tests alone are not full validation. Acquisition remains held pending the six original manifests or provenance-verifiable cumulative holds ledger. No push, PR changes, merge, deploy, municipal access or production field changes are authorized in this phase.

The older-reviewed-disposition.json ledger retains exact candidate title fragments, existing counterpart names, and acceptance/hold reasons. Repetition in that scan is not a count of distinct business records. Additional120 candidate records and0 field enrichments relative to66fed168.
