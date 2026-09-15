import { AppConfig } from "./types";

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
    const provider = env.MODEL_PROVIDER?.trim() || 'mock';
    if (provider !== 'mock' && provider !== 'deepseek') {
        throw new Error('MODEL_PROVIDER只能是mock或deepseek。');
    }
    const apiKey = env.DEEPSEEK_API_KEY?.trim() || '';
    if (provider === 'deepseek' && !apiKey) throw new Error('请在 .env中设置DEEPSEEK_API_KEY。');
    const baseUrl = (env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com").replace(/\/+$/,'');
    const url = new URL(baseUrl)
    if (!["https:", "http"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error("DEEPSEEK_BASE_URL 必须是无账号、查询参数或片段的http(s)地址。");
    }
    const positive = (key:string, fallback:number, max:number) => {
        const value = Number(env[key] || fallback);
        if (!Number.isSafeInteger(value) || value < 1 || value > max) {
            throw new Error('${key} 必须是1到${max}之间的整数。');
        }
        return value;
    }
    return {
        provider, apiKey, baseUrl,
        model: env.DEEPSEEK_MODEL?.trim() || 'deepseek-flash',
        timeoutMs: positive('REQUEST_TIMEOUT_MS', 30_000, 300_000),
        maxSteps: positive("MAX_STEPS", 6, 20),
    };
}