const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...data
    };
    return JSON.stringify(logData);
  }

  writeLog(level, message, data = {}) {
    const logMessage = this.formatMessage(level, message, data);
    
    if (process.env.NODE_ENV === 'production') {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](logMessage);
    } else {
      const dateStr = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `${dateStr}.log`);
      fs.appendFileSync(logFile, logMessage + '\n');
      
      if (level === 'error') {
        console.error(logMessage);
      } else {
        console.log(logMessage);
      }
    }
  }

  info(message, data = {}) {
    this.writeLog('info', message, data);
  }

  warn(message, data = {}) {
    this.writeLog('warn', message, data);
  }

  error(message, data = {}) {
    this.writeLog('error', message, data);
  }

  security(message, data = {}) {
    this.writeLog('security', message, data);
  }

  activity(message, data = {}) {
    this.writeLog('activity', message, data);
  }
}

const logger = new Logger();

module.exports = logger;
