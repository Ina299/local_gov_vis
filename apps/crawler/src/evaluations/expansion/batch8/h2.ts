/** Batch-8 group h2: project-level evaluation extractors for documents acquired in collection round 2. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as edu } from './h2-edu';
import { entries as misc } from './h2-misc';
import { entries as nishinomiya } from './h2-nishinomiya';
import { entries as plan } from './h2-plan';
import { entries as sheets } from './h2-sheets';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...nishinomiya,
  ...sheets,
  ...edu,
  ...plan,
  ...misc,
};
