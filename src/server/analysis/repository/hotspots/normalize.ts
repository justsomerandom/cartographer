export interface RankedMetricInput {
  path: string;
  value: number;
}

export interface RankedMetric {
  path: string;
  value: number;
  rank: number;
  percentile: number;
}

export function rankMetricPercentiles(inputs: RankedMetricInput[]): Map<string, RankedMetric> {
  const positiveInputs = inputs.filter((input) => input.value > 0);
  const ranked = new Map<string, RankedMetric>();

  for (const input of inputs) {
    ranked.set(input.path, {
      path: input.path,
      value: input.value,
      rank: 0,
      percentile: 0,
    });
  }

  if (positiveInputs.length === 0) {
    return ranked;
  }

  const sortedDescending = [...positiveInputs].sort((a, b) => b.value - a.value || a.path.localeCompare(b.path));
  const sortedValues = [...positiveInputs].map((input) => input.value).sort((a, b) => a - b);
  const percentileByValue = new Map<number, number>();

  for (const value of sortedValues) {
    if (percentileByValue.has(value)) {
      continue;
    }

    const valuesAtOrBelow = sortedValues.filter((candidate) => candidate <= value).length;
    percentileByValue.set(value, roundSignal(valuesAtOrBelow / sortedValues.length));
  }

  for (const [index, input] of sortedDescending.entries()) {
    ranked.set(input.path, {
      path: input.path,
      value: input.value,
      rank: index + 1,
      percentile: percentileByValue.get(input.value) ?? 0,
    });
  }

  return ranked;
}

export function roundSignal(value: number): number {
  return Math.round(value * 1000) / 1000;
}
