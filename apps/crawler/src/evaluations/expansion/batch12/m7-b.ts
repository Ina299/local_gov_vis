import type { Entry } from '../batch9/i1-util';
import { takiEntries } from './m7-b-taki';
import { ujiEntries } from './m7-b-uji';

export const entries: Record<string, Entry> = {
  ...ujiEntries,
  ...takiEntries,
};
