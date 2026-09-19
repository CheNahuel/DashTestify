"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SectionNav({ showQANavigation = true }: { showQANavigation?: boolean }) {
  const pathname = usePathname();

  const isHome = pathname === "/";
  const isQualityAnalytics = pathname.startsWith("/quality-analytics");
  const isAiFailure = pathname.startsWith("/ai-failure-analysis");

  const navLinkClass = (isActive: boolean, accentColor: string) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-all ${
      isActive
        ? `${accentColor} bg-white/10 backdrop-blur`
        : "text-white/70 hover:text-white hover:bg-white/5"
    }`;

  return (
    <nav className="border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-start gap-2 sm:gap-4">
          <div className="flex items-center gap-2 font-semibold text-white">
            <span className="text-lg">DashTestify</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Crypto Dashboard */}
            <Link
              href="/"
              className={navLinkClass(isHome, "text-cyan-300")}
            >
              Crypto Dashboard
            </Link>

            {/* Quality Analytics - hidden in production */}
            {showQANavigation && (
              <>
                <Link
                  href="/quality-analytics"
                  className={navLinkClass(isQualityAnalytics, "text-purple-300")}
                >
                  Quality Analytics
                </Link>

                {/* AI Failure Analysis - hidden in production */}
                <Link
                  href="/ai-failure-analysis"
                  className={navLinkClass(isAiFailure, "text-purple-300")}
                >
                  AI Failure Analysis
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
