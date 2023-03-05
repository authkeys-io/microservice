// Copyright 2016 Fuzzy.ai
// Copyright 2019 Authkeys.io
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const http = require('http');
const https = require('https');
const os = require('os');
const fs = require('fs');
const assert = require('assert');
const debug = require('debug')('microservice');
const express = require('express');
const bodyParser = require('body-parser');

const Logger = require('bunyan');
const uuid = require('uuid');
const fetch = require('node-fetch');

const prometheusMiddleware = require('express-prometheus-middleware');

const HTTPError = require('./httperror');

const ONE_DAY = 24 * 60 * 60 * 1000;

const isString = function(str) {
  return typeof str === 'string';
};
const isFunction = function(func) {
  return typeof func === 'function';
};
const has = function(obj, key) {
  return obj && obj[key];
};

class Microservice {
  constructor(environment) {
    // Default to process.env

    this.reportTiming = this.reportTiming.bind(this);
    this.requestTimer = this.requestTimer.bind(this);
    if (environment == null) {
      environment = process.env;
    }

    this.config = this.environmentToConfig(environment);
    this.log = this.setupLogger();
    this.express = this.setupExpress();
    this.srv = null;
  }

  resetTiming() {
    // Timing of requests

    this.timing = {
      max: -Infinity,
      min: Infinity,
      avg: NaN,
      count: 0
    };

    return this.timing;
  }

  async start() {
    this.resetTiming();
    await this.preStartNetwork();
    await this.startNetwork();
    await this.startTimers();
    await this.startCustom();
  }

  async stop() {
    this.resetTiming();
    await this.stopCustom();
    await this.stopTimers();
    await this.stopNetwork();
    await this.postStopNetwork();
  }

  preStartNetwork() {
    // could be overridden
  }

  startNetwork() {
    return new Promise((resolve, reject) => {
      if (this.config.key) {
        const options = {
          key: this.config.key,
          cert: this.config.cert
        };
        this.srv = https.createServer(options, this.express);
      } else {
        this.srv = http.createServer(this.express);
      }

      const onError = function(err) {
        clearListeners();
        reject(err);
      };

      const onListening = () => resolve();

      const clearListeners = () => {
        this.srv.removeListener('error', onError);
        this.srv.removeListener('listening', onListening);
      };

      this.srv.on('error', onError);
      this.srv.on('listening', onListening);

      if (this.config.addresses) {
        for (const address of this.config.addresses) {
          this.srv.listen(this.config.port, address);
        }
      } else {
        const address = this.config.address || this.config.hostname;
        this.srv.listen(this.config.port, address);
      }
    });
  }

  stopNetwork() {
    if (this.srv == null) {
      debug('Skipping stopNetwork(); no server');
      return;
    }
    return new Promise((resolve, reject) => {
      const onError = err => {
        clearListeners();
        this.srv = null;
        reject(err);
      };

      const onClose = () => {
        clearListeners();
        this.srv = null;
        resolve();
      };

      const clearListeners = () => {
        this.srv.removeListener('error', onError);
        this.srv.removeListener('close', onClose);
      };

      this.srv.on('error', onError);
      this.srv.on('close', onClose);

      this.srv.close();
    });
    // If there's no server, no need to do this
  }

  postStopNetwork() {
    // Could be overridden
  }

  startTimers() {
    return new Promise((resolve, reject) => {
      // XXX: If there are other timers add them here
      this.startTimingTimer();
      resolve();
    });
  }

  stopTimers(callback) {
    return new Promise((resolve, reject) => {
      // XXX: If there are other timers add them here
      this.stopTimingTimer();
      resolve();
    });
  }

  startTimingTimer() {
    this.timingTimer = setInterval(this.reportTiming, this.config.timingInterval);
    return this.timingTimer;
  }

  stopTimingTimer() {
    clearInterval(this.timingTimer);
  }

  reportTiming() {
    let message;
    if (this.timing.count === 0) {
      message = 'No requests during this period';
    } else {
      message =
        `count: ${this.timing.count}, average: ${this.timing.avg}, ` +
        `stddev: ${this.timing.stddev}, min: ${this.timing.min}, max: ${this.timing.max}`;
    }
    this.resetTiming();
    this.slackMessage('timing', message, err => {
      if (err) {
        this.express.log.error({ err }, 'Error posting to Slack');
      }
    });
  }

  getName() {
    return process.env.npm_package_name || '<unknown microservice>';
  }

  getVersion() {
    return process.env.npm_package_version || '<unknown version>';
  }

  setupLogger() {
    const logParams = {
      serializers: {
        req: Logger.stdSerializers.req,
        res: Logger.stdSerializers.res,
        err: Logger.stdSerializers.err
      },
      level: this.config.logLevel
    };

    if (this.config.logFile) {
      logParams.streams = [{ path: this.config.logFile }];
    } else {
      logParams.streams = [{ stream: process.stderr }];
    }

    logParams.name = this.getName();

    const log = new Logger(logParams);

    log.debug('Initializing');

    return log;
  }

  static aac(req, res, next) {
    const { appKeys } = req.app.config;
    const cls = this || Microservice;
    cls.bt(req, (err, tokenString) => {
      if (err) {
        setImmediate(next, err);
      } else if (appKeys[tokenString] != null) {
        req.appName = appKeys[tokenString];
        setImmediate(next);
      } else {
        const props = { tokenString, appKeys };
        req.log.warn(props, 'Unauthorized token string');
        setImmediate(next, new HTTPError('Unauthorized token string', 401));
      }
    });
  }

  appAuthc(req, res, next) {
    const cls = this ? this.constructor || Microservice : Microservice;
    cls.aac(req, res, next);
  }

  static bt(req, callback) {
    const { authorization } = req.headers;
    if (authorization) {
      const m = /^[Bb]earer\s+(\S+)$/.exec(authorization);
      if (m === null) {
        const msg = "Authorization header should be like 'Bearer <token>'";
        setImmediate(callback, new HTTPError(msg, 401));
      } else {
        const [, tokenString] = m;
        setImmediate(callback, null, tokenString);
      }
    } else if (req.query && req.query.access_token) {
      setImmediate(callback, null, req.query.access_token);
    } else {
      setImmediate(callback, new HTTPError('Authorization required', 401));
    }
  }

  bearerToken(req, callback) {
    const cls = this ? this.constructor || Microservice : Microservice;
    cls.bt(req, callback);
  }

  errorHandler(err, req, res, next) {
    if (err.name === 'NoSuchThingError') {
      res.statusCode = 404;
    } else {
      res.statusCode = err.statusCode || 500;
    }

    if (req.log && !(res.statusCode === 404 && req.dontLog)) {
      req.log.error({ err }, 'Error');
    }

    // Report server errors; these are something we have to fix

    if (res.statusCode >= 500 && res.statusCode < 600) {
      this.slackMessage('error', `${err.name}: ${err.message}`, ':bomb:', err => {
        if (err) {
          return this.express.log.error({ err }, 'Error posting to Slack');
        }
      });
    }

    // This is required for 401 responses

    if (res.statusCode === 401) {
      res.setHeader('WWW-Authenticate', 'Bearer');
    }

    res.setHeader('Content-Type', 'application/json');
    return res.json({ status: 'error', message: err.message, detail: err.detail });
  }

  slackMessage(type, message, icon, callback) {
    let hook;
    if (callback == null) {
      callback = icon;
      icon = ':speech_balloon:';
    }

    assert(isString(type));
    assert(isString(message));
    assert(isString(icon));
    assert(isFunction(callback));

    if (type != null && has(this.config.slackHooks, type)) {
      hook = this.config.slackHooks[type];
    } else {
      hook = this.config.slackHook;
    }

    if (hook == null) {
      setImmediate(callback, null);
      return;
    }

    const hostname = os.hostname();

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: `${this.getName()}@${hostname}: ${icon} ${message}`,
        username: this.getName(),
        icon_emoji: icon
      })
    };

    fetch(hook, options)
      .then(response => {
        if (response.status >= 400) {
          const error = new Error(response.statusText);
          error.http_code = response.status;
          error.http_response = response;
          return callback(error);
        }
        callback();
      })
      .catch(err => {
        callback(err);
      });
  }

  static dontLog(req, res, next) {
    req.dontLog = true;
    setImmediate(next);
  }

  requestLogger(req, res, next) {
    const remoteId = req.get('x-remote-id');
    req.id = remoteId || uuid.v1();
    const weblog = req.app.log.child({
      req_id: req.id,
      url: req.originalUrl,
      method: req.method,
      component: 'web'
    });
    const { end } = res;
    req.log = weblog;
    req.dontLog = false;
    res.end = function(chunk, encoding) {
      res.end = end;
      res.end(chunk, encoding);
      if (!req.dontLog) {
        const rec = { req, res };
        return weblog.info(rec);
      }
    };
    setImmediate(next);
  }

  requestTimer(req, res, next) {
    const startTime = Date.now();
    const { end } = res;
    res.end = (chunk, encoding) => {
      res.end = end;
      res.end(chunk, encoding);
      const endTime = Date.now();
      const duration = endTime - startTime;
      if (req.log && req.log.fields) {
        req.log.fields.ms = duration;
      }
      const { count, avg, stddev } = this.timing;
      this.timing.count += 1;
      if (this.timing.count === 1) {
        this.timing.max = duration;
        this.timing.min = duration;
        this.timing.avg = duration;
        this.timing.stddev = 0;
        return this.timing.stddev;
      } else {
        if (duration > this.timing.max) {
          this.timing.max = duration;
        }
        if (duration < this.timing.min) {
          this.timing.min = duration;
        }
        this.timing.avg = (count * avg + duration) / this.timing.count;
        // From http://math.stackexchange.com/questions/102978/incremental-computation-of-standard-deviation
        this.timing.stddev = Math.sqrt(
          ((count - 1) * Math.pow(stddev, 2) +
            count * Math.pow(avg - this.timing.avg, 2) +
            Math.pow(duration - this.timing.avg, 2)) /
            count
        );
        return this.timing.stddev;
      }
    };

    setImmediate(next);
  }

  setupExpress() {
    const app = express();
    app.log = this.log.child({ component: 'express' }, false);

    app.use(this.requestTimer);
    app.use(this.requestLogger);

    app.use(bodyParser.json({ limit: this.config.maxUploadSize }));

    app.config = this.config;
    app.config.name = this.getName();

    this.setupMiddleware(app);
    this.setupParams(app);
    if (this.config.metrics) {
      debug('Enabling metrics', this.config.metrics_options);
      app.use(prometheusMiddleware(this.config.metrics_options));
    }
    this.setupRoutes(app, express);

    app.use(this.noRouteMatch);

    // Error handler
    // Note: we go through some acrobatics to make sure the arity of the
    // function passed to use() is 4.

    app.use((err, req, res, next) => this.errorHandler(err, req, res, next));

    return app;
  }

  setupMiddleware(exp) {
    return undefined;
  }

  setupParams(exp) {
    return undefined;
  }

  setupRoutes(app, express) {
    console.error('setupRoutes MUST be overridden');
    return undefined;
  }

  startCustom() {
    // could be overridden
  }

  stopCustom() {
    // could be overridden
  }

  envInt(env, key, def) {
    if (env[key]) {
      return parseInt(env[key], 10);
    } else {
      return def;
    }
  }

  envJSON(env, key, def) {
    if (env[key]) {
      return JSON.parse(env[key]);
    } else {
      return def;
    }
  }

  envBool(env, key, def) {
    if (env[key] != null) {
      let needle, needle1;
      if ((needle = env[key].toLowerCase()) && ['true', 'yes', 'on', '1'].includes(needle)) {
        return true;
      } else if ((needle1 = env[key].toLowerCase()) && ['false', 'no', 'off', '0'].includes(needle1)) {
        return false;
      } else {
        throw new Error(`Not a boolean: ${env[key]}`);
      }
    } else {
      return def;
    }
  }

  environmentToConfig(environment) {
    const config = {
      port: this.envInt(environment, 'PORT', 8080),
      hostname: environment['HOSTNAME'],
      address: environment['ADDRESS'],
      addresses: environment['ADDRESSES'] ? environment['ADDRESSES'].split(',') : undefined,
      key: environment['KEY'],
      cert: environment['CERT'],
      logLevel: environment['LOG_LEVEL'] || 'info',
      logFile: environment['LOG_FILE'] || null,
      slackHook: environment['SLACK_HOOK'],
      metrics: this.envBool(environment, 'METRICS', false),
      params: this.envJSON(environment, 'PARAMS', {}),
      maxUploadSize: environment['MAX_UPLOAD_SIZE'] || '50mb',
      appKeys: {},
      slackHooks: {},
      timingInterval: this.envInt(environment, 'TIMING_INTERVAL', ONE_DAY),
      log404: this.envBool(environment, 'LOG_404', false)
    };
    for (const name in environment) {
      const value = environment[name];
      let match = name.match(/^APP_KEY_(.*)$/);

      if (match) {
        const [, appName] = Array.from(match);
        const isFile = appName.match(/^(.*)_FILE$/);
        if (isFile) {
          const [, appName] = Array.from(isFile);
          fs.readFileSync(value, 'utf8')
            .split('\n')
            .map(l => l.trim())
            .filter(l => !!l)
            .forEach(value => {
              config.appKeys[value] = appName.toLowerCase();
            });
        } else {
          config.appKeys[value] = appName.toLowerCase();
        }
      } else {
        match = name.match(/^SLACK_HOOK_(.*)$/);
        if (match) {
          const [, type] = Array.from(match);
          config.slackHooks[type.toLowerCase()] = value;
        }
      }
    }

    if (config.metrics) {
      config.metrics_options = {
        metricsPath: environment['METRICS_PATH'] || '/_metrics',
        collectDefaultMetrics: this.envBool(environment, 'METRICS_COLLECT_DEFAULT', true)
      };
      const requestDurationBuckets = environment['METRICS_REQUEST_DURATION_BUCKETS'] || false;
      if (requestDurationBuckets) {
        config.metrics_options.requestDurationBuckets = requestDurationBuckets
          .split(',')
          .map(bucket => Number(bucket.trim()));
      }

      const metricsApp = environment['METRICS_APP'] || false;
      if (metricsApp) {
        config.metrics_options.metricsApp = metricsApp;
      }
      const metricsAuthToken = environment['METRICS_TOKEN'] || false;
      if (metricsAuthToken) {
        config.metrics_options.authenticate = function(req) {
          const { authorization } = req.headers;
          if (authorization) {
            const m = /^[Bb]earer\s+(\S+)$/.exec(authorization);
            if (m === null) {
              return false;
            }
            const [, tokenString] = m;
            return tokenString === metricsAuthToken;
          }
          return false;
        };
      }
    }
    return config;
  }

  noRouteMatch = (req, res, next) => {
    // OPTIONS default handler falls through here; let it
    if (req.method === 'OPTIONS') {
      setImmediate(next);
    } else {
      if (this.config.log404) {
        setImmediate(next, new HTTPError(`No route found for ${req.originalUrl}`, 404));
      } else {
        Microservice.dontLog(req, res, () => {
          next(new HTTPError(`No route found for ${req.originalUrl}`, 404));
        });
      }
    }
  };
}

module.exports = Microservice;
module.exports.HTTPError = HTTPError;
