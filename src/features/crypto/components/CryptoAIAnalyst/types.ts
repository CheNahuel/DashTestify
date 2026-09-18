export type CryptoChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
  isStreaming?: boolean;
};

export type AIAnalystResponse = {
  content: string;
  sources: string[];
};

export type CoinCapEndpoint =
  | '/assets'
  | '/assets/{id}'
  | '/assets/{id}/history'
  | '/markets'
  | '/rates'
  | '/exchanges';

export type ContextData = {
  assets?: Record<string, unknown>;
  history?: Record<string, unknown>;
  markets?: Record<string, unknown>;
  rates?: Record<string, unknown>;
  exchanges?: Record<string, unknown>;
};
