import type { AiProviderName } from "../../../scripts/ai/types";

export interface CryptoAnalysisRequest {
  query: string;
  context: Record<string, unknown>;
  endpoints: string[];
  dataSource?: "Supabase" | "CoinCap";
}

export interface CryptoAnalysisResponse {
  answer: string;
  sources: string[];
  provider: AiProviderName;
}

function buildCryptoSystemPrompt(
  context: Record<string, unknown>,
  dataSource: string = "market data",
): string {
  return `You are a senior cryptocurrency analyst with deep expertise in blockchain markets.

Your role is to answer questions about cryptocurrency using ONLY the provided ${dataSource}.

CRITICAL RULES:
1. Never invent prices, trends, or market information
2. Only use data from the provided context
3. If required information is unavailable, clearly state it
4. Be concise and data-driven
5. Use markdown formatting with:
   - Headings (# ##, ###)
   - Bold text (**text**)
   - Bullet lists and numbered lists
   - Tables when comparing multiple assets
   - Inline code for technical terms
   - Paragraphs for explanations

Available Data from ${dataSource}:
${JSON.stringify(context, null, 2)}

When answering, consider:
- Market trends and volatility
- Price comparisons and performance metrics
- Asset rankings by market cap or volume
- Historical price movements
- Exchange activity and markets

Provide your analysis using appropriate markdown structure and formatting.`;
}

type GenericApiResponse = Record<string, unknown>;

function extractResponseText(data: GenericApiResponse, providerName: AiProviderName): string {
  // Claude: data.content[0].text
  if (Array.isArray(data.content)) {
    const textBlock = (data.content as Array<{ type: string; text?: string }>).find(
      (block) => block.type === "text",
    );
    if (textBlock?.text) {
      return textBlock.text.trim();
    }
  }

  // OpenAI: data.choices[0].message.content
  if (Array.isArray(data.choices)) {
    const choice = (data.choices as Array<{ message?: { content?: string } }>)[0];
    if (choice?.message?.content) {
      return choice.message.content.trim();
    }
  }

  // Gemini: data.candidates[0].content.parts[0].text
  if (Array.isArray(data.candidates)) {
    const candidate = (
      data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }>
    )[0];
    if (candidate?.content?.parts?.[0]?.text) {
      return candidate.content.parts[0].text.trim();
    }
  }

  return "";
}

async function queryClaudeProvider(query: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("CLAUDE_API_KEY or ANTHROPIC_API_KEY is required");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: query }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GenericApiResponse;
  if (data.error) {
    throw new Error(`Claude error: ${(data.error as Record<string, unknown>).message}`);
  }

  const text = extractResponseText(data, "claude");
  if (!text) throw new Error("Claude returned empty response");
  return text;
}

async function queryOpenAiProvider(query: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: query }],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GenericApiResponse;
  if (data.error) {
    throw new Error(`OpenAI error: ${(data.error as Record<string, unknown>).message}`);
  }

  const text = extractResponseText(data, "openai");
  if (!text) throw new Error("OpenAI returned empty response");
  return text;
}

async function queryGeminiProvider(query: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required");
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nUser query: ${query}` }],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GenericApiResponse;

  // Gemini returns candidates with content.parts[0].text
  if (Array.isArray(data.candidates)) {
    const candidate = (
      data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }>
    )[0];
    if (candidate?.content?.parts?.[0]?.text) {
      return candidate.content.parts[0].text.trim();
    }
  }

  throw new Error("Gemini returned empty response");
}

async function queryGroqProvider(query: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = (await response.json()) as GenericApiResponse;
  const text = extractResponseText(data, "groq");
  if (!text) throw new Error("Groq returned empty response");
  return text;
}

async function queryDeepSeekProvider(query: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is required");
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash:free",
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = (await response.json()) as GenericApiResponse;
  const text = extractResponseText(data, "deepseek");
  if (!text) throw new Error("DeepSeek returned empty response");
  return text;
}

async function queryOpenRouterProvider(query: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://dashtestify.local",
      "X-Title": "DashTestify",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "openrouter/free",
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `OpenRouter API error: ${response.status} ${response.statusText} - ${errorBody}`,
    );
  }

  const data = (await response.json()) as GenericApiResponse;
  const text = extractResponseText(data, "openrouter");
  if (!text) throw new Error("OpenRouter returned empty response");
  return text;
}

export async function analyzeCryptoQuery(
  request: CryptoAnalysisRequest,
  providerName: AiProviderName,
): Promise<CryptoAnalysisResponse> {
  const dataSource = request.dataSource || "market data";
  const systemPrompt = buildCryptoSystemPrompt(request.context, dataSource);

  let answer: string;

  try {
    switch (providerName) {
      case "claude":
        answer = await queryClaudeProvider(request.query, systemPrompt);
        break;
      case "openai":
        answer = await queryOpenAiProvider(request.query, systemPrompt);
        break;
      case "gemini":
        answer = await queryGeminiProvider(request.query, systemPrompt);
        break;
      case "groq":
        answer = await queryGroqProvider(request.query, systemPrompt);
        break;
      case "deepseek":
        answer = await queryDeepSeekProvider(request.query, systemPrompt);
        break;
      case "openrouter":
        answer = await queryOpenRouterProvider(request.query, systemPrompt);
        break;
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("API_KEY")) {
      throw new Error(
        `The selected provider (${providerName}) is not configured. ` +
          `Please set the required API key: ${providerName.toUpperCase()}_API_KEY`,
      );
    }

    // Provide helpful error context for common issues
    if (message.includes("404")) {
      throw new Error(
        `${providerName} API not found (404). Check the model name in ${providerName.toUpperCase()}_MODEL env var.`,
      );
    }

    if (message.includes("429")) {
      throw new Error(
        `${providerName} rate limited (429). Too many requests. Please wait and try again.`,
      );
    }

    if (message.includes("402")) {
      throw new Error(
        `${providerName} payment required (402). Check your API key and account balance/quota.`,
      );
    }

    if (message.includes("400")) {
      throw new Error(
        `${providerName} bad request (400). Check the API key and request format. Error: ${message}`,
      );
    }

    throw error;
  }

  return {
    answer: answer.trim() || "Unable to generate analysis",
    sources: request.endpoints,
    provider: providerName,
  };
}
