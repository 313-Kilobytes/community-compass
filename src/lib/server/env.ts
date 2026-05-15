type EnvMap = Record<string, string | undefined>;

const processEnv: EnvMap = typeof process !== "undefined" ? process.env : {};
const viteEnv: EnvMap = import.meta.env as EnvMap;

export function getServerEnv(...names: string[]) {
  for (const name of names) {
    const value = processEnv[name] ?? viteEnv[name];
    const cleaned = value?.trim().replace(/^["']|["']$/g, "");
    if (cleaned) return cleaned;
  }

  return undefined;
}
