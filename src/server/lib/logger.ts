import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
  base: { service: 'lineage' },
}).child({});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
