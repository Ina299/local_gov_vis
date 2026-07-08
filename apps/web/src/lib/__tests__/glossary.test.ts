import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GLOSSARY } from '../glossary';
import type { LocalGovBudget } from '@/types/budget';

// vitestはapps/webをcwdとして実行される
const publicDir = join(process.cwd(), 'public');

function collectNames(budgets: LocalGovBudget[], names: Set<string>) {
  for (const b of budgets) {
    for (const e of b.expenditures) {
      names.add(e.name);
      for (const c of e.children ?? []) names.add(c.name);
    }
    for (const r of b.revenues) names.add(r.name);
  }
}

describe('GLOSSARY', () => {
  it('実データに現れる全ての款・項・歳入項目に解説がある', () => {
    const names = new Set<string>();
    collectNames(JSON.parse(readFileSync(join(publicDir, 'budgets.json'), 'utf8')), names);
    const muniDir = join(publicDir, 'budgets', 'municipal');
    for (const f of readdirSync(muniDir).filter((f) => /^\d{2}\.json$/.test(f))) {
      collectNames(JSON.parse(readFileSync(join(muniDir, f), 'utf8')), names);
    }
    expect(names.size).toBeGreaterThan(50);
    const missing = Array.from(names).filter((n) => !GLOSSARY[n]);
    expect(missing).toEqual([]);
  });

  it('収支図が生成する財源区分ノードに解説がある', () => {
    for (const name of ['一般財源', '特定財源等', '収支差引（歳入超過）', '収支差引（歳出超過）', 'その他']) {
      expect(GLOSSARY[name], name).toBeTruthy();
    }
  });
});
