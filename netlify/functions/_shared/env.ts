export function getEnv(name: string) {
  const netlifyGlobal = globalThis as typeof globalThis & {
    Netlify?: {
      env?: {
        get(name: string): string | undefined;
      };
    };
  };

  return netlifyGlobal.Netlify?.env?.get(name) ?? process.env[name];
}

export function requireEnv(name: string, publicHint = false) {
  const value = getEnv(name);
  if (!value) {
    const prefix = publicHint ? "Client/server" : "Server";
    throw new Error(`${prefix} environment variable ${name} is not configured.`);
  }
  return value;
}
