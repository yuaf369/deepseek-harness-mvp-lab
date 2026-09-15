import { createInterface } from 'node:readline';
import { loadEnvFile } from 'node:process';

import { createApp } from './app.js';
import { readConfig } from './config.js';
import { errorMessage } from './types.js';

/**
 * CLI 帮助信息。
 *
 * 当前程序支持三种运行方式：
 *
 * 1. demo
 *    使用 mock 模型进行离线演示，不依赖 .env 和真实模型 API。
 *
 * 2. ask
 *    单次调用 Agent，得到回答后直接退出。
 *
 * 3. interactive
 *    默认模式，启动 readline 进入持续交互式对话。
 *
 * 同时提供一些以 "/" 开头的 CLI 内部命令，
 * 用于查看工具、动态启停插件、重置会话等。
 */
const help = `Cordis MVP · 插件化命令行助手

npm run demo                         离线演示(忽略 .env)
npm run dev                          交互对话
npm run dev -- --ask "计算 12 * 8"    单次提问
npm run dev -- --help                 查看帮助

/tools    列出当前工具
/disable  卸载算术插件
/enable   恢复算术插件
/reset    清空当前会话
/quit     退出

mock 为离线规则演示；真实对话需在 .env 配置 MODEL_PROVIDER=deepseek。`;

/**
 * CLI 主入口。
 *
 * 主要职责：
 *
 * 1. 解析命令行参数；
 * 2. 加载环境变量和应用配置；
 * 3. 创建 Cordis 应用；
 * 4. 注册 SIGINT / SIGTERM 退出处理；
 * 5. 根据启动参数进入 demo、单次问答或交互模式；
 * 6. 程序结束时统一释放应用资源。
 */
async function main() {

    /**
     * 读取 Node.js 启动参数。
     *
     * process.argv：
     *
     * [
     *   node可执行文件路径,
     *   当前脚本路径,
     *   ...用户参数
     * ]
     *
     * 因此 slice(2) 只保留用户真正传入的参数。
     */
    const args = process.argv.slice(2);

    /**
     * --help / -h
     *
     * 输出帮助信息并直接结束 main。
     */
    if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
        console.log(help);
        return;
    }

    /**
     * 判断是否进入 demo 模式。
     *
     * demo 模式会：
     * - 使用 mock provider；
     * - 不加载 .env；
     * - 自动执行预定义测试问题；
     * - 演示插件动态卸载和恢复。
     */
    const demo = args.length === 1 && args[0] === '--demo';

    /**
     * 单次提问模式：
     *
     * npm run dev -- --ask "计算 12 * 8"
     *
     * 若参数格式符合要求，则 ask 保存问题文本；
     * 否则为 undefined。
     */
    const ask =
        args.length === 2 && args[0] === '--ask'
            ? args[1]
            : undefined;

    /**
     * 如果存在命令行参数，
     * 但既不是 demo，也不是合法的 --ask，
     * 说明用户传入了未知参数。
     */
    if (args.length && !demo && ask === undefined) {
        throw new Error('无效参数，请运行 npm run dev -- --help。');
    }

    /**
     * 加载 .env 环境变量。
     *
     * demo 模式完全离线，因此故意忽略 .env。
     *
     * loadEnvFile() 默认尝试读取当前目录下的 .env。
     *
     * 如果文件不存在（ENOENT），允许程序继续运行，
     * 后续交给 readConfig() 判断配置是否完整。
     *
     * 其他错误，例如权限错误、文件读取错误等，
     * 不应该被吞掉，因此继续向上抛出。
     */
    if (!demo) {
        try {
            loadEnvFile();
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
    }

    /**
     * 构造应用配置。
     *
     * demo：
     *   传入空对象，让 readConfig() 生成 mock 配置。
     *
     * 正常模式：
     *   从 process.env 中读取 MODEL_PROVIDER、
     *   MODEL_NAME、API KEY 等环境变量。
     */
    const config = readConfig(demo ? {} : process.env);

    /**
     * 创建整个 Cordis 应用。
     *
     * createApp() 通常负责：
     * - 创建 Cordis Context；
     * - 注册 ModelService；
     * - 注册 ToolService；
     * - 注册 AgentService；
     * - 安装算术插件等业务插件。
     *
     * console.log 被作为日志输出函数传入。
     */
    const app = await createApp(config, console.log);

    /**
     * readline 实例。
     *
     * 只有进入交互模式后才真正创建，
     * 因此初始值为 undefined。
     */
    let rl: ReturnType<typeof createInterface> | undefined;

    /**
     * 标记应用是否正在停止。
     *
     * 防止收到退出信号后，
     * readline 循环继续处理新的输入。
     */
    let stopping = false;

    /**
     * 统一的停止处理函数。
     *
     * SIGINT：
     *   通常由 Ctrl+C 触发。
     *
     * SIGTERM：
     *   通常由操作系统、Docker、进程管理器等发送。
     *
     * stop() 会：
     * 1. 设置 stopping；
     * 2. 关闭 readline；
     * 3. 开始释放 Cordis 应用资源。
     */
    const stop = () => {
        stopping = true;

        // 如果已经进入交互模式，则停止继续读取 stdin。
        rl?.close();

        /**
         * stop 本身不是 async 函数，
         * 因此这里不能直接 await app.dispose()。
         *
         * 使用 void 明确表示：
         * 我们主动忽略 Promise 返回值，
         * 但仍然通过 catch 处理 dispose 失败。
         */
        void app.dispose().catch((error) =>
            console.error(errorMessage(error)),
        );
    };

    /**
     * once 表示信号处理函数只执行一次，
     * 防止重复信号导致重复 dispose。
     */
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);

    try {

        /**
         * 输出当前模型运行模式。
         *
         * mock：
         *   Cordis MVP | 模式：mock（离线规则演示）
         *
         * deepseek：
         *   Cordis MVP | 模式：deepseek / deepseek-chat
         */
        console.log(
            `Cordis MVP | 模式：${config.provider}${
                config.provider === 'mock'
                    ? '（离线规则演示）'
                    : ` / ${config.model}`
            }`,
        );

        /**
         * ============================
         * Demo 模式
         * ============================
         *
         * 自动执行一套固定流程，
         * 用于快速验证整个 MVP 是否工作正常。
         */
        if (demo) {

            /**
             * 首先测试两个问题：
             *
             * - "计算 12 * 8"
             *   应该触发 calculator 工具。
             *
             * - "现在几点"
             *   用于测试普通 Agent 回复。
             */
            for (const prompt of ['计算 12 * 8', '现在几点']) {
                console.log(`\n你：${prompt}`);

                const answer = await app.ctx.agent.ask(prompt);

                console.log(`助手：${answer}`);
            }

            /**
             * 动态卸载算术插件。
             *
             * 这里体现 Cordis 插件系统的核心能力：
             *
             * 服务运行期间可以动态改变插件，
             * Agent 能看到的工具集合也会随之变化。
             */
            await app.setArithmetic(false);

            /**
             * 查看插件卸载之后，
             * ToolService 中还剩哪些工具。
             */
            console.log(
                '\n已卸载算术插件，当前工具：',
                app.ctx.tools
                    .list()
                    .map((tool) => tool.function.name)
                    .join(', '),
            );

            /**
             * 再次询问计算问题。
             *
             * 此时 calculate 工具已经不存在，
             * 因此 Agent 不应该再通过算术插件完成计算。
             */
            console.log(
                await app.ctx.agent.ask('计算 12 * 8'),
            );

            /**
             * 恢复算术插件。
             */
            await app.setArithmetic(true);

            console.log('\n已恢复算术插件');

            /**
             * 再测试一次，
             * 验证插件恢复之后工具能够重新被 Agent 使用。
             */
            console.log(
                await app.ctx.agent.ask('计算 12 * 8'),
            );

            return;
        }

        /**
         * ============================
         * 单次提问模式
         * ============================
         *
         * 例如：
         *
         * npm run dev -- --ask "计算 12 * 8"
         *
         * 执行一次 Agent.ask() 后立即退出，
         * 非常适合脚本调用和快速测试。
         */
        if (ask !== undefined) {
            console.log(await app.ctx.agent.ask(ask));
            return;
        }

        /**
         * ============================
         * 交互式 CLI 模式
         * ============================
         */
        console.log(
            '输入问题；/help 查看命令，/quit 退出。',
        );

        /**
         * 创建 readline 接口。
         *
         * input：
         *   标准输入 stdin。
         *
         * output：
         *   标准输出 stdout。
         *
         * terminal：
         *   如果当前 stdin 真的是终端，
         *   readline 会启用终端交互能力。
         *
         * 如果输入来自 pipe：
         *
         * echo "hello" | npm run dev
         *
         * process.stdin.isTTY 通常为 false。
         */
        rl = createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: Boolean(process.stdin.isTTY),
        });

        /**
         * readline 自己也可能收到 Ctrl+C，
         * 因此复用统一的 stop()。
         */
        rl.on('SIGINT', stop);

        /**
         * 设置交互提示符。
         */
        rl.setPrompt('你 > ');

        /**
         * 只有真正运行在 TTY 中时才显示 prompt。
         *
         * 如果 stdin 来自 pipe，
         * 则不输出提示符，避免污染脚本输出。
         */
        if (process.stdin.isTTY) {
            rl.prompt();
        }

        /**
         * readline.Interface 实现了 AsyncIterable，
         * 因此可以直接通过：
         *
         * for await ... of
         *
         * 持续异步读取用户输入。
         *
         * 每次循环对应用户输入的一行文本。
         */
        for await (const raw of rl) {

            /**
             * 如果应用已经收到退出信号，
             * 不再继续处理用户输入。
             */
            if (stopping) {
                break;
            }

            /**
             * 去掉输入前后的空格和换行。
             */
            const line = raw.trim();

            /**
             * /quit 和 /exit 都用于退出 CLI。
             *
             * break 后会进入 finally，
             * 最终执行 app.dispose()。
             */
            if (line === '/quit' || line === '/exit') {
                break;
            }

            try {

                /**
                 * 查看 CLI 帮助。
                 */
                if (line === '/help') {
                    console.log(help);
                }

                /**
                 * 查看当前 ToolService 中注册的所有工具。
                 *
                 * Tool Schema 使用 OpenAI function calling 风格，
                 * 因此工具名称和描述位于：
                 *
                 * tool.function.name
                 * tool.function.description
                 */
                else if (line === '/tools') {
                    console.log(
                        app.ctx.tools
                            .list()
                            .map(
                                (tool) =>
                                    `${tool.function.name}：${tool.function.description}`,
                            )
                            .join('\n'),
                    );
                }

                /**
                 * 动态卸载算术插件。
                 *
                 * 插件被卸载后，
                 * calculator 工具会从 ToolService 中消失。
                 */
                else if (line === '/disable') {
                    await app.setArithmetic(false);
                    console.log('已停用算术插件。');
                }

                /**
                 * 动态重新安装算术插件。
                 */
                else if (line === '/enable') {
                    await app.setArithmetic(true);
                    console.log('已恢复算术插件。');
                }

                /**
                 * 清空 Agent 当前维护的会话历史。
                 *
                 * reset 后后续问题不会继续携带之前的上下文。
                 */
                else if (line === '/reset') {
                    app.ctx.agent.reset();
                    console.log('会话已清空。');
                }

                /**
                 * 所有以 "/" 开头、
                 * 但没有被前面命令识别的内容，
                 * 都认为是未知 CLI 命令。
                 */
                else if (line.startsWith('/')) {
                    console.log(
                        '未知命令，请输入 /help。',
                    );
                }

                /**
                 * 普通文本直接交给 Agent。
                 *
                 * Agent 内部可能执行：
                 *
                 * 用户消息
                 *   ↓
                 * 模型推理
                 *   ↓
                 * tool_calls
                 *   ↓
                 * ToolService 执行工具
                 *   ↓
                 * tool result
                 *   ↓
                 * 再次调用模型
                 *   ↓
                 * 最终回答
                 */
                else if (line) {
                    const answer =
                        await app.ctx.agent.ask(line);

                    console.log(`助手 > ${answer}`);
                }
            } catch (error) {

                /**
                 * 单轮对话执行失败不直接结束整个 CLI。
                 *
                 * 例如：
                 * - 模型 API 请求失败；
                 * - 工具执行失败；
                 * - 模型返回格式错误。
                 *
                 * errorMessage() 用于将 unknown 类型错误
                 * 统一转换成可读字符串。
                 */
                if (!stopping) {
                    console.error(
                        `错误：${errorMessage(error)}`,
                    );
                }
            }

            /**
             * 一轮命令处理完成后，
             * 再次显示输入提示符。
             */
            if (
                process.stdin.isTTY &&
                !stopping
            ) {
                rl.prompt();
            }
        }
    } finally {

        /**
         * ============================
         * 应用资源清理
         * ============================
         *
         * 无论程序：
         * - 正常退出；
         * - demo return；
         * - ask return；
         * - readline break；
         * - try 内抛出异常；
         *
         * 最终都会执行 finally。
         */

        /**
         * 移除进程信号监听器，
         * 避免应用生命周期结束后仍然残留监听。
         */
        process.removeListener('SIGINT', stop);
        process.removeListener('SIGTERM', stop);

        /**
         * 如果 readline 已创建，则关闭。
         *
         * ?. 保证 demo / ask 模式下 rl 为 undefined 时
         * 不会产生异常。
         */
        rl?.close();

        /**
         * 销毁 Cordis 应用。
         *
         * dispose 通常会触发：
         * - Cordis effect cleanup；
         * - Service 清理；
         * - 插件卸载；
         * - AbortController.abort()；
         * - 网络连接等资源释放。
         */
        await app.dispose();
    }
}

/**
 * 启动 CLI。
 *
 * main() 是 async 函数，因此返回 Promise。
 *
 * 顶层统一捕获 main 中未处理的异常，
 * 输出错误信息并设置非 0 退出码。
 *
 * 不直接调用 process.exit(1)，
 * 可以让 Node.js 有机会完成剩余的资源清理、
 * stdout/stderr 刷新等操作。
 */
main().catch((error) => {
    console.error(
        `错误：${errorMessage(error)}`,
    );

    process.exitCode = 1;
});