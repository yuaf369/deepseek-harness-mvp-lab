import { Context } from 'cordis';

/**
 * 创建 Cordis 根上下文。
 *
 * Context 可以理解为整个 Cordis 应用的运行容器，
 * 插件、Service、Effect 等都会挂载在这个上下文中。
 */
const ctx = new Context();

try {

    /**
     * 注册并启动一个插件。
     *
     * ctx.plugin(...) 会创建插件实例，
     * 并调用插件的 apply() 方法完成初始化。
     *
     * 返回的 plugin 对象可以通过 dispose()
     * 主动卸载该插件。
     */
    const plugin = await ctx.plugin({

        // 插件名称
        name: 'Hello',

        /**
         * 插件入口函数。
         *
         * 当插件被加载时，Cordis 会调用 apply，
         * 并把当前 Context 传入。
         */
        apply(ctx: Context) {

            /**
             * 注册一个 Effect。
             *
             * Effect 可以理解为：
             *
             *      插件启动时执行初始化逻辑
             *                  ↓
             *      插件卸载时执行对应清理逻辑
             *
             * effect 回调本身负责“启动”，
             * 返回的函数负责“清理”。
             */
            ctx.effect(() => {

                // 插件启动时立即执行
                console.log('插件启动');

                /**
                 * 返回 cleanup 函数。
                 *
                 * 当这个 effect 所属的生命周期结束时，
                 * Cordis 会自动调用该函数。
                 *
                 * 例如当前插件被 dispose() 时，
                 * 这里会输出：
                 *
                 * 插件清理
                 */
                return () => {
                    console.log('插件清理');
                };
            });
        },
    });

    /**
     * 此时插件已经成功加载，
     * apply() 和 effect 初始化逻辑都已经执行完成。
     *
     * 当前输出顺序首先应该是：
     *
     * 插件启动
     * 准备卸载
     */
    console.log('准备卸载');

    /**
     * 主动卸载 Hello 插件。
     *
     * dispose() 会结束插件对应的生命周期，
     * Cordis 会自动清理插件注册的 Effect。
     *
     * 因此前面 ctx.effect() 返回的 cleanup 函数
     * 会在这里被调用。
     *
     * 最终会输出：
     *
     * 插件清理
     */
    await plugin.dispose();

} finally {

    /**
     * 无论 try 中：
     *
     * - 插件正常运行；
     * - plugin.dispose() 失败；
     * - 中途抛出异常；
     *
     * finally 都会执行。
     *
     * ctx.fiber 可以理解为根 Context 的生命周期管理器。
     *
     * dispose() 会结束整个 Cordis Context 的生命周期，
     * 清理仍然存活的插件、Effect 和其他资源。
     */
    await ctx.fiber.dispose();
}