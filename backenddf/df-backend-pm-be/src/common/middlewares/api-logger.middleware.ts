import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ApiLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const path = req.originalUrl.split('?')[0];
    const started = Date.now();
    res.once('finish', () => {
      Logger.log(
        `API: ${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms`,
      );
    });
    next();
  }
}
