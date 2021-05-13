import { Environments, LOGGER_MODULE_OPTIONS } from './common';
import {
  Inject,
  Injectable,
  Logger as NestLogger,
  Scope,
} from '@nestjs/common';
import { LoggerMeta, LoggerModuleOptions } from './interfaces';
import {
  Logger as WinstonLogger,
  createLogger,
  format,
  transports,
} from 'winston';
import { yellow } from 'chalk';

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService extends NestLogger {
  private static loggerLastTimestamp: number;
  private readonly env: string;
  private readonly logLabel: string;
  private readonly logLevel: string;
  private readonly logger: WinstonLogger;
  private readonly pid: number;

  constructor(
    @Inject(LOGGER_MODULE_OPTIONS)
    private readonly options: LoggerModuleOptions = {},
  ) {
    super();
    this.env = this.options.env || process.env.NODE_ENV;
    this.logLabel = this.options.label || process.env.LOG_LABEL;
    this.logLevel = this.options.level || process.env.LOG_LEVEL;
    this.pid = process.pid;

    this.logger = this.createLogger();
  }

  private static getAndUpdateTimestampDiff(): string {
    const result: string = LoggerService.loggerLastTimestamp
      ? `+${Date.now() - LoggerService.loggerLastTimestamp}ms`
      : '';
    LoggerService.loggerLastTimestamp = Date.now();
    return result;
  }

  public debug(message: string, context?: string): void {
    this.logger.debug(message, this.getMeta(context));
  }

  public error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, this.getMeta(context));
  }

  public log(message: string, context?: string): void {
    this.logger.info(message, this.getMeta(context));
  }

  public verbose(message: string, context?: string): void {
    this.logger.verbose(message, this.getMeta(context));
  }

  public warn(message: string, context?: string): void {
    this.logger.warn(message, this.getMeta(context));
  }

  private createDevLogger(): WinstonLogger {
    const { combine, colorize, timestamp, label, printf } = format;
    const myFormat = printf((info) => {
      return `${info.level} ${info.label} ${this.pid} - ${
        info.timestamp
      } ${yellow(`[${info.context}]`)} ${info.message} ${yellow(
        info.timestampDiff,
      )}`;
    });

    return createLogger({
      format: combine(
        colorize({ all: true }),
        label({ label: this.logLabel }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        myFormat,
      ),
      level: this.logLevel,
      transports: [new transports.Console()],
    });
  }

  private createLogger(): WinstonLogger {
    return this.env === Environments.PRODUCTION
      ? this.createProdLogger()
      : this.createDevLogger();
  }

  private createProdLogger(): WinstonLogger {
    return createLogger({
      exitOnError: false,
      format: format.combine(
        format.label({
          label: this.logLabel,
        }),
        format.timestamp({
          alias: '@timestamp',
          format: 'YYYY-MM-DDTHH:mm:ss',
        }),
        format((info) => {
          // remove duplicate timestamp property
          if (info.timestamp) {
            delete info.timestamp;
          }

          // level is a reserved keyword in production - change this
          // to log.level instead
          delete info.level;
          info.log = { level: this.logLevel };

          return info;
        })(),
        format.json(),
      ),
      level: this.logLevel,
      transports: [
        new transports.Console({
          stderrLevels: ['error', 'warn'],
        }),
      ],
    });
  }

  private getMeta(context: string, trace?: string): LoggerMeta {
    return {
      context: context || this.context,
      timestampDiff: LoggerService.getAndUpdateTimestampDiff(),
      trace,
    };
  }
}
