# cordis-mvp

基于 [Cordis](https://www.npmjs.com/package/cordis) 的插件化命令行 Agent 教学 MVP。

一个用 TypeScript 实现的极简命令行 AI 助手：以 Cordis 插件系统为核心，演示如何用「插件 / Service / 事件」组织一个支持工具调用（Tool Calling）的 Agent 应用。离线 `mock` 模式无需任何 API Key 即可运行，适合学习和二次开发。

## 功能特性

- **插件化架构**：应用由多个 Cordis 插件组装而成，插件可独立注册、卸载和热插拔；
- **工具调用闭环**：Agent 遵循「模型推理 → 工具调用 → 工具结果 → 再推理」的完整循环，直到返回最终回答；
- **离线演示模式**：内置 `mock` 模型，不依赖网络和密钥即可体验完整流程，并自动演示插件的动态启停；
- **真实模型接入**：配置 DeepSeek API 后即切换为真实对话与计算能力；
- **动态插件管理**：CLI 中可通过 `/disable`、`/enable` 实时卸载和恢复算术插件，工具集合随之变化；
- **事件广播**：工具执行结果通过 `tool/executed` 事件对外广播，可扩展日志、监控、追踪能力；
- **基础防护**：内置简单 Prompt Injection 防御、请求超时、最大步数限制、输入长度校验、上下文按轮裁剪；
- **完整测试**：基于 `node:test` 的单元与集成测试，覆盖 Agent 闭环、插件启停、工具错误处理、历史管理等场景。

## 运行环境

- Node.js **>= 22.19.0**（项目为 ESM 模块）
- 可选：Conda（`environment.yml` 已声明 `nodejs=22`，可用 `conda env create -f environment.yml` 建环境）

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 离线演示（无需任何配置，自动运行预置问题并演示插件启停）
npm run demo

# 3. 交互式对话（默认使用 mock 离线模型）
npm run dev

# 4. 单次提问
npm run dev -- --ask "计算 12 * 8"

# 5. 查看帮助
npm run dev -- --help
```

> 交互模式下的内置命令：`/tools` 查看当前工具，`/disable` 卸载算术插件，`/enable` 恢复算术插件，`/reset` 清空会话，`/help` 查看帮助，`/quit` 退出。

### 接入真实模型（DeepSeek）

复制 `.env.example` 为 `.env`，设置提供方为 `deepseek` 并填入密钥：

```bash
cp .env.example .env
```

```ini
# .env
MODEL_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxxxxxxx
```

然后运行 `npm run dev`，即可使用真实 DeepSeek 模型进行对话和计算。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MODEL_PROVIDER` | `mock` | `mock`（离线规则演示）或 `deepseek`（真实模型） |
| `DEEPSEEK_API_KEY` | 空 | DeepSeek API Key，`deepseek` 模式必填 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | API 基础地址，须为无账号、查询参数或片段的 http(s) 地址 |
| `DEEPSEEK_MODEL` | `deepseek-flash` | 使用的模型名称 |
| `REQUEST_TIMEOUT_MS` | `30000` | 单次 API 请求超时时间（毫秒，1~300000） |
| `MAX_STEPS` | `6` | Agent 单轮允许的最大模型调用步数，防止工具循环（1~20） |

## CLI 命令

| 命令 | 作用 |
| --- | --- |
| `npm run demo` | 离线演示：自动执行预置问题，演示算术插件的卸载与恢复 |
| `npm run dev` | 交互式对话 |
| `npm run dev -- --ask "<问题>"` | 单次提问后退出，适合脚本调用 |
| `npm run dev -- --help` | 查看帮助 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test` | 运行测试（`node:test`） |
| `npm run build` / `npm run start` | 编译到 `dist/` 后运行 |

交互模式内置命令：`/tools`、`/disable`、`/enable`、`/reset`、`/help`、`/quit`。

## 项目结构

```
cordis_mvp
├── src
│   ├── cli.ts              # CLI 入口：demo / 单次提问 / 交互模式，信号处理与资源清理
│   ├── app.ts              # createApp()：组装 Cordis 上下文与全部插件/服务
│   ├── config.ts           # 读取并校验环境变量配置
│   ├── types.ts            # 核心类型：Message、ToolCall、ToolSchema、ToolResult 等
│   └── plugins
│       ├── agent.ts        # AgentService：对话主循环、历史管理、工具调用编排
│       ├── model.ts        # ModelService：mock 离线模型 / DeepSeek API
│       ├── tools.ts        # ToolsService：工具注册、查询、执行、事件广播
│       ├── arithmetic.ts   # arithmetic 插件：calculate 工具（加减乘除）
│       ├── clock.ts        # clock 插件：current_time 工具
│       └── audit.ts        # audit 插件：监听 tool/executed 事件并打印工具调用
├── examples               # 教学示例：Context/插件生命周期、工具系统、Agent 闭环
│   ├── 01-context.ts
│   ├── 02-tools.ts
│   └── 03-agent.ts
├── tests                  # node:test 测试
│   ├── app.test.ts
│   ├── cli.test.ts
│   └── model.test.ts
├── .env.example           # 环境变量示例
├── environment.yml        # Conda 环境（nodejs=22）
├── package.json
└── tsconfig.json
```

## 插件机制（教学重点）

本项目展示 Cordis 的核心设计思想：

- **插件 = 可撤销的副作用**：插件通过 `ctx.effect()` 注册副作用（如注册工具），插件被 `dispose()` 时对应清理函数自动执行，工具随之撤销；
- **Service 依赖注入**：`AgentService` 声明 `inject = ["tools", "model"]`，Cordis 会确保依赖服务就绪后再初始化；
- **事件解耦**：`ToolsService` 执行工具后广播 `tool/executed` 事件，`audit` 插件通过监听事件实现日志，互不耦合；
- **热插拔**：`createApp()` 返回的 `setArithmetic()` 可在运行期动态启停算术插件，Agent 可见的工具集合实时变化。

一个典型 Agent 回答的完整链路：

```
用户问题
  ↓
model.complete()（带当前工具 Schema）
  ↓
是否需要调用工具？
  ├─ 否 → 返回最终回答
  └─ 是
      ↓
    tools.execute()（解析 JSON 参数并执行）
      ↓
    广播 tool/executed 事件（audit 插件记录日志）
      ↓
    工具结果作为 tool 消息回填
      ↓
    再次调用 model.complete()（受 maxSteps 限制）
```

## 测试

```bash
npm run test
```

测试覆盖：离线 Agent 通过真实工具完成计算、插件卸载撤销工具且重复启停不重复注册、工具对除零/非法参数/非 JSON/未知工具的错误处理、失败轮次回滚历史、历史按完整轮次保留最近十轮、配置校验、mock 不截取复合算式等。

## 示例代码

`examples/` 目录提供三个循序渐进的教学示例，配合源码注释阅读：

- `01-context.ts`：Cordis Context 与插件生命周期（effect / cleanup / dispose）；
- `02-tools.ts`：ToolsService 注册、执行工具与插件卸载后的自动清理；
- `03-agent.ts`：用 `createApp()` 跑通 Agent 闭环，并验证插件启停。
