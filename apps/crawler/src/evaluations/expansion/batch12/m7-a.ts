import type { Entry } from '../batch9/i1-util';
import { minokamoEntries } from './m7-a-minokamo';
import { nishinomiyaEntries } from './m7-a-nishinomiya';

export const entries: Record<string, Entry> = {
  ...minokamoEntries,
  ...nishinomiyaEntries,
};
