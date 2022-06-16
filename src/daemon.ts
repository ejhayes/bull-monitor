import { extname, join } from 'path';
import { ConfigService } from '@app/config';
import { LoggerService } from '@app/logger';
import { Monitor } from 'forever-monitor';

const PROCESS_NAME = 'bull-monitor';

class Daemon {
  /**
   * Default entrypoint
   */
  private static readonly ENTRYPOINT = join(__dirname, 'main');
  /**
   * Running with ts-node causes issues
   * - SyntaxError: Cannot use import statement outside a module
   * - Error: Target script does not exist
   *
   * Below we are either running the '${RUN_SCRIPT}.js' file
   * or ts-node ${RUN_SCRIPT}.ts
   */
  private static readonly ENTRYPOINT_COMMAND =
    extname(__filename) === '.ts'
      ? ['nest', `start`]
      : `${Daemon.ENTRYPOINT}.js`;

  private static log = new LoggerService();
  private static config = new ConfigService();

  static start() {
    Daemon.log.setContext(Daemon.name);

    const child = new Monitor(Daemon.ENTRYPOINT_COMMAND, {
      killTree: true,
      minUptime: 2000,
      spinSleepTime: Daemon.config.config.RESTART_DELAY_MS,
    });

    child.on('exit', () => {
      Daemon.log.log(`Terminating ${PROCESS_NAME} process`);
    });

    child.on('restart', () => {
      Daemon.log.warn(`Restarting ${PROCESS_NAME} process`);
    });

    child.on('exit:code', (code) => {
      Daemon.log.error(
        `${PROCESS_NAME} process terminated with exit code: ${code}`,
      );
    });

    child.on('start', () => {
      Daemon.log.log(`Starting ${PROCESS_NAME} process`);
    });

    child.start();
  }
}

Daemon.start();
