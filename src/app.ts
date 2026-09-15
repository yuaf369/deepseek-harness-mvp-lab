import { Context, type Fiber } from "cordis";
import type { AppConfig } from "./types";
import { ToolsService } from "./plugins/tools";
import { ModelService } from "./plugins/model";
import { AgentService } from "./plugins/agent";
import { arithmeticPlugin } from "./plugins/arithmetic";
import { clockPlugin } from "./plugins/clock";
import { auditPlugin } from "./plugins/audit";

export async function createApp(config:AppConfig, write?:(line:string) => void) {
    const ctx = new Context();
    try{
        const agent = ctx.plugin(AgentService, config);
        await ctx.plugin(ToolsService);
        await ctx.plugin(ModelService, config);
        let arithmetic: Fiber | undefined = await ctx.plugin(arithmeticPlugin);
        await ctx.plugin(clockPlugin);
        if (write) await ctx.plugin(auditPlugin, write);
        await agent;
        return{
            ctx,
            async setArithmetic(enabled:boolean){
                if (enabled && !arithmetic) arithmetic = await ctx.plugin(arithmeticPlugin);
                if (!enabled && arithmetic) {await arithmetic.dispose(); arithmetic = undefined;}
            },
            async dispose() { await ctx.fiber.dispose();},
        };
    }catch(error){
        await ctx.fiber.dispose();
        throw error;
    }
}