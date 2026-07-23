import { describe, expect, it } from 'vitest';
import { calculateCorrelation, correlationLabel } from '../correlation';

describe('calculateCorrelation', () => {
  it('完全な正の相関を算出する', () => {
    const result = calculateCorrelation([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ]);
    expect(result.coefficient).toBeCloseTo(1);
    expect(result.slope).toBeCloseTo(2);
    expect(result.intercept).toBeCloseTo(0);
  });

  it('完全な負の相関を算出する', () => {
    const result = calculateCorrelation([
      { x: 1, y: 3 },
      { x: 2, y: 2 },
      { x: 3, y: 1 },
    ]);
    expect(result.coefficient).toBeCloseTo(-1);
  });

  it('点不足・分散ゼロでは算出しない', () => {
    expect(calculateCorrelation([{ x: 1, y: 2 }]).coefficient).toBeNull();
    expect(
      calculateCorrelation([
        { x: 1, y: 2 },
        { x: 1, y: 3 },
      ]).coefficient
    ).toBeNull();
  });
});

describe('correlationLabel', () => {
  it('相関の向きと強さを表示する', () => {
    expect(correlationLabel(0.8)).toBe('強い正の相関');
    expect(correlationLabel(-0.5)).toBe('中程度の負の相関');
    expect(correlationLabel(0.1)).toBe('ほぼ相関なし');
  });
});
