import { Context, Inject } from "cordis";
import { isRecord, type ToolDefinition } from "../types";

const calculator: ToolDefinition = {
    schema: {
        type: "function",
        function: {
            name: 'calculate', description: "对两个有限数字做一次加减乘除运算。",
            parameters: {
                type: 'object',
                properties: {
                    a: { type: "number" }, b: { type: "number" },
                    operation: {
                        type: 'string', enum: ['add', 'subtract', 'multiply', 'divide']
                    }
                },
                required: ['a', 'b', 'operation'], additionalProperties: false,
            },
        },
    },

    execute(args) {
        if (!isRecord(args) || typeof args.a !== 'number' || typeof args.b != 'number' || !Number.isFinite(args.a)
            || !Number.isFinite(args.b)) {
            throw new Error('a和b必须是有限数字。');
        }
        if (Object.keys(args).some(key => !['a', 'b', 'operation'].includes(key))) {
            throw new Error('算数工具收到未声明的参数。');
        }
        const { a, b, operation } = args;
        let value: number;
        switch (operation) {
            case 'add': value = a + b; break;
            case 'subtract': value = a - b; break;
            case 'multiply': value = a * b; break;
            case 'divide':
                if (b === 0) throw new Error('除数不能为零');
                value = a / b; break;
            default: throw new Error('operation 必须是 add、subtract、multiply或divide。')
        }
        if (!Number.isFinite(value)) throw new Error('计算结果超出有限数字范围。');
        return value;
    },
};

export const arithmeticPlugin = {
    name: 'arithmetic',
    inject: ["tools"],
    apply(ctx: Context) {
        ctx.effect(() => ctx.tools.register(calculator));
    },
};

