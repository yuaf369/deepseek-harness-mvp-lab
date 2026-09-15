import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app";
import { readConfig } from "../src/config";

test('离线Agent通过真实工具完成计算，并发布执行事件', async () => {
    const app = await createApp(readConfig({}));
    try {
        const names: string[] = [];
        app.ctx.on('tool/executed', (event) => { names.push(event.name); });
        assert.match(await app.ctx.agent.ask('计算 12*8'), /96/);
        assert.deepEqual(names, ['calculate']);
        assert.match(await app.ctx.agent.ask('现在几点'), /\d{4}-\d{2}-\d{2}T/);
    } finally {
        await app.dispose();
    }
});

test('算术插件卸载撤销工具，重复启停不产生重复注册', async () => {
    const app = await createApp(readConfig({}));
    try {
        await app.setArithmetic(false);
        await app.setArithmetic(false);
        assert.deepEqual(app.ctx.tools.list().map((tool) => tool.function.name), ['current_time']);
        assert.match(await app.ctx.agent.ask('计算 12 * 8'), /未启用/);
        await app.setArithmetic(true);
        await app.setArithmetic(true);
        assert.equal(app.ctx.tools.list().length, 2);
        assert.match(await app.ctx.agent.ask('计算 12 * 8'), /96/);
    } finally { await app.dispose(); }
});

test('工具拒绝除零、非数字参数、非 JSON 以及未知工具', async () => {
    const app = await createApp(readConfig({}));
    try {
        for (const [name, args, expected] of [
            ['calculate', '{"a":1,"b":0,"operation":"divide"}', /零/],
            ['calculate', '{"a":"1","b":2,"operation":"add"}', /有限数字/],
            ['calculate', '{', /JSON/],
            ['missing', '{}', /未知工具/],
        ] as const) {
            const result = await app.ctx.tools.execute(name, args);
            assert.equal(result.ok, false);
            assert.match(result.error!, expected);
        }
    } finally { await app.dispose(); }
});

test('失败轮次回滚历史，成功轮次可清空', async () => {
    const app = await createApp({ ...readConfig({}), maxSteps: 1 });
    try {
        await assert.rejects(app.ctx.agent.ask('计算 12 * 8'), /步数/);
        assert.equal(app.ctx.agent.history.length, 0);
        await assert.rejects(app.ctx.agent.ask('   '), /不能为空/);
        await assert.rejects(app.ctx.agent.ask('a'.repeat(8001)), /8000/);
        await app.ctx.agent.ask('你好');
        assert.equal(app.ctx.agent.history.length, 2);
        app.ctx.agent.reset();
        assert.deepEqual(app.ctx.agent.history, []);
    } finally { await app.dispose(); }
});

test('历史按完整轮次保留最近十轮，不留下孤立工具消息', async () => {
    const app = await createApp(readConfig({}));
    try {
        for (let i = 0; i < 12; i++) await app.ctx.agent.ask(`计算 ${i} + 1`);
        assert.equal(app.ctx.agent.history.filter((message) => message.role === 'user').length, 10);
        assert.equal(app.ctx.agent.history[0].content, '计算 2 + 1');
    } finally { await app.dispose(); }
});

test('配置默认离线，错误提供方、空密钥和无效数字在启动时失败', () => {
    assert.equal(readConfig({}).provider, 'mock');
    assert.throws(() => readConfig({ MODEL_PROVIDER: 'other' }), /MODEL_PROVIDER/);
    assert.throws(() => readConfig({ MODEL_PROVIDER: 'deepseek' }), /DEEPSEEK_API_KEY/);
    for (const value of ['0', '-1', 'abc', '1.5', 'Infinity']) {
        assert.throws(() => readConfig({ MAX_STEPS: value }), /MAX_STEPS/);
    }
    assert.throws(() => readConfig({ DEEPSEEK_BASE_URL: 'ftp://example.com' }), /http/);
});

test('mock 不截取复合算式的一部分并给出误导性结果', async () => {
    const app = await createApp(readConfig({}));
    try {
        const executed: string[] = [];
        app.ctx.on('tool/executed', ({ name }) => { executed.push(name); });
        for (const prompt of ['计算 2 + 3 * 4', '计算 1e3 + 2', '计算 (2 + 3) * 4']) {
            assert.match(await app.ctx.agent.ask(prompt), /两个数字/);
        }
        assert.deepEqual(executed, []);
        assert.match(await app.ctx.agent.ask('计算 -2.5 × 4'), /-10/);
    } finally { await app.dispose(); }
});