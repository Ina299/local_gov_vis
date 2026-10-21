import { batch7Extractors, BATCH7_SINCE } from './batch7/registry';
import { batch8Extractors, BATCH8_SINCE } from './batch8/registry';
import { batch9Extractors, BATCH9_SINCE } from './batch9/registry';

/** Extractor sets added after the frozen batches, each effective only for runs generated at or after `since`. */
export const laterExtractors = [
  { since: BATCH7_SINCE, extractors: batch7Extractors },
  { since: BATCH8_SINCE, extractors: batch8Extractors },
  { since: BATCH9_SINCE, extractors: batch9Extractors },
];
