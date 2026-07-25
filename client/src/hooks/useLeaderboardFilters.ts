import { useCallback, useEffect, useState } from "react";

export const TIME_WINDOWS = ["all", "24h", "7d", "30d"] as const;
export const STRATEGY_TYPES = ["all", "blend", "soroswap", "defindex"] as const;
export const SORT_VIEWS = ["ray", "apy", "risk"] as const;

export type TimeWindow = (typeof TIME_WINDOWS)[number];
export type StrategyType = (typeof STRATEGY_TYPES)[number];
export type SortView = (typeof SORT_VIEWS)[number];

export interface LeaderboardFilters {
  timeWindow: TimeWindow;
  strategyType: StrategyType;
  sortView: SortView;
}

const STORAGE_KEY = "stellar_yield.leaderboard_filters";
const DEFAULTS: LeaderboardFilters = {
  timeWindow: "all",
  strategyType: "all",
  sortView: "ray",
};

function isValidTimeWindow(v: unknown): v is TimeWindow {
  return TIME_WINDOWS.includes(v as TimeWindow);
}

function isValidStrategyType(v: unknown): v is StrategyType {
  return STRATEGY_TYPES.includes(v as StrategyType);
}

function isValidSortView(v: unknown): v is SortView {
  return SORT_VIEWS.includes(v as SortView);
}

function loadFilters(): LeaderboardFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return DEFAULTS;
    const { timeWindow, strategyType, sortView } = parsed as Record<string, unknown>;
    return {
      timeWindow: isValidTimeWindow(timeWindow) ? timeWindow : DEFAULTS.timeWindow,
      strategyType: isValidStrategyType(strategyType) ? strategyType : DEFAULTS.strategyType,
      sortView: isValidSortView(sortView) ? sortView : DEFAULTS.sortView,
    };
  } catch {
    return DEFAULTS;
  }
}

function saveFilters(filters: LeaderboardFilters): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Storage may be unavailable (private browsing quota exceeded, etc.)
  }
}

export interface UseLeaderboardFiltersReturn {
  timeWindow: TimeWindow;
  strategyType: StrategyType;
  sortView: SortView;
  setTimeWindow: (v: TimeWindow) => void;
  setStrategyType: (v: StrategyType) => void;
  setSortView: (v: SortView) => void;
  resetFilters: () => void;
  isDefault: boolean;
}

export function useLeaderboardFilters(): UseLeaderboardFiltersReturn {
  const [filters, setFilters] = useState<LeaderboardFilters>(loadFilters);

  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  const setTimeWindow = useCallback((v: TimeWindow) => {
    setFilters((prev) => ({ ...prev, timeWindow: v }));
  }, []);

  const setStrategyType = useCallback((v: StrategyType) => {
    setFilters((prev) => ({ ...prev, strategyType: v }));
  }, []);

  const setSortView = useCallback((v: SortView) => {
    setFilters((prev) => ({ ...prev, sortView: v }));
  }, []);

  const resetFilters = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setFilters(DEFAULTS);
  }, []);

  const isDefault =
    filters.timeWindow === DEFAULTS.timeWindow &&
    filters.strategyType === DEFAULTS.strategyType &&
    filters.sortView === DEFAULTS.sortView;

  return {
    timeWindow: filters.timeWindow,
    strategyType: filters.strategyType,
    sortView: filters.sortView,
    setTimeWindow,
    setStrategyType,
    setSortView,
    resetFilters,
    isDefault,
  };
}

// --- Strategy data freshness -------------------------------------------------
//
// Leaderboard rows carry a `lastUpdatedAt` timestamp reported by the pricing
// pipeline. Rows without a recent timestamp must never outrank verified-fresh
// rows, regardless of how favorable their APY/risk numbers look — otherwise a
// strategy whose feed silently stopped updating could sit at the top of the
// board with a stale (and possibly no-longer-accurate) high score.

export type FreshnessStatus = "fresh" | "stale" | "missing";

/** Data older than this is considered stale rather than live. */
export const FRESHNESS_STALE_AFTER_MS = 60 * 60 * 1000; // 1 hour

/** Determine a row's freshness from its last-updated timestamp. */
export function getFreshnessStatus(
  lastUpdatedAt: string | null | undefined,
  now: number = Date.now(),
): FreshnessStatus {
  if (!lastUpdatedAt) return "missing";
  const updatedAtMs = new Date(lastUpdatedAt).getTime();
  if (Number.isNaN(updatedAtMs)) return "missing";
  const ageMs = now - updatedAtMs;
  if (ageMs <= FRESHNESS_STALE_AFTER_MS) return "fresh";
  return "stale";
}

// Lower rank sorts first: fresh data always beats stale/missing data.
const FRESHNESS_SORT_RANK: Record<FreshnessStatus, number> = {
  fresh: 0,
  stale: 1,
  missing: 2,
};

export interface FreshnessAwareStrategy {
  lastUpdatedAt?: string | null;
  apy: number;
  riskScore: number;
  riskAdjustedYield: number;
}

function metricForView<T extends FreshnessAwareStrategy>(item: T, view: SortView): number {
  switch (view) {
    case "apy":
      return item.apy;
    case "risk":
      return item.riskScore;
    case "ray":
    default:
      return item.riskAdjustedYield;
  }
}

/**
 * Sorts strategies for the given view (RAY, APY, or risk) so that fresh rows
 * always rank above stale rows, and stale rows always rank above rows with
 * missing freshness data — regardless of their metric value. Within each
 * freshness tier, rows are ordered by the selected metric, descending.
 */
export function sortStrategiesForView<T extends FreshnessAwareStrategy>(
  items: readonly T[],
  view: SortView,
  now: number = Date.now(),
): T[] {
  return [...items].sort((a, b) => {
    const freshnessDelta =
      FRESHNESS_SORT_RANK[getFreshnessStatus(a.lastUpdatedAt, now)] -
      FRESHNESS_SORT_RANK[getFreshnessStatus(b.lastUpdatedAt, now)];
    if (freshnessDelta !== 0) return freshnessDelta;
    return metricForView(b, view) - metricForView(a, view);
  });
}
