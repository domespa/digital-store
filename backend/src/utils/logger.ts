type LoggableValue = string | number | boolean | null | undefined | object;

interface Logger {
  info: (message: string, ...args: LoggableValue[]) => void;
  error: (message: string, ...args: LoggableValue[]) => void;
  warn: (message: string, ...args: LoggableValue[]) => void;
  debug: (message: string, ...args: LoggableValue[]) => void;
}

class SimpleLogger implements Logger {
  private formatMessage(
    level: string,
    message: string,
    ...args: LoggableValue[]
  ): string {
    const timestamp = new Date().toISOString();
    const formattedArgs =
      args.length > 0
        ? " " +
          args
            .map((arg) =>
              typeof arg === "object" && arg !== null
                ? JSON.stringify(arg)
                : String(arg)
            )
            .join(" ")
        : "";

    return `[${timestamp}] ${level.toUpperCase()}: ${message}${formattedArgs}`;
  }

  info(message: string, ...args: LoggableValue[]): void {
    console.log(this.formatMessage("info", message, ...args));
  }

  error(message: string, ...args: LoggableValue[]): void {
    console.error(this.formatMessage("error", message, ...args));
  }

  warn(message: string, ...args: LoggableValue[]): void {
    console.warn(this.formatMessage("warn", message, ...args));
  }

  debug(message: string, ...args: LoggableValue[]): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(this.formatMessage("debug", message, ...args));
    }
  }
}

export const logger = new SimpleLogger();
