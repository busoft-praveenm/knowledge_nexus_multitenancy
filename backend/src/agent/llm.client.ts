import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * Client for any LOCAL, OpenAI-compatible chat endpoint — free to run:
 *   - llama.cpp   `llama-server -m model.gguf --jinja`   -> http://127.0.0.1:8080/v1
 *   - Ollama      `ollama serve`                         -> http://127.0.0.1:11434/v1
 *   - LM Studio   local server                           -> http://127.0.0.1:1234/v1
 * No API key, no cloud, no cost.
 */
@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);

  constructor(private readonly config: ConfigService) {}

  get model() {
    return this.config.get<string>('LLM_MODEL') ?? 'local-model';
  }

  private get baseUrl() {
    return (this.config.get<string>('LLM_BASE_URL') ?? 'http://127.0.0.1:8080/v1').replace(/\/$/, '');
  }

  async health(): Promise<{ up: boolean; model: string; baseUrl: string; served?: string[] }> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return { up: false, model: this.model, baseUrl: this.baseUrl };
      const body = (await res.json()) as { data?: { id: string }[] };
      return { up: true, model: this.model, baseUrl: this.baseUrl, served: (body.data ?? []).map((m) => m.id) };
    } catch {
      return { up: false, model: this.model, baseUrl: this.baseUrl };
    }
  }

  async chat(messages: ChatMessage[], tools: unknown[]): Promise<ChatMessage> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages, tools, temperature: 0, stream: false }),
        signal: AbortSignal.timeout(Number(this.config.get('LLM_TIMEOUT_MS') ?? 120000)),
      });
    } catch (err) {
      this.logger.warn(`LLM unreachable: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        `Local LLM is not reachable at ${this.baseUrl}. Start it (see README → "Local LLM"), or switch the agent to Scripted mode.`,
      );
    }
    if (!res.ok) throw new ServiceUnavailableException(`Local LLM returned ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { choices: { message: ChatMessage }[] };
    const msg = body.choices?.[0]?.message;
    return { role: 'assistant', content: msg?.content ?? '', tool_calls: msg?.tool_calls };
  }
}
