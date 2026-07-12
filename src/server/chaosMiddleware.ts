import { Request, Response, NextFunction } from 'express';

export function createChaosMiddleware(getConfig: () => { latencyMs: number; errorRate: number }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { latencyMs, errorRate } = getConfig();

    const run = () => {
      if (Math.random() * 100 < errorRate) {
        res.status(500).json({ error: 'Simulated chaos failure' });
        return;
      }

      next();
    };

    if (latencyMs <= 0) {
      run();
      return;
    }

    setTimeout(run, latencyMs);
  };
}
