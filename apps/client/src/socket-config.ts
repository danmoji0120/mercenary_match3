export interface SocketUrlEnvironment {
  explicitUrl?: string;
  isDevelopment: boolean;
}

export function resolveSocketUrl(environment: SocketUrlEnvironment): string | undefined {
  const explicit = environment.explicitUrl?.trim();
  if (explicit) return explicit;
  return environment.isDevelopment ? 'http://localhost:3001' : undefined;
}
