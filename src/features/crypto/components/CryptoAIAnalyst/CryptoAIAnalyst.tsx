/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { AiProviderName } from "../../../../../scripts/ai/types";
import type { CryptoChatMessage } from "./types";

type ProviderStatus = {
  name: AiProviderName;
  label: string;
  configured: boolean;
};

const DEFAULT_PROVIDER_OPTIONS: Array<{
  value: AiProviderName;
  label: string;
}> = [
  { value: "claude", label: "Claude" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "groq", label: "Groq" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "openrouter", label: "OpenRouter" },
];

const DEFAULT_SUGGESTED_QUESTIONS = [
  "Compare Bitcoin and Ethereum over the last 6 months.",
  "How has Bitcoin performed this year?",
  "What are today's biggest gainers?",
  "Which assets have the highest market cap?",
  "Explain Solana's recent trend.",
  "Which coins have the highest volatility?",
  "Summarize today's crypto market.",
  "Show me assets that lost more than 15%.",
  "Which assets have the highest trading volume?",
  "What are the strongest and weakest performers this week?",
];

function buildSuggestedQuestions(excludedQuestion: string): string[] {
  return Array.from(
    new Set(DEFAULT_SUGGESTED_QUESTIONS.filter((question) => question !== excludedQuestion)),
  ).slice(0, 4);
}

export function CryptoAIAnalyst() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<CryptoChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AiProviderName | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState(
    DEFAULT_SUGGESTED_QUESTIONS.slice(0, 4),
  );
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeProviderStatus = providerStatuses.find((status) => status.name === provider);
  const providerStatusLabel =
    providerStatuses.length === 0
      ? "Connecting"
      : activeProviderStatus?.configured
        ? "Ready"
        : "Unavailable";
  const providerIsReady = activeProviderStatus?.configured ?? false;

  // Fetch provider configuration status
  useEffect(() => {
    const fetchProviderStatus = async () => {
      try {
        const response = await fetch("/api/ai-providers-status");

        if (response.ok) {
          const data = await response.json();
          const providers = data.providers || [];

          setProviderStatuses(providers);

          // Select the first configured provider by default
          const firstConfigured = providers.find((status: ProviderStatus) => status.configured);

          if (firstConfigured) {
            setProvider(firstConfigured.name);
          }
        }
      } catch (err) {
        console.error("Failed to fetch provider status:", err);
      }
    };

    void fetchProviderStatus();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSuggestedQuestion = useCallback((question: string) => {
    setInput(question);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!input.trim()) {
        return;
      }

      // Add user message
      const userMessage: CryptoChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: input,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      const userQuery = input;
      setInput("");
      setIsLoading(true);
      setError(null);

      try {
        // Reuse the same API pattern as ai-failure-analysis
        const response = await fetch("/api/crypto-ai-analyst", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: userQuery,
            provider,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        const assistantMessage: CryptoChatMessage = {
          id: `msg-${Date.now()}-response`,
          role: "assistant",
          content: data.answer || "No response received",
          timestamp: new Date(),
          sources: data.sources || [],
        };

        setMessages((prev) => [...prev, assistantMessage]);

        setSuggestedQuestions(buildSuggestedQuestions(userQuery));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to get response";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [input, provider],
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      <div
        data-testid="crypto-ai-panel"
        role="dialog"
        aria-labelledby="crypto-ai-title"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`flex ${messages.length === 0 ? "h-auto" : "h-[calc(100dvh-8rem)]"} max-h-[680px] min-h-0 w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-900/95 shadow-2xl shadow-cyan-950/50 backdrop-blur-md transition-all duration-300 sm:w-[450px] ${
          isOpen
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-3 scale-95 opacity-0"
        }`}
      >
        {/* Header */}
        <div className="border-b border-white/10 bg-slate-950/80 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 id="crypto-ai-title" className="text-lg font-semibold text-white">
                Crypto AI Analyst
              </h3>
            </div>
            <button
              type="button"
              aria-label="Close Crypto AI Analyst"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xl leading-none text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>

          {/* Provider selector */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <select
              aria-label="AI Provider"
              value={provider ?? ""}
              onChange={(e) => setProvider(e.target.value as AiProviderName)}
              className="w-[190px] max-w-full rounded-md border border-cyan-500/30 bg-slate-800/90 px-2.5 py-1.5 text-sm font-medium text-slate-200 transition hover:border-cyan-400/60 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
              {providerStatuses.length > 0
                ? [...providerStatuses]
                    .sort((a, b) => Number(b.configured) - Number(a.configured))
                    .map((status) => (
                      <option key={status.name} value={status.name} disabled={!status.configured}>
                        {status.label}
                        {!status.configured && " — Not configured"}
                      </option>
                    ))
                : DEFAULT_PROVIDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
            </select>
            <div aria-live="polite" className="flex items-center gap-1.5 text-sm text-slate-400">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${providerIsReady ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-amber-400"}`}
              />
              <span>{providerStatusLabel}</span>
            </div>
          </div>
        </div>

        {/* Chat history */}
        <div
          className={`min-h-0 space-y-3 overflow-y-auto p-3 ${messages.length === 0 ? "flex-none" : "flex-1"}`}
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center py-5">
              <div className="text-center">
                <p className="text-sm text-slate-400">
                  No messages yet. Ask a question to get started!
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs sm:max-w-md lg:max-w-lg rounded-lg p-3 text-sm ${
                    message.role === "user"
                      ? "bg-cyan-600 text-white"
                      : "bg-slate-800 text-slate-100"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-invert max-w-none prose-sm">
                      <ReactMarkdown
                        components={{
                          h1: ({ ...props }: any) => (
                            <h1 className="text-lg font-bold mt-3 mb-2" {...props} />
                          ),
                          h2: ({ ...props }: any) => (
                            <h2 className="text-base font-bold mt-2 mb-1" {...props} />
                          ),
                          h3: ({ ...props }: any) => (
                            <h3 className="text-sm font-semibold mt-2 mb-1" {...props} />
                          ),
                          p: ({ ...props }: any) => <p className="mb-1.5" {...props} />,
                          ul: ({ ...props }: any) => (
                            <ul className="list-disc list-inside mb-1.5 space-y-0.5" {...props} />
                          ),
                          ol: ({ ...props }: any) => (
                            <ol
                              className="list-decimal list-inside mb-1.5 space-y-0.5"
                              {...props}
                            />
                          ),
                          li: ({ ...props }: any) => <li className="ml-0" {...props} />,
                          table: ({ ...props }: any) => (
                            <table
                              className="w-full border-collapse mb-2 text-xs border border-slate-600"
                              {...props}
                            />
                          ),
                          th: ({ ...props }: any) => (
                            <th
                              className="border border-slate-600 px-2 py-1 bg-slate-700 font-semibold text-left"
                              {...props}
                            />
                          ),
                          td: ({ ...props }: any) => (
                            <td className="border border-slate-600 px-2 py-1" {...props} />
                          ),
                          code: ({ inline, ...props }: any) =>
                            inline ? (
                              <code
                                className="bg-slate-700 rounded px-1.5 py-0.5 font-mono text-xs"
                                {...props}
                              />
                            ) : (
                              <code
                                className="block bg-slate-700 rounded p-2 font-mono text-xs overflow-x-auto mb-1.5"
                                {...props}
                              />
                            ),
                          a: ({ ...props }: any) => (
                            <a className="text-cyan-300 hover:underline" {...props} />
                          ),
                          strong: ({ ...props }: any) => (
                            <strong className="font-bold text-cyan-200" {...props} />
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p>{message.content}</p>
                  )}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 border-t border-white/20 pt-2">
                      <p className="text-xs font-semibold text-slate-300">Data Sources:</p>
                      <ul className="mt-1 text-xs space-y-0.5">
                        {message.sources.map((source) => (
                          <li key={source} className="text-slate-400">
                            ✓ {source}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3">
              <div className="max-w-xs sm:max-w-md lg:max-w-lg rounded-lg bg-slate-800 p-3">
                <div className="flex gap-2">
                  <div className="h-2 w-2 rounded-full bg-slate-500 animate-bounce" />
                  <div
                    className="h-2 w-2 rounded-full bg-slate-500 animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <div
                    className="h-2 w-2 rounded-full bg-slate-500 animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error message */}
        {error && (
          <div className="border-t border-rose-500/50 bg-rose-500/15 p-4">
            <div className="flex gap-3">
              <div className="text-rose-400 flex-shrink-0">⚠️</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-rose-200 mb-1">Error</p>
                <p className="text-xs sm:text-sm text-rose-100 leading-relaxed">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    setSuggestedQuestions(DEFAULT_SUGGESTED_QUESTIONS.slice(0, 4));
                  }}
                  className="mt-2 text-xs text-rose-300 hover:text-rose-200 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Suggested questions - show when no error and not loading */}
        {!error && !isLoading && (
          <div className="border-t border-white/10 bg-slate-950/30 px-3 py-2">
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-500">
              Suggested Questions
            </p>
            <div className="grid grid-cols-2 gap-1">
              {suggestedQuestions.map((question, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSuggestedQuestion(question)}
                  className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5 text-left text-xs leading-snug text-cyan-200 transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input form */}
        <form
          onSubmit={handleSubmit}
          className="shrink-0 border-t border-white/10 bg-slate-950/70 p-3"
        >
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-800/80 p-1 transition focus-within:border-cyan-400/60 focus-within:ring-1 focus-within:ring-cyan-400/30">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about crypto market..."
              disabled={isLoading}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{isLoading ? "..." : "Send"}</span>
            </button>
          </div>
        </form>
      </div>

      <button
        type="button"
        data-testid="crypto-ai-launcher"
        aria-label={isOpen ? "Close Crypto AI Analyst" : "Open Crypto AI Analyst"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan-200/60 bg-cyan-500 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.35)] transition duration-200 hover:scale-105 hover:bg-cyan-300 hover:shadow-[0_0_32px_rgba(34,211,238,0.55)] focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-7 w-7 fill-none stroke-current"
          strokeWidth="1.8"
        >
          <path d="m12 3 1.2 4.8L18 9l-4.8 1.2L12 15l-1.2-4.8L6 9l4.8-1.2L12 3Z" />
          <path d="m19 14 .6 2.4L22 17l-2.4.6L19 20l-.6-2.4L16 17l2.4-.6L19 14Z" />
          <path d="m5 15 .5 2L7.5 17 5.5 17.5 5 20l-.5-2.5-2-.5 2-.5L5 15Z" />
        </svg>
      </button>
    </div>
  );
}
