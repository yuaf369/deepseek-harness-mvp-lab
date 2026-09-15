import { Context, Service } from "cordis";
import { randomUUID } from "crypto";
import { isRecord, type AppConfig, type Message, type ToolSchema } from "../types";
import Stream from "stream";

declare module 'cordis' {
    interface Context {
        model: ModelService
    }
}

export class ModelService extends Service {
    private controller = new AbortController();

    constructor(ctx: Context, private config: AppConfig) {
        super(ctx, "model");
        ctx.effect(() => () => { this.controller.abort(); });
    }

    async complete(messages: Message[], tools: ToolSchema[]): Promise<Message> {
        return this.config.provider === 'mock' ? this.mock(messages, tools) : this.remote(messages, tools);
    }

    private mock(messages: Message[], tools: ToolSchema[]): Message {
        const last = messages.at(-1)!;
        if (last.role === "tool") {
            const result = JSON.parse(last.content!);
            return { role: 'assistant', content: result.ok ? `[mock]工具结果:${result.value}` : `[mock]工具错误:${result.error}` };
        }
        const prompt = last.content ?? '';
        const match = prompt.match(/^(?:请)?(?:计算)?\s*(-?\d+(?:\.\d+)?)\s*([+\-*/×÷])\s*(-?\d+(?:\.\d+)?)\s*[?？。=]?$/);
        let name: string | undefined;
        let args = {};
        if (match) {
            name = 'calculate';
            const operations: Record<string, string> = { "+": 'add', '-': 'subtract', '*': 'multiply', '×': 'multiply', '/': 'divide', '÷': "divide" };
            args = { a: Number(match[1]), b: Number(match[3]), operation: operations[match[2]] };
        } else if (/时间｜几点|time/i.test(prompt)) {
            name = 'current_time';
        }
        if (!name) return { role: 'assistant', content: '[mock]这是离线规则演示，仅支持两个数字的一次运算或时间查询。试试"计算12 * 8"或“现在几点”；复合算式和自由对话请启用deepseek模式。' };
        if (!tools.some((tool) => tool.function.name === name)) {
            return { role: 'assistant', content: `[mock] &{name} 工具未启用，请输入 /enable。` };
        }
        return {
            role: 'assistant', content: null,
            tool_calls: [{ id: randomUUID(), type: 'function', function: { name, arguments: JSON.stringify(args) } }],
        };
    }
    private async remote(messages: Message[], tools: ToolSchema[]): Promise<Message> {
        const { baseUrl, apiKey, model, timeoutMs } = this.config;
        let body: unknown;
        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST', signal: AbortSignal.any([AbortSignal.timeout(timeoutMs),
                this.controller.signal
                ]),
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model, messages, stream: false, thinking: { type: 'disabled' }, max_tokems: 2048, ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
                }),
            });
            if (!response.ok) {
                await response.body?.cancel();
                throw new Error(`DeepSeek API HTTP ${response.status}:  请检查密钥、余额、模型名或请求频率。`);
            }
            try { body = await response.json(); }
            catch (error) {
                if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) throw error;
                throw new Error('DeepSeek API 未返回有效JSON。')
            }
        } catch (error) {
            if (this.controller.signal.aborted) throw new Error('模型请求已取消。');
            if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
                throw new Error(`DeepSeek 请求超时（${timeoutMs} ms）。`);
            }
            if (error instanceof TypeError) throw new Error('无法连接 DeepSeek API， 请检查网络和DEEPSEEK_BASE_URL。');
            throw error;
        }
        if (!isRecord(body) || !Array.isArray(body.choices) || !isRecord(body.choices[0])) {
            throw new Error('DeepSeek响应格式错误：缺少choices。');
        }
        const choice = body.choices[0];
        if (choice.finish_reason === 'length') throw new Error('模型回答被截断，请缩短问题。');
        const message = choice.message;
        if (!isRecord(message) || message.role !== 'assistant'
            || !(message.content === null || typeof message.content === 'string')) {
            throw new Error('DeepSeek 响应格式错误：缺少assistant消息。');
        }
        const calls = message.tool_calls;
        if (calls !== undefined && (!Array.isArray(calls) || calls.length > 16 || calls.some((call) =>
            !isRecord(call) || typeof call.id !== 'string' || !call.id || call.type !== 'function'
            || !isRecord(call.function) || typeof call.function.name !== 'string'
            || typeof call.function.arguments !== 'string'))) {
            throw new Error('DeepSeek 响应格式错误：无效工具调用。');
        }
        if (Array.isArray(calls) && new Set(calls.map((call) => call.id)).size !== calls.length) {
            throw new Error('DeepSeek 响应格式错误: 工具调用ID重复。');
        }
        if (message.reasoning_content !== undefined && message.reasoning_content !== null
            && typeof message.reasoning_content !== 'string')
            throw new Error("DeepSeek 响应格式错误：无效reasoning_content。");
        return {
            role: 'assistant', content: message.content,
            ...(calls !== undefined ? { tool_calls: calls as Message['tool_calls'] } : {}),
            ...(message.reasoning_content != undefined ? { reasoning_content: message.reasoning_content } : {}),
        };
    }
}