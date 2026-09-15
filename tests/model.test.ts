import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';

async function serve(handler: (req: IncomingMessage, res: ServerResponse) => void) {
    const server = createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    return {
        url: `http://127.0.0.1:${address.port}/v1`,
        close: () => new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
            server.closeAllConnections();
        }),
    };
}

test('真实 HTTP 适配器携带工具定义并回填多个工具结果及对话历史', async () => {
    const requests: any[] = [];
    const headers: string[] = [];
    const paths: string[] = [];
    const server = await serve(async (req, res) => {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw);
        requests.push(body);
        headers.push(req.headers.authorization ?? '');
        paths.push(req.url ?? '');
        const message = requests.length === 1 ? {
            role: 'assistant', content: null, reasoning_content: 'retained',
            tool_calls: [
                { id: 'call-a', type: 'function', function: { name: 'calculate', arguments: '{"a":12,"b":8,"operation":"multiply"}' } },
                { id: 'call-b', type: 'function', function: { name: 'calculate', arguments: '{"a":5,"b":2,"operation":"subtract"}' } },
            ],
        } : { role: 'assistant', content: '结果是 96 和 3。' };
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
            id: 'test-completion', object: 'chat.completion', created: 0,
            model: 'test-model', choices: [{ index: 0, finish_reason: requests.length === 1 ? 'tool_calls' : 'stop', message }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        }));
    });
    const app = await createApp(readConfig({ MODEL_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'test-only', DEEPSEEK_BASE_URL: server.url }));
    try {
        assert.match(await app.ctx.agent.ask('计算两组数字'), /96 和 3/);
        assert.deepEqual(headers, ['Bearer test-only', 'Bearer test-only']);
        assert.deepEqual(paths, ['/v1/chat/completions', '/v1/chat/completions']);
        assert.equal(requests[0].tools.length, 2);
        assert.deepEqual(requests[0].thinking, { type: 'disabled' });
        const replies = requests[1].messages.filter((m: any) => m.role === 'tool');
        assert.deepEqual(replies.map((m: any) => m.tool_call_id), ['call-a', 'call-b']);
        assert.deepEqual(replies.map((m: any) => JSON.parse(m.content).value), [96, 3]);
        assert.equal(requests[1].messages[2].reasoning_content, 'retained');
        await app.ctx.agent.ask('复述上次结果');
        assert.equal(requests[2].messages.filter((m: any) => m.role === 'user').length, 2);
    } finally { await app.dispose(); await server.close(); }
});

test('HTTP 失败和非法响应不会提交历史，也不会泄漏响应中的密钥', async () => {
    for (const [status, body, pattern] of [
        [401, 'test-only secret', /401/],
        [200, 'not-json', /JSON/],
        [200, '{}', /响应格式/],
        [200, '{"choices":[{"message":{"role":"assistant","content":"partial"},"finish_reason":"length"}]}', /截断/],
    ] as const) {
        const server = await serve((_req, res) => { res.writeHead(status); res.end(body); });
        const app = await createApp(readConfig({ MODEL_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'test-only', DEEPSEEK_BASE_URL: server.url }));
        try {
            await assert.rejects(app.ctx.agent.ask('你好'), (error: Error) => {
                assert.match(error.message, pattern);
                assert.doesNotMatch(error.message, /test-only/);
                return true;
            });
            assert.deepEqual(app.ctx.agent.history, []);
        } finally { await app.dispose(); await server.close(); }
    }
});

test('请求超时会结束等待，并阻止同一会话并发写入', async () => {
    const server = await serve(() => { });
    const app = await createApp(readConfig({ MODEL_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'test-only', DEEPSEEK_BASE_URL: server.url, REQUEST_TIMEOUT_MS: '100' }));
    try {
        const pending = assert.rejects(app.ctx.agent.ask('你好'), /超时/);
        await assert.rejects(app.ctx.agent.ask('同时提问'), /处理中/);
        await pending;
        assert.deepEqual(app.ctx.agent.history, []);
    } finally { await app.dispose(); await server.close(); }
});

test('卸载应用会取消进行中的模型请求', async () => {
    let received!: () => void;
    const started = new Promise<void>((resolve) => { received = resolve; });
    const server = await serve(() => { received(); });
    const app = await createApp(readConfig({ MODEL_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'test-only', DEEPSEEK_BASE_URL: server.url, REQUEST_TIMEOUT_MS: '2000' }));
    try {
        const pending = assert.rejects(app.ctx.agent.ask('你好'), /取消/);
        await started;
        await app.dispose();
        await pending;
    } finally { await app.dispose(); await server.close(); }
});