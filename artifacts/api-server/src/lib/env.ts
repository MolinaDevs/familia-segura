// Carregado antes de tudo: sem telemetria de SDK de terceiros (dados mínimos, LGPD).
process.env.CLERK_TELEMETRY_DISABLED ??= "1";
export {};
