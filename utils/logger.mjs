const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 4,
  debug: 5,
};

export default class Logger {
  levels = LEVELS;
  _level = LEVELS.info;
  
  get level() {
    return this._level;
  }

  set level(value) {
    if (typeof value === "string") {
      this._level = this.levels[value];
    } else {
      this._level = value;
    }
  }

  constructor (level = "error") {
    this.level = level;
  }
  
  error(...args) {
    if (this.useLevel(this.levels.error)) {
      console.error(...args);
    }
  }

  warn(...args) {
    if (this.useLevel(this.levels.warn)) {
      console.warn(...args);
    }
  }

  info(...args) {
    if (this.useLevel(this.levels.info)) {
      console.log(...args);
    }
  }

  verbose(...args) {
    if (this.useLevel(this.levels.verbose)) {
      console.debug(...args);
    }
  }

  debug(...args) {
    if (this.useLevel(this.levels.debug)) {
      console.debug(...args);
    }
  }

  validateLevel(levelString) {
    return !!this.levels[levelString];
  }

  levelToInt(levelString) {
    if (typeof levelString === "string") {
      return this.levels[levelString];
    } else {
      return levelString;
    }
  }

  intToLeve(levelInt) {
    throw new Error("Not implemented");
  }

  useLevel(level) {
    return this.level >= this.levelToInt(level);
  }

}

