/** Batch-9 extractors (i3). Per-municipality logic lives in i3-*.ts. */
import type { Entry } from './i3-util';
import { entries as edu } from './i3-edu';
import { entries as city } from './i3-city';

export const entries: Record<string, Entry> = { ...edu, ...city };
