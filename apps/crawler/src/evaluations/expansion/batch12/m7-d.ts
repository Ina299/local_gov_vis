import type { Entry } from '../batch9/i1-util';
import { akirunoEntries } from './m7-d-akiruno';
import { grantEntries } from './m7-d-grants';

export const entries: Record<string, Entry> = {
  ...akirunoEntries,
  ...grantEntries,
};
