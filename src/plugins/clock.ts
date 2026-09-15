import type { Context } from "cordis";
import { isRecord } from "../types";

export const clockPlugin = {
    name: 'clock',
    inject: ['tools'],
    apply(ctx: Context){
        ctx.effect(() => ctx.tools.register({
            schema:{
                type: 'function',
                function:{
                    name: 'current_time', description:"获取当前UTC时间，返回ISO 8601字符串",
                    parameters:{type: 'object', properties:{}, additionalProperties:false},
                },
            },
            execute(args){
                if (!isRecord(args) || Object.keys(args).length) 
                    throw new Error("时间工具参数必须是空对象。");
                return new Date().toISOString();
            },
        }));
    },
};