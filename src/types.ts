// 描述一次 LLM 发起的工具调用。
// 对应 OpenAI / DeepSeek 工具调用协议中的 tool_call。
export interface ToolCall {

    // 当前工具调用的唯一 ID。
    //
    // 后续工具执行完成后，
    // tool 类型的 Message 会通过 tool_call_id
    // 与这一次调用进行关联。
    id: string;

    // 工具调用类型。
    //
    // 当前只支持 function 类型，
    // 因此这里使用字符串字面量类型进行限制。
    type: 'function';

    // LLM 希望调用的具体函数信息。
    function: {

        // 工具名称。
        //
        // 例如： 
        // "calculate"
        // "current_time"
        name: string;

        // 工具参数。
        //
        // 注意这里不是对象，而是 JSON 字符串。
        //
        // 例如：
        // '{"a":12,"b":8,"operation":"multiply"}'
        //
        // 真正执行工具之前，
        // 通常需要先使用 JSON.parse() 转换成 JavaScript 对象。
        arguments: string;
    };
}


// 描述 Agent 对话中的一条消息。
//
// system、user、assistant、tool
// 都统一使用这个 Message 类型表示。
export interface Message {

    // 消息角色。
    //
    // system:
    // 系统提示词。
    //
    // user:
    // 用户消息。
    //
    // assistant:
    // LLM 返回的消息。
    //
    // tool:
    // 工具执行后的结果。
    role: 'system' | 'user' | 'assistant' | 'tool';

    // 消息正文内容。
    //
    // 某些 assistant 消息可能只有 tool_calls，
    // 没有普通文本内容，
    // 因此允许为 null。
    content: string | null;

    // assistant 发起的工具调用列表。
    //
    // ? 表示这个字段是可选的。
    //
    // 例如 LLM 认为需要调用 calculate 工具时，
    // 会返回类似：
    //
    // tool_calls: [
    //   {
    //     id: "...",
    //     type: "function",
    //     function: {
    //       name: "calculate",
    //       arguments: "{\"a\":12,\"b\":8}"
    //     }
    //   }
    // ]
    tool_calls?: ToolCall[];

    // 当 role === 'tool' 时，
    // 用来说明当前工具结果对应的是哪一次 ToolCall。
    //
    // 它通常应该对应：
    //
    // ToolCall.id
    tool_call_id?: string;

    // 模型的 reasoning / thinking 内容。
    //
    // 某些模型（例如 DeepSeek）
    // 可能会额外返回 reasoning_content。
    //
    // 这里允许：
    // 1. string
    // 2. null
    // 3. 字段不存在
    reasoning_content?: string | null;
}


// 描述提供给 LLM 的工具 Schema。
//
// 它的作用不是执行工具，
// 而是告诉 LLM：
// “有哪些工具、叫什么、参数是什么”。
export interface ToolSchema {

    // 当前工具类型固定为 function。
    type: 'function';

    // 工具函数的元信息。
    function: {

        // 工具名称。
        //
        // LLM 发起 ToolCall 时会通过这个名称调用工具。
        name: string;

        // 工具功能说明。
        //
        // LLM 会根据 description 判断：
        // 当前用户请求是否需要使用这个工具。
        description: string;

        // 工具参数的 JSON Schema。
        //
        // 使用 Record<string, unknown>
        // 是因为参数 Schema 的结构比较灵活，
        // 这里不对内部字段做更严格的类型限制。
        //
        // 例如：
        //
        // {
        //   type: "object",
        //   properties: {
        //     a: { type: "number" },
        //     b: { type: "number" }
        //   },
        //   required: ["a", "b"]
        // }
        parameters: Record<string, unknown>;
    };
}


// 描述一个“真正可以执行”的工具。
//
// ToolDefinition = 工具说明 + 工具实现。
export interface ToolDefinition {

    // 提供给 LLM 的工具描述。
    schema: ToolSchema;

    // 工具真正执行时调用的函数。
    //
    // args:
    // 工具输入参数。
    //
    // 返回值：
    // 可以是同步返回值，
    // 也可以是 Promise。
    //
    // 因此工具既可以写成：
    //
    // execute: (args) => result
    //
    // 也可以写成：
    //
    // execute: async (args) => result
    execute: (args: unknown) => unknown | Promise<unknown>;
}


// 描述工具执行之后的统一返回结果。
export interface ToolResult {

    // 工具是否执行成功。
    ok: boolean;

    // 执行成功时返回的结果。
    //
    // 因为不同工具的返回值可能完全不同，
    // 所以这里使用 unknown。
    value?: unknown;

    // 执行失败时的错误信息。
    error?: string;
}


// 描述一次工具执行事件。
//
// 可以用于日志、监听器、UI 展示等场景。
export interface ToolEvent {

    // 被执行的工具名称。
    name: string;

    // 工具执行结果。
    result: ToolResult;
}


// 整个应用的配置类型。
export interface AppConfig {

    // 模型提供方。
    //
    // mock:
    // 使用本地模拟模型，方便测试。
    //
    // deepseek:
    // 调用真实 DeepSeek API。
    provider: 'mock' | 'deepseek';

    // LLM API Key。
    //
    // mock 模式下通常不会真正使用。
    apiKey: string;

    // LLM API 的基础地址。
    //
    // 例如：
    // https://api.deepseek.com
    baseUrl: string;

    // 使用的具体模型名称。
    //
    // 例如：
    // deepseek-chat
    model: string;

    // 单次 API 请求最大超时时间。
    //
    // 单位通常是毫秒。
    //
    // 例如：
    // 30000 = 30 秒
    timeoutMs: number;

    // Agent 单轮运行允许的最大步骤数。
    //
    // 用于防止：
    //
    // LLM -> 工具
    //    -> LLM
    //    -> 工具
    //    -> LLM
    //    -> ...
    //
    // 无限循环。
    maxSteps: number;
}


// 类型守卫函数：
// 判断一个 unknown 值是否是普通对象。
//
// 返回类型中的：
//
// value is Record<string, unknown>
//
// 不是普通 boolean 类型，
// 而是 TypeScript 的“类型谓词”。
//
// 当这个函数返回 true 后，
// TypeScript 会自动把 value 的类型
// 从 unknown 缩小为 Record<string, unknown>。
export function isRecord(value: unknown): value is Record<string, unknown> {

    return (
        // 必须是 object
        typeof value === 'object'

        // 排除 null。
        //
        // 因为 JavaScript 中：
        // typeof null === 'object'
        && value !== null

        // 排除数组。
        //
        // 因为数组同样满足：
        // typeof [] === 'object'
        && !Array.isArray(value)
    );
}


// 将 unknown 类型的异常统一转换成字符串错误信息。
export function errorMessage(error: unknown): string {

    // 在 TypeScript 中，
    // catch 到的 error 不一定是 Error 对象，
    //
    // JavaScript 允许：
    //
    // throw new Error("错误")
    //
    // 也允许：
    //
    // throw "错误"
    // throw 123
    //
    // 因此这里先判断：
    // error 是否属于 Error 实例。
    //
    // 如果是：
    // 返回 error.message。
    //
    // 如果不是：
    // 返回统一的兜底文本。
    return error instanceof Error
        ? error.message
        : '未知错误';
}

