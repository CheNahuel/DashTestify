import { NextResponse } from "next/server";

import { fetchAndCacheFeeds, type FeedItem } from "@/lib/feed-aggregator";

export const runtime = "nodejs";

export async function GET() {
  try {
    const items = await fetchAndCacheFeeds();

    // If no items from feeds, return empty response
    if (items.length === 0) {
      return NextResponse.json(
        { insights: [], error: "No feed items available" },
        { status: 200 }
      );
    }

    // Shuffle items so each request gets different order
    const shuffled = [...items].sort(() => Math.random() - 0.5);

    return NextResponse.json(
      { insights: shuffled },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch insights:", error);
    return NextResponse.json(
      { insights: [], error: "Failed to fetch insights" },
      { status: 500 }
    );
  }
}
