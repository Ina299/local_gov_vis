import { entries as fujieda } from './m4-fujieda';
import { entries as gifu } from './m4-gifu';
import { entries as ishioka } from './m4-ishioka';
import { entries as nagomi } from './m4-nagomi';
import { entries as smallA } from './m4-small-a';
import { entries as smallB } from './m4-small-b';

export const entries = { ...fujieda, ...gifu, ...ishioka, ...nagomi, ...smallA, ...smallB };
