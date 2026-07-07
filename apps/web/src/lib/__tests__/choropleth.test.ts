import { describe, it, expect } from 'vitest';
import {
  computeBreaks,
  classColor,
  getClassColor,
  computeSignedBreaks,
  getDivergingColor,
  SEQUENTIAL_BLUES,
  DIVERGING_NEG,
  DIVERGING_POS,
  NO_DATA_COLOR,
} from '../choropleth';

describe('computeBreaks', () => {
  it('通常の分布では4つの境界（5階級）を返す', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    const breaks = computeBreaks(values);
    expect(breaks).toHaveLength(4);
    // 昇順
    expect([...breaks].sort((a, b) => a - b)).toEqual(breaks);
  });

  it('空配列では境界なし', () => {
    expect(computeBreaks([])).toEqual([]);
  });

  it('ゼロが大半を占める分布では重複境界を間引く（外国人出生割合の縮退ケース）', () => {
    const values = [...Array(80).fill(0), 0.01, 0.02, 0.03, 0.05];
    const breaks = computeBreaks(values);
    // 0が最小値なので境界に0は残らない
    expect(breaks.every((b) => b > 0)).toBe(true);
    // 重複なし
    expect(new Set(breaks).size).toBe(breaks.length);
  });

  it('全値が同一なら境界なし（1階級）', () => {
    expect(computeBreaks([5, 5, 5, 5])).toEqual([]);
  });
});

describe('classColor', () => {
  it('5階級ではランプをそのまま使う', () => {
    for (let i = 0; i < 5; i++) {
      expect(classColor(SEQUENTIAL_BLUES, i, 5)).toBe(SEQUENTIAL_BLUES[i]);
    }
  });

  it('3階級では明暗の両端と中央を使う', () => {
    expect(classColor(SEQUENTIAL_BLUES, 0, 3)).toBe(SEQUENTIAL_BLUES[0]);
    expect(classColor(SEQUENTIAL_BLUES, 1, 3)).toBe(SEQUENTIAL_BLUES[2]);
    expect(classColor(SEQUENTIAL_BLUES, 2, 3)).toBe(SEQUENTIAL_BLUES[4]);
  });

  it('1階級ではランプ中央', () => {
    expect(classColor(SEQUENTIAL_BLUES, 0, 1)).toBe(SEQUENTIAL_BLUES[2]);
  });
});

describe('getClassColor', () => {
  const breaks = [10, 20, 30, 40];

  it('null はデータなし色', () => {
    expect(getClassColor(null, breaks, false, SEQUENTIAL_BLUES)).toBe(NO_DATA_COLOR);
  });

  it('値が大きいほど濃い', () => {
    expect(getClassColor(5, breaks, false, SEQUENTIAL_BLUES)).toBe(SEQUENTIAL_BLUES[0]);
    expect(getClassColor(25, breaks, false, SEQUENTIAL_BLUES)).toBe(SEQUENTIAL_BLUES[2]);
    expect(getClassColor(100, breaks, false, SEQUENTIAL_BLUES)).toBe(SEQUENTIAL_BLUES[4]);
  });

  it('invert指定で濃淡が反転する（財政力指数）', () => {
    expect(getClassColor(5, breaks, true, SEQUENTIAL_BLUES)).toBe(SEQUENTIAL_BLUES[4]);
    expect(getClassColor(100, breaks, true, SEQUENTIAL_BLUES)).toBe(SEQUENTIAL_BLUES[0]);
  });

  it('境界値ちょうどは上の階級に入る', () => {
    expect(getClassColor(10, breaks, false, SEQUENTIAL_BLUES)).toBe(SEQUENTIAL_BLUES[1]);
  });
});

describe('computeSignedBreaks / getDivergingColor', () => {
  it('正負それぞれの内部で境界を計算する', () => {
    const values = [-300, -200, -100, -50, -10, 20, 40, 60];
    const { neg, pos } = computeSignedBreaks(values);
    expect(neg.length).toBeGreaterThan(0);
    expect(pos.length).toBeGreaterThan(0);
    expect(neg.every((b) => b < 0)).toBe(true);
    expect(pos.every((b) => b > 0)).toBe(true);
  });

  it('マイナスは赤・プラスは青、絶対値が大きいほど濃い', () => {
    const breaks = computeSignedBreaks([-300, -200, -100, -50, -10, 20, 40, 60]);
    expect(getDivergingColor(-1000, breaks)).toBe(DIVERGING_NEG[0]); // 最も濃い赤
    expect(getDivergingColor(-1, breaks)).toBe(DIVERGING_NEG[DIVERGING_NEG.length - 1]);
    expect(getDivergingColor(1, breaks)).toBe(DIVERGING_POS[0]); // 最も薄い青
    expect(getDivergingColor(1000, breaks)).toBe(DIVERGING_POS[DIVERGING_POS.length - 1]);
  });

  it('null はデータなし色', () => {
    expect(getDivergingColor(null, computeSignedBreaks([1, -1]))).toBe(NO_DATA_COLOR);
  });

  it('片側しか値がなくても壊れない（全国市区町村がほぼ全て減少のケース）', () => {
    const breaks = computeSignedBreaks([-30, -20, -10]);
    expect(breaks.pos).toEqual([]);
    expect(getDivergingColor(5, breaks)).toBe(DIVERGING_POS[1]); // 1階級→中央色
    expect(getDivergingColor(-25, breaks)).toBe(DIVERGING_NEG[0]);
  });
});
