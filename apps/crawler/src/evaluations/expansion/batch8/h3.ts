/** Batch-8 extractors (h3). Per-municipality logic lives in h3-*.ts. */
import type { Entry } from './h3-util';
import { entries as nankoku } from './h3-nankoku';
import { entries as hokkaido } from './h3-hokkaido';
import { entries as misc } from './h3-misc';
import { entries as small } from './h3-small';

export const entries: Record<string, Entry> = { ...nankoku, ...hokkaido, ...misc, ...small };
