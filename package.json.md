{
  // 项目名称。
  // 一般会作为 npm 包名使用。
  "name": "cordis-mvp",

  // 当前项目版本号。
  // 遵循语义化版本规范：主版本.次版本.修订版本。
  "version": "0.1.0",

  // 表示这是一个私有项目。
  // 设置为 true 后，可以防止误操作将项目发布到 npm。
  "private": true,

  // 指定 Node.js 模块系统为 ES Module（ESM）。
  // 因此项目中可以使用：
  // import xxx from "xxx"
  // export ...
  //
  // 而不是传统 CommonJS：
  // const xxx = require("xxx")
  "type": "module",

  // 项目描述。
  "description": "基于 Cordis 的插件化命令行 Agent 教学 MVP",

  // 声明项目要求的 Node.js 版本。
  "engines": {
    // 要求 Node.js 版本至少为 22.19.0。
    "node": ">=22.19.0"
  },

  // 定义 npm 命令。
  //
  // 使用方式：
  // npm run dev
  // npm run demo
  // npm test
  // npm run build
  // npm start
  "scripts": {

    // 开发模式运行。
    // 使用 tsx 直接执行 TypeScript 源码，
    // 不需要提前通过 tsc 编译成 JavaScript。
    "dev": "tsx src/cli.ts",

    // Demo 模式运行。
    // 本质上仍然执行 src/cli.ts，
    // 但额外传入 --demo 命令行参数。
    //
    // 在 cli.ts 中可以通过 process.argv 判断是否开启 demo 模式。
    "demo": "tsx src/cli.ts --demo",

    // 执行测试。
    //
    // tsx --test：
    // 使用 Node.js 内置 test runner，
    // 同时通过 tsx 支持直接运行 TypeScript 测试文件。
    //
    // tests/*.test.ts：
    // 匹配 tests 目录下所有 .test.ts 文件。
    "test": "tsx --test tests/*.test.ts",

    // TypeScript 类型检查。
    //
    // --noEmit 表示：
    // 只检查类型错误，不生成 JavaScript 文件。
    //
    // 常用于开发过程中快速检查代码是否合法。
    "typecheck": "tsc --noEmit",

    // 正式构建项目。
    //
    // -p tsconfig.build.json：
    // 指定使用 tsconfig.build.json 作为构建配置。
    //
    // 一般会把 src 中的 TypeScript
    // 编译到 dist 目录。
    "build": "tsc -p tsconfig.build.json",

    // 运行已经编译完成的生产代码。
    //
    // 前提通常是先执行：
    // npm run build
    //
    // 然后运行：
    // node dist/cli.js
    "start": "node dist/cli.js"
  },

  // 项目运行时依赖。
  //
  // 这些依赖不仅开发阶段需要，
  // 项目真正运行时也需要安装。
  "dependencies": {

    // Cordis 核心框架。
    //
    // 当前固定使用：
    // 4.0.0-rc.10
    //
    // rc 表示 Release Candidate（候选发布版本）。
    "cordis": "4.0.0-rc.10"
  },

  // 开发阶段依赖。
  //
  // 通常包括：
  // TypeScript 编译器、
  // 类型声明、
  // 测试工具、
  // 开发运行工具等。
  //
  // 项目正式运行时通常不直接依赖这些包。
  "devDependencies": {

    // Node.js API 的 TypeScript 类型声明。
    //
    // 例如：
    // process
    // Buffer
    // node:fs
    // node:path
    // node:crypto
    //
    // 都需要这个包提供类型信息。
    "@types/node": "22.20.2",

    // TypeScript / ESM 运行工具。
    //
    // 可以直接执行：
    // tsx src/cli.ts
    //
    // 从而省去：
    // TypeScript -> JavaScript -> node
    // 的手动编译步骤。
    "tsx": "4.23.13",

    // TypeScript 编译器。
    //
    // 提供 tsc 命令，
    // 用于类型检查以及将 .ts 编译为 .js。
    "typescript": "5.9.3"
  }
}