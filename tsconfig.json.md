```jsonc
{
    // TypeScript 编译器相关配置
    "compilerOptions": {

        // 指定 TypeScript 编译后生成的 JavaScript 版本。
        //
        // es2022 表示：
        // TypeScript 会按照 ECMAScript 2022 的语法标准生成代码。
        //
        // 因为你的项目要求 Node.js >= 22，
        // 所以使用 es2022 完全没问题。
        "target": "es2022",

        // 指定生成代码使用的模块系统。
        //
        // esnext 表示：
        // 保留最新的 ES Module 语法，也就是：
        //
        // import xxx from "xxx"
        // export ...
        //
        // TypeScript 不会把它转换成 CommonJS 的 require/module.exports。
        //
        // 这与 package.json 中：
        //
        // "type": "module"
        //
        // 是匹配的。
        "module": "esnext",

        // 指定 TypeScript 如何解析 import 的模块路径。
        //
        // Bundler 模式更接近现代前端构建工具，
        // 例如 Vite、esbuild、Rollup 的模块解析行为。
        //
        // 它允许类似：
        //
        // import { ToolsService } from "./plugins/tools"
        //
        // 这样的写法，而不会强制要求写：
        //
        // import { ToolsService } from "./plugins/tools.js"
        //
        // 注意：
        // TypeScript 能通过类型检查，
        // 并不意味着 Node.js 原生 ESM 运行时也一定能找到这个模块。
        //
        // 这正是 Node.js ESM 项目中比较容易踩坑的地方。
        "moduleResolution": "Bundler",

        // 开启 TypeScript 严格模式。
        //
        // strict 开启后，会同时启用一系列严格检查，
        // 例如：
        //
        // strictNullChecks
        // noImplicitAny
        // strictFunctionTypes
        // strictPropertyInitialization
        //
        // 可以提前发现很多潜在的类型问题。
        "strict": true,

        // 提高 CommonJS 模块和 ES Module 之间的兼容性。
        //
        // 例如某些 CommonJS 库：
        //
        // module.exports = xxx
        //
        // 开启后，可以更自然地写：
        //
        // import xxx from "xxx"
        //
        // 而不需要使用：
        //
        // import * as xxx from "xxx"
        "esModuleInterop": true,

        // 跳过第三方 .d.ts 类型声明文件的完整类型检查。
        //
        // 比如 node_modules 中某个库自己的类型定义存在问题，
        // 不会因此阻塞你自己的项目编译。
        //
        // 好处：
        // 1. 加快类型检查速度
        // 2. 减少第三方类型声明导致的无关报错
        //
        // 一般项目都会开启。
        "skipLibCheck": true,

        // 指定编译后的 JavaScript 文件输出目录。
        //
        // 例如：
        //
        // src/cli.ts
        //
        // 编译后可能生成：
        //
        // dist/src/cli.js
        //
        // 具体目录结构还会受到 rootDir 的影响。
        "outDir": "dist",

        // 指定 TypeScript 源代码的根目录。
        //
        // "." 表示：
        // 整个项目根目录都是源文件根目录。
        //
        // 因为下面 include 中同时包含：
        //
        // src/
        // tests/
        // examples/
        //
        // 所以这里使用 "." 可以让它们都处于 rootDir 内。
        "rootDir": ".",

        // 指定默认加载哪些类型声明包。
        //
        // "node" 对应：
        //
        // @types/node
        //
        // 因此 TypeScript 能识别 Node.js 提供的 API，
        // 例如：
        //
        // process
        // Buffer
        // console
        // node:fs
        // node:path
        // node:crypto
        //
        // 等。
        "types": [
            "node"
        ]
    },

    // 指定哪些 TypeScript 文件应该被当前 tsconfig 管理。
    "include": [

        // 包含 src 目录及其所有子目录中的 .ts 文件。
        //
        // 例如：
        // src/cli.ts
        // src/plugins/tools.ts
        // src/plugins/model.ts
        "src/**/*.ts",

        // 包含 tests 目录中的所有 TypeScript 测试文件。
        //
        // 例如：
        // tests/tools.test.ts
        "tests/**/*.ts",

        // 包含 examples 目录中的所有 TypeScript 示例代码。
        //
        // 例如：
        // examples/basic.ts
        "examples/**/*.ts"
    ]
}
```
