import assert from "node:assert/strict";

import { Context } from "cordis";

import { ToolsService } from "../src/plugins/tools";
import { arithmeticPlugin } from "../src/plugins/arithmetic";
import { clockPlugin } from "../src/plugins/clock";

/**
 * 创建 Cordis 根上下文。
 *
 * 后续注册的 Service、插件以及 effect
 * 都会挂载在这个 Context 生命周期中。
 */
const ctx = new Context();

try {

    /**
     * 注册 ToolsService。
     *
     * ToolsService 负责统一管理工具，例如：
     *
     * - 注册工具；
     * - 查询当前工具列表；
     * - 根据工具名执行工具；
     * - 在插件卸载时移除对应工具。
     *
     * 注册完成后，可以通过：
     *
     * ctx.tools
     *
     * 访问该 Service。
     */
    await ctx.plugin(ToolsService);

    /**
     * 注册算术插件。
     *
     * arithmeticPlugin 会向 ToolsService
     * 注册 calculate 工具。
     *
     * 保存返回的 arithmetic 插件实例，
     * 是因为后面需要主动调用 dispose()
     * 来测试插件卸载后的工具清理行为。
     */
    const arithmetic = await ctx.plugin(arithmeticPlugin);

    /**
     * 注册时钟插件。
     *
     * clockPlugin 会向 ToolsService
     * 注册 current_time 工具。
     *
     * 这里不需要单独保存插件实例，
     * 因为后续不会手动卸载它。
     */
    await ctx.plugin(clockPlugin);

    /**
     * 通过 ToolsService 执行 calculate 工具。
     *
     * execute() 的两个参数分别是：
     *
     * 1. 工具名称；
     * 2. 工具参数 JSON 字符串。
     *
     * 这里相当于调用：
     *
     * calculate({
     *   a: 12,
     *   b: 8,
     *   operation: 'multiply'
     * })
     *
     * 预期计算结果为：
     *
     * 12 * 8 = 96
     */
    const result = await ctx.tools.execute(
        'calculate',
        JSON.stringify({
            a: 12,
            b: 8,
            operation: 'multiply',
        }),
    );

    /**
     * 使用 Node.js strict assert 验证工具返回值。
     *
     * deepEqual 会比较对象内部结构和值。
     *
     * 如果 result 不是：
     *
     * {
     *   ok: true,
     *   value: 96
     * }
     *
     * assert 会直接抛出异常，
     * 从而表示测试失败。
     */
    assert.deepEqual(result, {
        ok: true,
        value: 96,
    });

    /**
     * 测试通过后输出计算结果。
     */
    console.log("计算结果:", result);

    /**
     * 主动卸载 arithmeticPlugin。
     *
     * 如果 arithmeticPlugin 注册 calculate 工具时
     * 正确使用了 Cordis 的 effect / cleanup 生命周期，
     *
     * 那么插件被 dispose() 后，
     * calculate 工具也应该自动从 ToolsService 中移除。
     */
    await arithmetic.dispose();

    /**
     * 获取插件卸载之后当前仍然存在的工具名称。
     *
     * ctx.tools.list()
     *      ↓
     * 返回所有 ToolSchema
     *
     * map(...)
     *      ↓
     * 只提取 function.name。
     *
     * 此时 calculate 已经随着算术插件卸载，
     * 理论上只剩下 clockPlugin 注册的：
     *
     * current_time
     */
    const names = ctx.tools
        .list()
        .map((tool) => tool.function.name);

    /**
     * 验证插件卸载后的工具列表。
     *
     * 预期：
     *
     * ['current_time']
     *
     * 这个断言实际上验证了一个很重要的行为：
     *
     * arithmeticPlugin.dispose()
     *          ↓
     * arithmeticPlugin 生命周期结束
     *          ↓
     * calculate 工具 cleanup 被触发
     *          ↓
     * calculate 从 ToolsService 中移除
     */
    assert.deepEqual(names, ['current_time']);

    /**
     * 输出卸载之后的工具列表。
     */
    console.log('卸载后的工具', names);

} finally {

    /**
     * 无论前面的测试成功还是失败，
     * 最终都释放整个 Cordis Context。
     *
     * 这里会清理仍然存在的：
     *
     * - ToolsService；
     * - clockPlugin；
     * - 相关 effect；
     * - 其他上下文资源。
     *
     * 使用 finally 可以确保即使 assert 失败，
     * 测试环境也不会遗留资源。
     */
    await ctx.fiber.dispose();
}