import { NextResponse } from 'next/server';
import type { AiProviderName } from '../../../../scripts/ai/types';

type ProviderStatus = {
  name: AiProviderName;
  label: string;
  configured: boolean;
};

const PROVIDER_CONFIG: Array<{
  name: AiProviderName;
  label: string;
  envKey: string;
}> = [
  { name: 'claude', label: 'Claude', envKey: 'CLAUDE_API_KEY' },
  { name: 'openai', label: 'OpenAI', envKey: 'OPENAI_API_KEY' },
  { name: 'gemini', label: 'Gemini', envKey: 'GEMINI_API_KEY' },
  { name: 'groq', label: 'Groq', envKey: 'GROQ_API_KEY' },
  { name: 'deepseek', label: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY' },
  { name: 'openrouter', label: 'OpenRouter', envKey: 'OPENROUTER_API_KEY' },
];

export async function GET() {
  const providers: ProviderStatus[] = PROVIDER_CONFIG.map((config) => ({
    name: config.name,
    label: config.label,
    configured: !!process.env[config.envKey],
  }));

  return NextResponse.json({ providers });
}
