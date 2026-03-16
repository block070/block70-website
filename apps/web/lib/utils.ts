export function formatPercent(value: number, digits: number = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatScoreAsPercent(score: number, digits: number = 0): string {
  return `${(score * 100).toFixed(digits)}%`;
}

