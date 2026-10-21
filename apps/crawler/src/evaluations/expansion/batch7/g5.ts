import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as sayama } from './g5-sayama';
import { entries as sumida } from './g5-sumida';
import { entries as nihonmatsu } from './g5-nihonmatsu';
import { entries as musashimurayama } from './g5-musashimurayama';
import { entries as oi } from './g5-oi';
import { entries as mobara } from './g5-mobara';
import { entries as yotsukaido } from './g5-yotsukaido';
import { entries as small } from './g5-small';

/**
 * Batch 7 group g5. Not included: 11201 川越市 (new sheets repeat existing records; lists truncated),
 * 08309 大洗町 (plan-level 施策 evaluation), 01462 南富良野町 (電源立地交付金 reports without explicit years),
 * 42203 島原市 (result lists served as .ashx, not passed to extractors), 01213 苫小牧市・27321 豊能町 (index pages only).
 */
export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...sayama, ...sumida, ...nihonmatsu, ...musashimurayama, ...oi, ...mobara, ...yotsukaido, ...small,
};
