import assert from "assert/strict";
import { createApp } from "../src/app";
import { readConfig } from "../src/config";

const app = await createApp(readConfig({}), console.log);
try {
    const answer = await app.ctx.agent.ask('计算 12*8');
    assert.match(answer, /96/);
    console.log(answer);
    await app.setArithmetic(false);
    assert.match(await app.ctx.agent.ask('计算12*8'), /未启用/);
    await app.setArithmetic(true);
    assert.match(await app.ctx.agent.ask('计算12*8'), /96/);
    console.log('Agent闭环、插件卸载和恢复均通过');
} finally {
    await app.dispose();
}