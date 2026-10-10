# Verified municipal evaluation fixtures

Fetched from the municipalities' official websites on **2026-10-10 UTC**. `provenance.json` records each original document URL, the official page linking to it, SHA-256 of the **original downloaded bytes**, and download timestamp. Hashes are not hashes of these compact/transcoded fixtures. Runtime hashes are always computed from actual fetched bytes by the importer.

- `sapporo-text-pages.json`: pdfjs-dist 5.4.296 text items (original string plus PDF x/y/width) and reading-order text from the one-page 組織活性化推進費 sheet, project 70154. Tests verify 2025 evaluation cycle versus 2024 assessed FY; actual 14,838 千円, budget 10,845 千円, engagement-score target 43.4 / result 47.2. Personnel **workload** 0.65 人工 is not a monetary personnel cost.
- `odawara-cells.json`: original cell values/types/display strings for R６評価 rows 1–9 and 27, retaining original coordinates. Row 27 genuinely has no project code. Includes the workbook's old 見方 example to verify it is excluded. Original XLSX has 582 projects, including eight rows without a CD; the complete-byte smoke test extracted 582 unique IDs. The compact fixture has eight project rows. First project actual cost G3 is 44,806 **thousand yen**, not 44,806 yen. G8 is genuinely zero.
- `misato-project.html`: original 広報事業 HTML transcoded from CP932/Shift_JIS to UTF-8; charset declaration changed accordingly, no content values changed. Actual cost is 21,574,621 **yen**. Published 2022 indicator result 52.21 is retained even though it disagrees with the stated attainment rate; the parser does not silently repair municipal data.
- `misato-shift-jis-fragment.base64`: CP932 metadata/header and two exact original identity rows, enclosed in a minimal test table. Checks the runtime decoder without a binary fixture or full duplicate source.
- `discovery-pages.json`: compact official anchor excerpts from the listed URLs. Includes prior-year anchors on the main indexes to test that only the newest **published** cycle is followed. Sapporo branch and Misato policy-tree excerpts deliberately include only the representative navigation paths. This is not a full-catalog count fixture.

Verified latest linked editions at download: Sapporo R7/2025 (assessing R6/2024), Odawara R7/2025 (assessing R6/2024), Misato R6/2024 official edition (explicit R6/2024 actuals). Misato's main page update date is not used as the evaluation year. The adapter selects edition years from official link labels, never from today's fiscal year or a guessed URL.

## Scope and failure behavior

Discovery stays on allowlisted official hosts and the newest linked cycle. Sapporo traverses at most 30 department pages; Misato at most 160 policy-index pages. Discovery returns all document anchors reached even when document download limits are lower. A limit or fetch failure is reported; no claim of complete municipal coverage is made.

Only the verified Sapporo text-PDF form geometry, current Odawara evaluation-table columns, and Misato HTML tables are supported. Unknown layouts or image-only PDFs are explicitly unsupported. No OCR, paid service, LLM extraction, browser crawler, or restored legacy PDF/VLM pipeline is involved.

Absent cost categories are omitted and remain unknown, never zero. An explicitly published cost cell with a missing/non-numeric value retains amountYen=null and its original text. Ratings remain municipal self-evaluation text and labels. No external rating is inferred, and no common score or invented scale is assigned. All raw monetary units and explicit fiscal years are retained.
