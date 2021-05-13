import { Injectable, NestMiddleware, Scope } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { InjectLogger, LoggerService } from "../logger";
import { BullDashboardService } from "./bull-dashboard.service";

@Injectable()
export class BullDashboardMiddleware implements NestMiddleware {
    constructor(
        @InjectLogger(BullDashboardMiddleware)
        private readonly logger: LoggerService,
        private readonly bullDashboard: BullDashboardService) {
            this.logger.debug('Creating middleware')
        }

    async use(req: Request, res: Response, next: NextFunction): Promise<void> {
        this.bullDashboard.middleware(req, res, next)
    }
}