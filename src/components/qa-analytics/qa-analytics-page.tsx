import { LiveQaAnalyticsPage } from "@/components/qa-analytics/live-qa-analytics-page";
import { LocalQaAnalyticsPage } from "@/components/qa-analytics/local-qa-analytics-page";

type QaAnalyticsMode = "local" | "live";

type QaAnalyticsPageProps = {
  mode: QaAnalyticsMode;
  currentBranch: string;
};

export function QaAnalyticsPage({ mode, currentBranch }: QaAnalyticsPageProps) {
  return mode === "live" ? <LiveQaAnalyticsPage /> : <LocalQaAnalyticsPage currentBranch={currentBranch} />;
}
