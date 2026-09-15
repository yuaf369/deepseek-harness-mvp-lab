import { Context, Service } from "cordis";
import {
    errorMessage,
    type ToolDefinition,
    type ToolEvent,
    type ToolResult,
} from "../types";

/**
 * 扩展 Cordis 自身的类型声明。
 *
 * 这里使用 TypeScript 的「模块声明合并」机制，
 * 给 cordis 中原本的 Context 和 Events 接口增加我们自己的定义。
 */
declare module "cordis" {

    interface Context {
        /**
         * 向 Context 中注入 tools 服务。
         *
         * 注册 ToolsService 后，就可以通过：
         *
         * ctx.tools
         *
         * 访问这个服务。
         */
        tools: ToolsService;
    }

    interface Events {
        /**
         * 工具执行完成事件。
         *
         * @mode emit
         *
         * 当 execute() 执行完一个工具后，
         * ToolsService 会通过：
         *
         * ctx.emit("tool/executed", event)
         *
         * 广播本次工具执行结果。
         */
        "tool/executed"(event: ToolEvent): void;
    }
}


/**
 * 工具管理服务。
 *
 * 主要负责：
 *
 * 1. 注册工具
 * 2. 卸载工具
 * 3. 查询当前已经注册的工具
 * 4. 根据工具名称执行工具
 * 5. 将工具执行结果通过事件广播出去
 *
 * ToolsService 继承 Cordis 的 Service，
 * 因此它本身会作为一个 Cordis Service 挂载到 Context 中。
 *
 * 注册工具本质上属于一种「可撤销副作用」：
 *
 * register(tool)
 *
 * 会返回一个清理函数：
 *
 * () => void
 *
 * 调用这个函数即可撤销注册。
 *
 * 插件中可以将这个返回值交给 ctx.effect() 管理，
 * 这样插件卸载时 Cordis 就可以自动注销工具。
 */
export class ToolsService extends Service {

    /**
     * 保存当前所有已经注册的工具。
     *
     * key:
     *   工具名称，例如 "calculate"
     *
     * value:
     *   完整的 ToolDefinition
     *
     * 使用 Map 可以：
     *
     * 1. 根据工具名快速查找工具
     * 2. 检查工具是否重复注册
     * 3. 快速删除已经卸载的工具
     */
    private entries = new Map<string, ToolDefinition>();


    /**
     * 创建 ToolsService。
     *
     * @param ctx 当前 Cordis Context
     */
    constructor(ctx: Context) {

        /**
         * 调用父类 Service 构造函数。
         *
         * "tools" 是这个 Service 在 Context 中的名称，
         * 因此之后可以通过：
         *
         * ctx.tools
         *
         * 获取当前 ToolsService。
         */
        super(ctx, "tools");
    }


    /**
     * 注册一个工具。
     *
     * @param tool 要注册的工具定义
     *
     * @returns
     * 返回一个卸载函数。
     *
     * 调用返回的函数后，
     * 当前工具会从 entries 中删除。
     *
     * 例如：
     *
     * const dispose = ctx.tools.register(calculator);
     *
     * dispose();
     */
    register(tool: ToolDefinition): () => void {

        /**
         * ToolDefinition 中包含 OpenAI 风格的工具 Schema：
         *
         * {
         *   schema: {
         *     type: "function",
         *     function: {
         *       name: "calculate",
         *       ...
         *     }
         *   }
         * }
         *
         * 因此这里取出工具名称作为 Map 的 key。
         */
        const name = tool.schema.function.name;

        /**
         * 防止同名工具被重复注册。
         *
         * 因为执行工具时是通过 name 查找，
         * 如果允许重复注册，就无法确定应该执行哪个工具。
         */
        if (this.entries.has(name)) {
            throw new Error(`工具重复注册：${name}`);
        }

        /**
         * 将工具保存到工具注册表。
         */
        this.entries.set(name, tool);

        /**
         * 返回一个清理函数。
         *
         * 这体现 Cordis 中非常重要的设计思想：
         *
         * “副作用应该可以撤销”。
         *
         * 插件卸载时调用这个函数，
         * 就可以把插件注册的工具同时删除。
         */
        return () => {
            this.entries.delete(name);
        };
    }


    /**
     * 获取当前已经注册的所有工具 Schema。
     *
     * 注意：
     *
     * entries 中保存的是 ToolDefinition，
     * 但这里返回的只是 tool.schema。
     *
     * 原因是模型进行 Tool Calling 时，
     * 只需要知道工具的：
     *
     * - name
     * - description
     * - parameters
     *
     * 并不需要知道真正的 execute() 实现。
     */
    list() {
        return [...this.entries.values()]
            .map((tool) => tool.schema);
    }


    /**
     * 执行指定工具。
     *
     * @param name
     * 模型请求调用的工具名称，例如：
     *
     * "calculate"
     *
     * @param rawArguments
     * 模型返回的原始 JSON 参数字符串，例如：
     *
     * '{"a":12,"b":8,"operation":"multiply"}'
     *
     * @returns
     * 统一格式的工具执行结果 ToolResult。
     *
     * 成功：
     *
     * {
     *   ok: true,
     *   value: ...
     * }
     *
     * 失败：
     *
     * {
     *   ok: false,
     *   error: "..."
     * }
     */
    async execute(
        name: string,
        rawArguments: string,
    ): Promise<ToolResult> {

        /**
         * 无论工具执行成功还是失败，
         * 最终都会生成一个 ToolResult。
         */
        let result: ToolResult;

        try {

            /**
             * 根据工具名称从注册表中查找工具。
             */
            const tool = this.entries.get(name);

            /**
             * 如果工具不存在，
             * 说明模型调用了一个当前系统没有注册的工具。
             */
            if (!tool) {
                throw new Error(`未知工具：${name}`);
            }

            /**
             * 工具参数解析后的结果。
             *
             * 在 JSON.parse 之前我们还不能确定参数的具体类型，
             * 所以先使用 unknown。
             *
             * 真正的参数验证应该由具体工具负责。
             */
            let args: unknown;

            try {

                /**
                 * Tool Calling 返回的 arguments 通常是 JSON 字符串，
                 * 因此这里需要先反序列化成 JavaScript 对象。
                 */
                args = JSON.parse(rawArguments);

            } catch {

                /**
                 * JSON 格式错误时，
                 * 转换成统一的工具执行错误。
                 */
                throw new Error("工具参数必须是有效 JSON");
            }

            /**
             * 调用工具真正的执行函数。
             *
             * await 说明工具既可以执行：
             *
             * - 同步计算
             * - 异步网络请求
             * - 数据库操作
             * - 文件操作
             *
             * 等各种逻辑。
             */
            const value = await tool.execute(args);

            /**
             * 将执行结果包装成统一的成功结构。
             */
            result = {
                ok: true,
                value,
            };

        } catch (error) {

            /**
             * 捕获整个工具调用链中的错误，包括：
             *
             * - 工具不存在
             * - JSON 参数解析失败
             * - tool.execute() 内部执行失败
             *
             * errorMessage() 用于把 unknown 类型的异常
             * 安全地转换成字符串。
             */
            result = {
                ok: false,
                error: errorMessage(error),
            };
        }

        /**
         * 无论工具执行成功还是失败，
         * 都广播一次 tool/executed 事件。
         *
         * 其他插件可以监听这个事件，实现：
         *
         * - 日志记录
         * - 调试
         * - tracing
         * - 统计工具调用次数
         * - 监控工具失败率
         */
        this.ctx.emit("tool/executed", {
            name,
            result,
        });

        /**
         * 将工具结果返回给调用方。
         *
         * 上层 Agent 通常会把这个结果重新作为：
         *
         * role: "tool"
         *
         * 的消息发送给 LLM。
         */
        return result;
    }
}