/** Batch-9 extractors (i0). Per-municipality logic lives in i0-*.ts. */
import type { Entry } from '../batch8/h3-util';
import { entries as sheets } from './i0-sheets';
import { entries as shinagawa } from './i0-shinagawa';
import { entries as iwate } from './i0-iwate';
import { entries as kanto } from './i0-kanto';
import { entries as misc } from './i0-misc';

export const entries: Record<string, Entry> = { ...sheets, ...shinagawa, ...iwate, ...kanto, ...misc };
