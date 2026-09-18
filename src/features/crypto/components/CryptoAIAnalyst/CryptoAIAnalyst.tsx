/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { AiProviderName } from '../../../../../scripts/ai/types';
import type { CryptoChatMessage } from './types';

const PROVIDER_OPTIONS: Array<{
  value: AiProviderName;
  label: string;
}> = [
  { value: 'claude', label: 'Claude' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'groq', label: 'Groq' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openrouter', label: 'OpenRouter' },
];

const DEFAULT_SUGGESTED_QUESTIONS = [
  'Compare Bitcoin and Ethereum over the last 6 months.',
  'How has Bitcoin performed this year?',
  'What are today\'s biggest gainers?',
  'Which assets have the highest market cap?',
  'Explain Solana\'s recent trend.',
  'Which coins have the highest volatility?',
  'Summarize today\'s crypto market.',
  'Show me assets that lost more than 15%.',
  'Compare XRP vs BTC.',
  'Explain Bitcoin\'s historical trend.',
];

function generateRelatedQuestions(query: string): string[] {
  // Generate follow-up questions based on the original query
  const lowerQuery = query.toLowerCase();
  const relatedQuestions: string[] = [];

  if (lowerQuery.includes('gain') || lowerQuery.includes('top') || lowerQuery.includes('best')) {
    relatedQuestions.push(
      'What are today\'s biggest losers?',
      'Which coins have the lowest volatility?',
      'Show me assets with the highest volume.'
    );
  } else if (lowerQuery.includes('lose') || lowerQuery.includes('worst') || lowerQuery.includes('bottom')) {
    relatedQuestions.push(
      'What are today\'s biggest gainers?',
      'Which coins are most stable?',
      'Show me assets with unusual volume.'
    );
  } else if (lowerQuery.includes('bitcoin') || lowerQuery.includes('btc')) {
    relatedQuestions.push(
      'How has Bitcoin performed this year?',
      'Compare Bitcoin vs Ethereum.',
      'What\'s Bitcoin\'s all-time high?'
    );
  } else if (lowerQuery.includes('ethereum') || lowerQuery.includes('eth')) {
    relatedQuestions.push(
      'How has Ethereum performed this year?',
      'Compare Ethereum vs Bitcoin.',
      'What\'s Ethereum\'s current price?'
    );
  } else if (lowerQuery.includes('compare') || lowerQuery.includes('vs')) {
    relatedQuestions.push(
      'What are the key differences?',
      'Which one has higher volatility?',
      'Compare their market caps.'
    );
  }

  // If we generated some related questions, use them; otherwise use defaults
  return relatedQuestions.length > 0 ? relatedQuestions.slice(0, 4) : DEFAULT_SUGGESTED_QUESTIONS.slice(0, 4);
}

export function CryptoAIAnalyst() {
  const [messages, setMessages] = useState<CryptoChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AiProviderName>('claude');
  const [suggestedQuestions, setSuggestedQuestions] = useState(DEFAULT_SUGGESTED_QUESTIONS.slice(0, 4));
  const [lastUserQuery, setLastUserQuery] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        role: 'user',
        content: input,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      const userQuery = input;
      setLastUserQuery(userQuery);
      setInput('');
      setIsLoading(true);
      setError(null);

      try {
        // Reuse the same API pattern as ai-failure-analysis
        const response = await fetch('/api/crypto-ai-analyst', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: userQuery,
            provider,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `HTTP ${response.status}`
          );
        }

        const data = await response.json();

        const assistantMessage: CryptoChatMessage = {
          id: `msg-${Date.now()}-response`,
          role: 'assistant',
          content: data.answer || 'No response received',
          timestamp: new Date(),
          sources: data.sources || [],
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // On success, show related questions based on the user's query
        setSuggestedQuestions(generateRelatedQuestions(userQuery));
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to get response';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [input, provider]
  );

  return (
    <div className="flex flex-col rounded-3xl border border-white/10 bg-slate-900/70 overflow-hidden h-[600px] sm:h-[700px]">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-950/50 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm uppercase tracking-wider text-cyan-300">
              🤖 AI Analyst
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white sm:text-xl">
              Crypto AI Analyst
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Ask questions about the cryptocurrency market using live CoinCap data.
            </p>
          </div>
        </div>

        {/* Provider selector */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <label className="text-xs uppercase tracking-wider text-slate-400">
            AI Provider
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as AiProviderName)}
            className="mt-2 sm:mt-0 w-full sm:w-auto rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
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
                message.role === 'user'
                  ? 'justify-end'
                  : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs sm:max-w-md lg:max-w-lg rounded-lg p-4 text-sm sm:text-base ${
                  message.role === 'user'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-100'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-invert max-w-none prose-sm">
                    <ReactMarkdown
                      components={{
                        h1: ({ ...props }: any) => <h1 className="text-lg font-bold mt-3 mb-2" {...props} />,
                        h2: ({ ...props }: any) => <h2 className="text-base font-bold mt-2 mb-1" {...props} />,
                        h3: ({ ...props }: any) => <h3 className="text-sm font-semibold mt-2 mb-1" {...props} />,
                        p: ({ ...props }: any) => <p className="mb-2" {...props} />,
                        ul: ({ ...props }: any) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                        ol: ({ ...props }: any) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                        li: ({ ...props }: any) => <li className="ml-0" {...props} />,
                        table: ({ ...props }: any) => (
                          <table className="w-full border-collapse mb-2 text-xs border border-slate-600" {...props} />
                        ),
                        th: ({ ...props }: any) => (
                          <th className="border border-slate-600 px-2 py-1 bg-slate-700 font-semibold text-left" {...props} />
                        ),
                        td: ({ ...props }: any) => (
                          <td className="border border-slate-600 px-2 py-1" {...props} />
                        ),
                        code: ({ inline, ...props }: any) =>
                          inline ? (
                            <code className="bg-slate-700 rounded px-1.5 py-0.5 font-mono text-xs" {...props} />
                          ) : (
                            <code className="block bg-slate-700 rounded p-2 font-mono text-xs overflow-x-auto mb-2" {...props} />
                          ),
                        a: ({ ...props }: any) => <a className="text-cyan-300 hover:underline" {...props} />,
                        strong: ({ ...props }: any) => <strong className="font-bold text-cyan-200" {...props} />,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p>{message.content}</p>
                )}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 border-t border-white/20 pt-2">
                    <p className="text-xs font-semibold text-slate-300">
                      Data Sources:
                    </p>
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
                <div className="h-2 w-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="h-2 w-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="border-t border-rose-500/50 bg-rose-500/15 p-4 sm:p-5">
          <div className="flex gap-3">
            <div className="text-rose-400 flex-shrink-0">⚠️</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-rose-200 mb-1">Error</p>
              <p className="text-xs sm:text-sm text-rose-100 leading-relaxed">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  // Reset to default suggested questions on error dismiss
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
        <div className="border-t border-white/10 bg-slate-950/30 p-4 sm:p-5">
          <p className="mb-3 text-xs uppercase tracking-wider text-slate-400">
            {lastUserQuery ? 'Related Questions' : 'Suggested Questions'}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {suggestedQuestions.map((question, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestedQuestion(question)}
                className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-left text-xs sm:text-sm text-cyan-200 transition hover:bg-cyan-500/20 hover:border-cyan-500/50"
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
        className="border-t border-white/10 bg-slate-950/50 p-4 sm:p-5"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about crypto market..."
            disabled={isLoading}
            className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-4 py-2 text-sm placeholder-slate-500 text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
