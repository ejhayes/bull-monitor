import { Injectable, NestMiddleware, Scope } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { InjectLogger, LoggerService } from "@app/logger";
import { BullUiService } from "./bull-ui.service";

@Injectable()
export class BullDashboardMiddleware implements NestMiddleware {
    constructor(
        @InjectLogger(BullDashboardMiddleware)
        private readonly logger: LoggerService,
        private readonly bullUi: BullUiService) {
            this.logger.debug('Creating middleware')
        }

    async use(req: Request, res: Response, next: NextFunction): Promise<void> {
        this.bullUi.middleware(req, res, next);
    }
}