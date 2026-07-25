import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import StrategyLeaderboard from "./StrategyLeaderboard";
import { getFreshnessStatus, sortStrategiesForView } from "../../hooks/useLeaderboardFilters";

// Mock the API module
vi.mock("../../lib/api", () => ({
  apiUrl: (path: string) => `http://localhost:3000${path}`,
}));

// Mock ConfidenceBadge component
vi.mock("../../components/AIAdvisor/ConfidenceBadge", () => ({
  ConfidenceBadge: ({ confidence }: { confidence: any }) => (
    <div data-testid="confidence-badge">Confidence: {JSON.stringify(confidence)}</div>
  ),
}));

describe("StrategyLeaderboard", () => {
  const mockStrategyData = {
    items: [
      {
        rank: 1,
        id: "blend-usdc-xlm",
        name: "Blend USDC/XLM",
        strategyType: "blend",
        apy: 12.5,
        tvlUsd: 1000000,
        riskScore: 8.5,
        riskAdjustedYield: 1.471,
        drawdownProxy: 0.05,
      },
      {
        rank: 2,
        id: "soroswap-usdc-xlm",
        name: "Soroswap USDC/XLM",
        strategyType: "soroswap",
        apy: 10.2,
        tvlUsd: 750000,
        riskScore: 7.2,
        riskAdjustedYield: 1.417,
        drawdownProxy: 0.08,
      },
      {
        rank: 3,
        id: "defindex-stable",
        name: "DeFindex Stable",
        strategyType: "defindex",
        apy: 8.5,
        tvlUsd: 500000,
        riskScore: 9.0,
        riskAdjustedYield: 0.944,
        drawdownProxy: 0.02,
      },
    ],
    filters: { timeWindow: "all", strategyType: "all" },
    total: 3,
    scoringMethodology: "RAY = APY / (1 + risk_penalty)",
  };

  const mockRotationData = {
    current: { id: "blend-usdc-xlm", score: 1.471, lastRotatedAt: "2024-01-15T10:00:00Z" },
    decisions: [
      {
        action: "rotate",
        reason: "Better risk-adjusted yield",
        fromId: "soroswap-usdc-xlm",
        toId: "blend-usdc-xlm",
        scoreDelta: 0.054,
        detail: "Rotated to higher RAY strategy",
        evaluatedAt: "2024-01-15T10:00:00Z",
        confidenceBreakdown: { score: 0.85, factors: ["apy", "risk"] },
        confidenceStrength: "strongly_favored" as const,
        confidenceWhy: ["Higher APY", "Lower risk", "Better liquidity"],
      },
    ],
  };

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Loading State", () => {
    it("shows loading spinner while fetching strategy data", () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          }),
      );

      render(<StrategyLeaderboard />);

      expect(screen.getByText(/loading strategy rankings\.\.\./i)).toBeInTheDocument();
    });

    it("displays loading message with spinner", () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          }),
      );

      render(<StrategyLeaderboard />);

      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
      expect(screen.getByText(/loading strategy rankings\.\.\./i)).toBeInTheDocument();
    });

    it("shows header and filters during loading", () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          }),
      );

      render(<StrategyLeaderboard />);

      expect(screen.getByText("RISK-ADJUSTED YIELD LEADERBOARD")).toBeInTheDocument();
      expect(screen.getByText("Time")).toBeInTheDocument();
      expect(screen.getByText("Type")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows empty state when no strategies exist", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [], filters: {}, total: 0, scoringMethodology: "" }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText(/no strategies found/i)).toBeInTheDocument();
      });
    });

    it("displays empty state message with filter suggestion", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [], filters: {}, total: 0, scoringMethodology: "" }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(
          screen.getByText(/try adjusting your time window or strategy type/i),
        ).toBeInTheDocument();
      });
    });

    it("shows BarChart3 icon in empty state", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [], filters: {}, total: 0, scoringMethodology: "" }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText(/no strategies found/i)).toBeInTheDocument();
      });

      const emptyState = screen.getByText(/no strategies found/i).closest("div");
      expect(emptyState).toBeInTheDocument();
    });

    it("maintains filters in empty state", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [], filters: {}, total: 0, scoringMethodology: "" }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText(/no strategies found/i)).toBeInTheDocument();
      });

      expect(screen.getByText("Time")).toBeInTheDocument();
      expect(screen.getByText("Type")).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("shows error state when fetch fails", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load strategies/i)).toBeInTheDocument();
      });
    });

    it("displays error message", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.reject(new Error("Connection timeout"));
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText(/connection timeout/i)).toBeInTheDocument();
      });
    });

    it("shows retry button in error state", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
      });
    });

    it("retries fetch when retry button is clicked", async () => {
      let callCount = 0;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error("Network error"));
          }
          return Promise.resolve({
            ok: true,
            json: async () => mockStrategyData,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load strategies/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", { name: /retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText("Blend USDC/XLM")).toBeInTheDocument();
      });
    });

    it("handles HTTP error responses", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.resolve({
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText(/HTTP 503/i)).toBeInTheDocument();
      });
    });

    it("shows AlertCircle icon in error state", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load strategies/i)).toBeInTheDocument();
      });

      const errorState = screen.getByText(/failed to load strategies/i).closest("div");
      expect(errorState).toBeInTheDocument();
    });
  });

  describe("Data Display", () => {
    it("renders strategy data when fetch succeeds", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockStrategyData,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText("Blend USDC/XLM")).toBeInTheDocument();
      });
    });

    it("displays all strategy rows", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockStrategyData,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText("Blend USDC/XLM")).toBeInTheDocument();
        expect(screen.getByText("Soroswap USDC/XLM")).toBeInTheDocument();
        expect(screen.getByText("DeFindex Stable")).toBeInTheDocument();
      });
    });

    it("shows APY values correctly", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockStrategyData,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText("12.50%")).toBeInTheDocument();
        expect(screen.getByText("10.20%")).toBeInTheDocument();
        expect(screen.getByText("8.50%")).toBeInTheDocument();
      });
    });

    it("displays risk scores with color coding", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockStrategyData,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText("8.5/10")).toBeInTheDocument();
        expect(screen.getByText("7.2/10")).toBeInTheDocument();
        expect(screen.getByText("9.0/10")).toBeInTheDocument();
      });
    });

    it("shows risk-adjusted yield values", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockStrategyData,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText("1.471")).toBeInTheDocument();
        expect(screen.getByText("1.417")).toBeInTheDocument();
        expect(screen.getByText("0.944")).toBeInTheDocument();
      });
    });

    it("displays TVL values", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockStrategyData,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText("$1,000,000")).toBeInTheDocument();
        expect(screen.getByText("$750,000")).toBeInTheDocument();
        expect(screen.getByText("$500,000")).toBeInTheDocument();
      });
    });

    it("maintains existing layout when data is present", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockStrategyData,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText("Rank")).toBeInTheDocument();
        expect(screen.getByText("Strategy")).toBeInTheDocument();
        expect(screen.getByText("Type")).toBeInTheDocument();
        expect(screen.getByText("APY")).toBeInTheDocument();
        expect(screen.getByText("Risk Score")).toBeInTheDocument();
        expect(screen.getByText("TVL")).toBeInTheDocument();
      });
    });
  });

  describe("Filter Functionality", () => {
    it("refetches data when time window filter changes", async () => {
      const fetchMock = vi.fn().mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockStrategyData,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      global.fetch = fetchMock;

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText("Blend USDC/XLM")).toBeInTheDocument();
      });

      const sevenDayButton = screen.getByRole("button", { name: "7d" });
      fireEvent.click(sevenDayButton);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("timeWindow=7d"),
        );
      });
    });

    it("refetches data when strategy type filter changes", async () => {
      const fetchMock = vi.fn().mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockStrategyData,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      global.fetch = fetchMock;

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText("Blend USDC/XLM")).toBeInTheDocument();
      });

      const blendButton = screen.getByRole("button", { name: "blend" });
      fireEvent.click(blendButton);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("strategyType=blend"),
        );
      });
    });
  });

  describe("API Integration", () => {
    it("calls correct API endpoints", async () => {
      const fetchMock = vi.fn().mockImplementation((url) => {
        if (url.includes("/api/strategies/leaderboard")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockStrategyData,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockRotationData,
        } as Response);
      });

      global.fetch = fetchMock;

      render(<StrategyLeaderboard />);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/api/strategies/leaderboard"),
        );
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/api/strategies/rotation"),
        );
      });
    });
  });

  describe("Freshness metadata", () => {
    const FRESH_TIMESTAMP = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
    const STALE_TIMESTAMP = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 3h ago

    describe("getFreshnessStatus (pure logic)", () => {
      it("treats a recent timestamp as fresh", () => {
        expect(getFreshnessStatus(FRESH_TIMESTAMP)).toBe("fresh");
      });

      it("treats a timestamp older than the stale threshold as stale", () => {
        expect(getFreshnessStatus(STALE_TIMESTAMP)).toBe("stale");
      });

      it("treats a missing timestamp as missing", () => {
        expect(getFreshnessStatus(null)).toBe("missing");
        expect(getFreshnessStatus(undefined)).toBe("missing");
      });

      it("treats an unparsable timestamp as missing", () => {
        expect(getFreshnessStatus("not-a-date")).toBe("missing");
      });
    });

    describe("sortStrategiesForView (pure logic)", () => {
      const fresh = {
        id: "fresh-strategy",
        apy: 5,
        riskScore: 5,
        riskAdjustedYield: 5,
        lastUpdatedAt: FRESH_TIMESTAMP,
      };
      const stale = {
        id: "stale-strategy",
        apy: 50,
        riskScore: 9,
        riskAdjustedYield: 50,
        lastUpdatedAt: STALE_TIMESTAMP,
      };
      const missing = {
        id: "missing-strategy",
        apy: 100,
        riskScore: 10,
        riskAdjustedYield: 100,
        lastUpdatedAt: null,
      };

      it("never ranks stale data above fresh data in the APY view, even with a higher APY", () => {
        const sorted = sortStrategiesForView([stale, fresh], "apy");
        expect(sorted.map((s) => s.id)).toEqual(["fresh-strategy", "stale-strategy"]);
      });

      it("never ranks stale data above fresh data in the risk view, even with a higher risk score", () => {
        const sorted = sortStrategiesForView([stale, fresh], "risk");
        expect(sorted.map((s) => s.id)).toEqual(["fresh-strategy", "stale-strategy"]);
      });

      it("ranks missing data below stale data regardless of metric", () => {
        const sorted = sortStrategiesForView([missing, stale], "apy");
        expect(sorted.map((s) => s.id)).toEqual(["stale-strategy", "missing-strategy"]);
      });

      it("orders rows within the same freshness tier by the selected metric, descending", () => {
        const freshLow = { ...fresh, id: "fresh-low", apy: 1 };
        const freshHigh = { ...fresh, id: "fresh-high", apy: 9 };
        const sorted = sortStrategiesForView([freshLow, freshHigh], "apy");
        expect(sorted.map((s) => s.id)).toEqual(["fresh-high", "fresh-low"]);
      });
    });

    describe("Rendering freshness badges", () => {
      const freshnessMockData = {
        items: [
          {
            rank: 1,
            id: "fresh-strategy",
            name: "Fresh Strategy",
            strategyType: "blend",
            apy: 6,
            tvlUsd: 100000,
            riskScore: 6,
            riskAdjustedYield: 0.6,
            drawdownProxy: 0.01,
            lastUpdatedAt: FRESH_TIMESTAMP,
          },
          {
            rank: 2,
            id: "stale-strategy",
            name: "Stale Strategy",
            strategyType: "soroswap",
            apy: 20,
            tvlUsd: 200000,
            riskScore: 8,
            riskAdjustedYield: 2.0,
            drawdownProxy: 0.03,
            lastUpdatedAt: STALE_TIMESTAMP,
          },
          {
            rank: 3,
            id: "missing-strategy",
            name: "Missing Freshness Strategy",
            strategyType: "defindex",
            apy: 30,
            tvlUsd: 50000,
            riskScore: 9,
            riskAdjustedYield: 3.0,
            drawdownProxy: 0.02,
            lastUpdatedAt: null,
          },
        ],
        filters: { timeWindow: "all", strategyType: "all" },
        total: 3,
        scoringMethodology: "RAY = APY / (1 + risk_penalty)",
      };

      function mockFetchWith(leaderboardData: unknown) {
        (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
          if (url.includes("/api/strategies/leaderboard")) {
            return Promise.resolve({
              ok: true,
              json: async () => leaderboardData,
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            json: async () => mockRotationData,
          } as Response);
        });
      }

      it("shows a Live badge for fresh strategy data", async () => {
        mockFetchWith(freshnessMockData);
        render(<StrategyLeaderboard />);

        await waitFor(() => {
          expect(screen.getByText("Fresh Strategy")).toBeInTheDocument();
        });

        expect(screen.getByText("Live")).toBeInTheDocument();
      });

      it("shows a Stale badge with a tooltip for stale strategy data", async () => {
        mockFetchWith(freshnessMockData);
        render(<StrategyLeaderboard />);

        await waitFor(() => {
          expect(screen.getByText("Stale Strategy")).toBeInTheDocument();
        });

        const staleBadge = screen.getByText("Stale");
        expect(staleBadge).toBeInTheDocument();
        const tooltipHost = staleBadge.closest("span[title]");
        expect(tooltipHost).not.toBeNull();
        expect(tooltipHost?.getAttribute("title")).toMatch(/may not reflect current market conditions/i);
      });

      it("shows a No Data badge with a tooltip for strategies with missing freshness data", async () => {
        mockFetchWith(freshnessMockData);
        render(<StrategyLeaderboard />);

        await waitFor(() => {
          expect(screen.getByText("Missing Freshness Strategy")).toBeInTheDocument();
        });

        const missingBadge = screen.getByText("No Data");
        expect(missingBadge).toBeInTheDocument();
        const tooltipHost = missingBadge.closest("span[title]");
        expect(tooltipHost).not.toBeNull();
        expect(tooltipHost?.getAttribute("title")).toMatch(/no freshness data available/i);
      });
    });

    describe("Stale-row sorting rules", () => {
      const rotationSortMockData = {
        items: [
          {
            rank: 1,
            id: "stale-high-apy",
            name: "Stale High APY",
            strategyType: "soroswap",
            apy: 90,
            tvlUsd: 100000,
            riskScore: 9,
            riskAdjustedYield: 9,
            drawdownProxy: 0.02,
            lastUpdatedAt: STALE_TIMESTAMP,
          },
          {
            rank: 2,
            id: "fresh-low-apy",
            name: "Fresh Low APY",
            strategyType: "blend",
            apy: 5,
            tvlUsd: 100000,
            riskScore: 5,
            riskAdjustedYield: 0.5,
            drawdownProxy: 0.01,
            lastUpdatedAt: FRESH_TIMESTAMP,
          },
        ],
        filters: { timeWindow: "all", strategyType: "all" },
        total: 2,
        scoringMethodology: "RAY = APY / (1 + risk_penalty)",
      };

      function mockFetchWith(leaderboardData: unknown) {
        (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url) => {
          if (url.includes("/api/strategies/leaderboard")) {
            return Promise.resolve({
              ok: true,
              json: async () => leaderboardData,
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            json: async () => mockRotationData,
          } as Response);
        });
      }

      function rowOrder(container: HTMLElement): string[] {
        return Array.from(container.querySelectorAll("tbody tr")).map(
          (row) => row.textContent ?? "",
        );
      }

      it("keeps the fresh strategy above the stale strategy in the APY view despite its lower APY", async () => {
        mockFetchWith(rotationSortMockData);
        const { container } = render(<StrategyLeaderboard />);

        await waitFor(() => {
          expect(screen.getByText("Stale High APY")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: "APY" }));

        await waitFor(() => {
          const order = rowOrder(container);
          const freshIndex = order.findIndex((text) => text.includes("Fresh Low APY"));
          const staleIndex = order.findIndex((text) => text.includes("Stale High APY"));
          expect(freshIndex).toBeGreaterThanOrEqual(0);
          expect(staleIndex).toBeGreaterThanOrEqual(0);
          expect(freshIndex).toBeLessThan(staleIndex);
        });
      });

      it("keeps the fresh strategy above the stale strategy in the Risk view despite its lower risk score", async () => {
        mockFetchWith(rotationSortMockData);
        const { container } = render(<StrategyLeaderboard />);

        await waitFor(() => {
          expect(screen.getByText("Stale High APY")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: "Risk" }));

        await waitFor(() => {
          const order = rowOrder(container);
          const freshIndex = order.findIndex((text) => text.includes("Fresh Low APY"));
          const staleIndex = order.findIndex((text) => text.includes("Stale High APY"));
          expect(freshIndex).toBeGreaterThanOrEqual(0);
          expect(staleIndex).toBeGreaterThanOrEqual(0);
          expect(freshIndex).toBeLessThan(staleIndex);
        });
      });

      it("assigns #1 rank display to the top row after re-sorting by a new view", async () => {
        mockFetchWith(rotationSortMockData);
        render(<StrategyLeaderboard />);

        await waitFor(() => {
          expect(screen.getByText("Stale High APY")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: "APY" }));

        await waitFor(() => {
          const freshRow = screen.getByText("Fresh Low APY").closest("tr");
          expect(freshRow?.textContent).toMatch(/#1/);
        });
      });
    });
  });
});
