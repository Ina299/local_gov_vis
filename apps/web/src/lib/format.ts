/** 金額（円）を兆/億/万円表記に変換 */
export function formatAmount(amount: number): string {
  if (amount >= 1_000_000_000_000) {
    return `${(amount / 1_000_000_000_000).toFixed(2)}兆円`;
  }
  if (amount >= 100_000_000) {
    const oku = amount / 100_000_000;
    return `${oku >= 100 ? Math.round(oku).toLocaleString() : oku.toFixed(1)}億円`;
  }
  if (amount >= 10_000) {
    return `${Math.round(amount / 10_000).toLocaleString()}万円`;
  }
  return `${amount.toLocaleString()}円`;
}

/** 1人あたり額（円/人）の表記。1万円以上は小数1桁の万円 */
export function formatPerPerson(value: number): string {
  return value >= 10_000
    ? `${(value / 10_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}万円`
    : `${Math.round(value).toLocaleString()}円`;
}
