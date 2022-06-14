import { LOG_LEVELS } from '../common';

export interface LoggerModuleOptions {
  /**
   * Logging environment to use (defaults to NODE_ENV).
   * If set to production this will enable elastic
   * friendly logging format.
   */
  env?: string;
  /**
   * Disable logging (only works if env is 'test')
   */
  silent?: boolean;
  /**
   * Use this label when logging.
   */
  label?: string;
  /**
   * Highest logging level to display (e.g. `info` will not
   * display any `debug` messages).
   */
  level?: LOG_LEVELS;
}
