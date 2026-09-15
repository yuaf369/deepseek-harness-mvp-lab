import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function cli(args: string[], input?: string) {
    return spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', ...args], {
        encoding: 'utf8', timeout: 10000, input,
        env: { ...process.env, MODEL_PROVIDER: 'mock' },
    });
}

test('离线演示覆盖工具卸载和恢复，不需要 .env', () => {
    const result = cli(['--demo']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /96/);
    assert.match(result.stdout, /未启用/);
    assert.match(result.stdout, /恢复/);
});

test('CLI 支持一次性提问、帮助以及错误参数退出码', () => {
    assert.match(cli(['--ask', '计算 12 * 8']).stdout, /96/);
    assert.equal(cli(['--help']).status, 0);
    assert.equal(cli(['--unknown']).status, 1);
    assert.equal(cli(['--ask']).status, 1);
});

test('管道输入按顺序处理命令、计算和退出', () => {
    const result = cli([], '/disable\n/tools\n/enable\n计算 12 * 8\n/reset\n/quit\n');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /已停用/);
    assert.match(result.stdout, /96/);
    assert.match(result.stdout, /已清空/);
});