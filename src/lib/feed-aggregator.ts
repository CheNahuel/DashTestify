export type FeedItem = {
  id: string;
  title: string;
  summary: string;
  category: string;
  link: string | null;
  source: string;
  publishedAt: string;
  type: "tip" | "news";
};

type CachedFeed = {
  items: FeedItem[];
  fetchedAt: number;
};

const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour
const feedCache = new Map<string, CachedFeed>();

const FEED_SOURCES = [
  {
    url: "https://dev.to/api/articles?tag=ai&per_page=10",
    source: "Dev.to (AI)",
    categoryMap: { "prompt": "Prompt Engineering", "debugging": "Debugging", "test": "Testing" },
    isJson: true,
  },
  {
    url: "https://dev.to/api/articles?tag=testing&per_page=10",
    source: "Dev.to (Testing)",
    categoryMap: { "ai": "AI Providers", "test": "Testing", "playwright": "Testing" },
    isJson: true,
  },
  {
    url: "https://news.ycombinator.com/rss",
    source: "Hacker News",
    categoryMap: { "ai": "AI Model Updates", "llm": "AI Providers", "gpt": "AI Providers" },
    isJson: false,
  },
];

async function fetchFeed(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "DashTestify/1.0 (RSS Feed Aggregator)",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch feed from ${url}:`, error);
    return "";
  }
}

function extractText(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function parseRssXml(xml: string, sourceInfo: (typeof FEED_SOURCES)[0]): FeedItem[] {
  try {
    const items: FeedItem[] = [];

    // Match all <item> or <entry> tags
    const itemRegex = /<(item|entry)[^>]*>([\s\S]*?)<\/\1>/gi;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(xml)) !== null) {
      const itemContent = itemMatch[2];

      const title = extractText(itemContent, "title");
      const summary =
        extractText(itemContent, "summary") ||
        extractText(itemContent, "description");
      const link =
        extractText(itemContent, "link") ||
        (itemContent.match(/<link[^>]*href="([^"]+)"/i) || [])[1] ||
        "";
      const publishedAt =
        extractText(itemContent, "pubDate") ||
        extractText(itemContent, "published") ||
        new Date().toISOString();

      if (!title || !summary) {
        continue;
      }

      // Determine category based on content
      let category = "AI Updates";
      for (const [keyword, cat] of Object.entries(sourceInfo.categoryMap)) {
        if (title.toLowerCase().includes(keyword.toLowerCase())) {
          category = cat;
          break;
        }
      }

      // Clean up summary (remove HTML tags and entities)
      const cleanSummary = summary
        .replace(/<[^>]*>/g, "")
        .replace(/&[a-z]+;/g, "")
        .replace(/&#\d+;/g, "")
        .substring(0, 200)
        .trim();

      if (!cleanSummary) {
        continue;
      }

      items.push({
        id: `${sourceInfo.source}-${title.substring(0, 30)}-${Math.random()}`,
        title: title.substring(0, 100),
        summary: cleanSummary,
        category,
        link: link || null,
        source: sourceInfo.source,
        publishedAt,
        type: "news",
      });
    }

    return items;
  } catch (error) {
    console.error("Failed to parse RSS XML:", error);
    return [];
  }
}

function parseDevToJson(json: string, source: (typeof FEED_SOURCES)[0]): FeedItem[] {
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data)) {
      return [];
    }

    const items: FeedItem[] = [];

    for (const article of data.slice(0, 5)) {
      const title = article.title || "";
      const summary = article.description || article.excerpt || "";
      const link = article.url || null;
      const publishedAt = article.published_at || new Date().toISOString();

      if (!title || !summary) {
        continue;
      }

      // Determine category based on content
      let category = "Testing";
      const fullText = `${title} ${summary}`.toLowerCase();
      for (const [keyword, cat] of Object.entries(source.categoryMap)) {
        if (fullText.includes(keyword.toLowerCase())) {
          category = cat;
          break;
        }
      }

      items.push({
        id: `${source.source}-${article.id}`,
        title: title.substring(0, 100),
        summary: summary.substring(0, 200),
        category,
        link,
        source: source.source,
        publishedAt,
        type: "news",
      });
    }

    return items;
  } catch (error) {
    console.error(`Failed to parse Dev.to JSON from ${source.source}:`, error);
    return [];
  }
}

export async function fetchAndCacheFeeds(): Promise<FeedItem[]> {
  const cacheKey = "all-feeds";
  const cached = feedCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < CACHE_DURATION_MS) {
    return cached.items;
  }

  const allItems: FeedItem[] = [];

  for (const source of FEED_SOURCES as any[]) {
    const content = await fetchFeed(source.url);
    if (content) {
      let items: FeedItem[] = [];
      if (source.isJson) {
        items = parseDevToJson(content, source);
      } else {
        items = parseRssXml(content, source);
      }
      allItems.push(...items.slice(0, 3)); // Limit items per source
    }
  }

  // Sort by published date (newest first)
  allItems.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  // Keep only the most recent items
  const recentItems = allItems.slice(0, 12);

  // Add fallback suggestions if no items fetched
  if (recentItems.length === 0) {
    recentItems.push(
      {
        id: "fallback-1",
        title: "Check back soon for AI testing insights",
        summary:
          "We're working on aggregating real-time tips. For now, run tests to see AI-assisted debugging features.",
        category: "Getting Started",
        link: null,
        source: "DashTestify",
        publishedAt: new Date().toISOString(),
        type: "tip",
      }
    );
  }

  feedCache.set(cacheKey, {
    items: recentItems,
    fetchedAt: Date.now(),
  });

  return recentItems;
}
