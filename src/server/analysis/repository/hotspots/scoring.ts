import type { HotspotSeverity, HotspotSignals } from "../../../../types/repository";

export const hotspotWeights: HotspotSignals = {
  churn: 0.22,
  recentActivity: 0.14,
  incomingCentrality: 0.18,
  outgoingCoupling: 0.12,
  size: 0.1,
  markerDensity: 0.1,
  cycleMembership: 0.08,
  contributorSpread: 0.04,
  testAwareness: 0.02,
};

export function scoreSignals(signals: HotspotSignals, weights: HotspotSignals = hotspotWeights): number {
  const weightedScore =
    signals.churn * weights.churn +
    signals.recentActivity * weights.recentActivity +
    signals.incomingCentrality * weights.incomingCentrality +
    signals.outgoingCoupling * weights.outgoingCoupling +
    signals.size * weights.size +
    signals.markerDensity * weights.markerDensity +
    signals.cycleMembership * weights.cycleMembership +
    signals.contributorSpread * weights.contributorSpread +
    signals.testAwareness * weights.testAwareness;

  const weightTotal =
    weights.churn +
    weights.recentActivity +
    weights.incomingCentrality +
    weights.outgoingCoupling +
    weights.size +
    weights.markerDensity +
    weights.cycleMembership +
    weights.contributorSpread +
    weights.testAwareness;

  return Math.round((weightedScore / weightTotal) * 100);
}

export function severityForScore(score: number): HotspotSeverity {
  if (score >= 70) {
    return "high";
  }

  if (score >= 45) {
    return "elevated";
  }

  return "notable";
}

export function severityForSignal(signal: number): HotspotSeverity | undefined {
  if (signal >= 0.8) {
    return "high";
  }

  if (signal >= 0.65) {
    return "elevated";
  }

  if (signal >= 0.5) {
    return "notable";
  }

  return undefined;
}
