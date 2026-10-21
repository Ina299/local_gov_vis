import { batch7Extractors, BATCH7_SINCE } from './batch7/registry';
import { batch8Extractors, BATCH8_SINCE } from './batch8/registry';
import { batch9Extractors, BATCH9_SINCE } from './batch9/registry';
import { batch11Extractors, BATCH11_SINCE } from './batch11/registry';

/** Extractor sets added after the frozen batches, each effective only for runs generated at or after `since`. */
export const laterExtractors = [
  { since: BATCH7_SINCE, extractors: batch7Extractors },
  { since: BATCH8_SINCE, extractors: batch8Extractors },
  { since: BATCH9_SINCE, extractors: batch9Extractors },
  // Batch 10 reused the earlier extractors on whole texts (FULLTEXT_SINCE); it has no registry of its own.
  { since: BATCH11_SINCE, extractors: batch11Extractors },
];
