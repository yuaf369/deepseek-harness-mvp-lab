import type { Context } from "cordis";

export const auditPlugin = {
    name: 'audit',
    apply(ctx: Context, write: (line: string) => void) {
        ctx.on('tool/executed', ({ name, result }) => {
            write(`[工具] ${name} -> ${JSON.stringify(result)}`)
        })
    }
}