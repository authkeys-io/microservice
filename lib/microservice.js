// Copyright 2016 Fuzzy.ai
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

const http = require('http')
const https = require('https')
const os = require('os')
const assert = require('assert')

const debug = require('debug')('microservice')
const _ = require('lodash')
const async = require('async')
const express = require('express')
const bodyParser = require('body-parser')
const {Databank, DatabankObject} = require('databank')
const Logger = require('bunyan')
const uuid = require('uuid')
const request = require('request')

const HTTPError = require('./httperror')

const ONE_DAY = 24 * 60 * 60 * 1000

class Microservice {
  constructor (environment) {
    // Default to process.env

    this.reportTiming = this.reportTiming.bind(this)
    this.requestTimer = this.requestTimer.bind(this)
    if ((environment == null)) {
      environment = process.env
    }

    this.config = this.environmentToConfig(environment)
    this.log = this.setupLogger()
    this.express = this.setupExpress()
    this.srv = null
    this.db = null
  }

  resetTiming () {
    // Timing of requests

    this.timing = {
      max: -Infinity,
      min: Infinity,
      avg: NaN,
      count: 0
    }

    return this.timing
  }

  start (callback) {
    const mu = this

    this.resetTiming()

    return async.waterfall([
      callback => mu.startDatabase(callback),
      callback => mu.startNetwork(callback),
      callback => mu.startTimers(callback),
      callback => mu.startCustom(callback)
    ], (err) => {
      if (err) {
        return callback(err)
      } else {
        return callback(null)
      }
    })
  }

  stop (callback) {
    const mu = this

    // Clear timing of requests

    this.resetTiming()

    return async.waterfall([
      callback => mu.stopCustom(callback),
      callback => mu.stopTimers(callback),
      callback => mu.stopNetwork(callback),
      callback => mu.stopDatabase(callback)
    ], callback)
  }

  startDatabase (callback) {
    if (!_.isString(this.config.driver)) {
      return callback(new Error('No databank driver configured'))
    }

    if (!_.isObject(this.config.params)) {
      return callback(new Error('No databank params configured'))
    }

    const schema = this.getSchema()

    if (!_.isObject(schema)) {
      return callback(new Error('No schema defined for this microservice class'))
    }

    this.config.params.schema = schema

    this.db = Databank.get(this.config.driver, this.config.params)

    if (this.config.params.checkSchema != null) {
      this.db.checkSchema = this.config.params.checkSchema
    }

    return this.db.connect(this.config.params, err => {
      if (err) {
        return callback(err)
      } else {
        DatabankObject.bank = this.db
        return callback(null)
      }
    })
  }

  startNetwork (callback) {
    if (this.config.key) {
      const options = {
        key: this.config.key,
        cert: this.config.cert
      }
      this.srv = https.createServer(options, this.express)
    } else {
      this.srv = http.createServer(this.express)
    }

    const onError = function (err) {
      clearListeners()
      return callback(err)
    }

    const onListening = () => callback(null)

    const clearListeners = () => {
      this.srv.removeListener('error', onError)
      return this.srv.removeListener('listening', onListening)
    }

    this.srv.on('error', onError)
    this.srv.on('listening', onListening)

    const address = this.config.address || this.config.hostname

    this.srv.listen(this.config.port, address)

    return undefined
  }

  stopNetwork (callback) {
    // If there's no server, no need to do this

    if ((this.srv == null)) {
      debug('Skipping stopNetwork(); no server')
      return callback(null)
    }

    const onError = err => {
      clearListeners()
      this.srv = null
      return callback(err)
    }

    const onClose = () => {
      clearListeners()
      this.srv = null
      return callback(null)
    }

    const clearListeners = () => {
      this.srv.removeListener('error', onError)
      return this.srv.removeListener('close', onClose)
    }

    this.srv.on('error', onError)
    this.srv.on('close', onClose)

    return this.srv.close()
  }

  stopDatabase (callback) {
    if ((this.db == null)) {
      debug('Skipping stopDatabase(); no database')
      return callback(null)
    }

    return this.db.disconnect(err => {
      this.db = undefined
      DatabankObject.db = undefined
      return callback(err)
    })
  }

  startTimers (callback) {
    // XXX: If there are other timers add them here
    this.startTimingTimer()
    return callback(null)
  }

  stopTimers (callback) {
    // XXX: If there are other timers add them here
    this.stopTimingTimer()
    return callback(null)
  }

  startTimingTimer () {
    this.timingTimer = setTimeout(this.reportTiming, this.config.timingInterval)
    return this.timingTimer
  }

  stopTimingTimer () {
    return clearTimeout(this.timingTimer)
  }

  reportTiming () {
    let message
    if (this.timing.count === 0) {
      message = 'No requests during this period'
    } else {
      message = `count: ${this.timing.count}, average: ${this.timing.avg}, ` +
        `stddev: ${this.timing.stddev}, min: ${this.timing.min}, max: ${this.timing.max}`
    }
    this.resetTiming()
    return this.slackMessage('timing', message, err => {
      if (err) {
        return this.express.log.error({err}, 'Error posting to Slack')
      }
    })
  }

  getName () {
    return 'microservice'
  }

  getSchema () {
    return null
  }

  setupLogger () {
    const logParams = {
      serializers: {
        req: Logger.stdSerializers.req,
        res: Logger.stdSerializers.res,
        err: Logger.stdSerializers.err
      },
      level: this.config.logLevel
    }

    if (this.config.logFile) {
      logParams.streams = [{path: this.config.logFile}]
    } else {
      logParams.streams = [{stream: process.stderr}]
    }

    logParams.name = this.getName()

    const log = new Logger(logParams)

    log.debug('Initializing')

    return log
  }

  appAuthc (req, res, next) {
    const { appKeys } = req.app.config

    return Microservice.prototype.bearerToken(req, (err, tokenString) => {
      if (err) {
        return next(err)
      } else if (appKeys[tokenString] != null) {
        req.appName = appKeys[tokenString]
        return next()
      } else {
        const props = {tokenString, appKeys}
        req.log.warn(props, 'Unauthorized token string')
        return next(new HTTPError('Unauthorized token string', 401))
      }
    })
  }

  bearerToken (req, callback) {
    const { authorization } = req.headers
    debug(`Checking ${authorization} for a bearer token`)
    if (authorization) {
      const m = /^[Bb]earer\s+(\S+)$/.exec(authorization)
      if ((m == null)) {
        const msg = "Authorization header should be like 'Bearer <token>'"
        return callback(new HTTPError(msg, 401))
      } else {
        const [, tokenString] = m
        return callback(null, tokenString)
      }
    } else if ((req.query != null ? req.query.access_token : undefined) != null) {
      debug(`No ${authorization} header; using access_token query param`)
      debug(req.query != null ? req.query.access_token : undefined)
      return callback(null, req.query != null ? req.query.access_token : undefined)
    } else {
      return callback(new HTTPError('Authorization required', 401))
    }
  }

  errorHandler (err, req, res, next) {
    if (err.name === 'NoSuchThingError') {
      res.statusCode = 404
    } else {
      res.statusCode = err.statusCode || 500
    }

    if (req.log) {
      req.log.error({err}, 'Error')
    }

    // Report server errors; these are something we have to fix

    if ((res.statusCode >= 500) && (res.statusCode < 600)) {
      this.slackMessage('error', `${err.name}: ${err.message}`, ':bomb:', err => {
        if (err) {
          return this.express.log.error({err}, 'Error posting to Slack')
        }
      })
    }

    // This is required for 401 responses

    if (res.statusCode === 401) {
      res.setHeader('WWW-Authenticate', 'Bearer')
    }

    res.setHeader('Content-Type', 'application/json')
    return res.json({status: 'error', message: err.message})
  }

  slackMessage (type, message, icon, callback) {
    let hook
    if ((callback == null)) {
      callback = icon
      icon = ':speech_balloon:'
    }

    assert(_.isString(type))
    assert(_.isString(message))
    assert(_.isString(icon))
    assert(_.isFunction(callback))

    if ((type != null) && _.has(this.config.slackHooks, type)) {
      hook = this.config.slackHooks[type]
    } else {
      hook = this.config.slackHook
    }

    if ((hook == null)) {
      return callback(null)
    }

    const hostname = os.hostname()

    const options = {
      url: hook,
      headers: {
        'Content-Type': 'application/json'
      },
      json: {
        text: `${hostname} ${message}`,
        username: this.getName(),
        icon_emoji: icon
      }
    }

    return request.post(options, (err, response, body) => callback(err))
  }

  dontLog (req, res, next) {
    req.dontLog = true
    return next()
  }

  requestLogger (req, res, next) {
    req.id = uuid.v1()
    const weblog = req.app.log.child({
      req_id: req.id,
      url: req.originalUrl,
      method: req.method,
      component: 'web'
    })
    const { end } = res
    req.log = weblog
    req.dontLog = false
    res.end = function (chunk, encoding) {
      res.end = end
      res.end(chunk, encoding)
      if (!req.dontLog) {
        const rec = {req, res}
        return weblog.info(rec)
      }
    }
    return next()
  }

  requestTimer (req, res, next) {
    const startTime = Date.now()
    const { end } = res
    res.end = (chunk, encoding) => {
      res.end = end
      res.end(chunk, encoding)
      const endTime = Date.now()
      const duration = endTime - startTime
      const {count, avg, stddev} = this.timing
      this.timing.count += 1
      if (this.timing.count === 1) {
        this.timing.max = duration
        this.timing.min = duration
        this.timing.avg = duration
        this.timing.stddev = 0
        return this.timing.stddev
      } else {
        if (duration > this.timing.max) {
          this.timing.max = duration
        }
        if (duration < this.timing.min) {
          this.timing.min = duration
        }
        this.timing.avg = ((count * avg) + duration) / this.timing.count
        // From http://math.stackexchange.com/questions/102978/incremental-computation-of-standard-deviation
        this.timing.stddev = Math.sqrt((((count - 1) * Math.pow(stddev, 2)) + (count * Math.pow(avg - this.timing.avg, 2)) + Math.pow(duration - this.timing.avg, 2)) / count)
        return this.timing.stddev
      }
    }

    return next()
  }

  setupExpress () {
    const exp = express()
    exp.log = this.log.child({component: 'express'})

    exp.use(this.requestTimer)
    exp.use(this.requestLogger)
    exp.use(bodyParser.json({limit: this.config.maxUploadSize}))

    exp.config = this.config
    exp.config.name = this.getName()

    this.setupMiddleware(exp)
    this.setupParams(exp)
    this.setupRoutes(exp)

    exp.use(this.noRouteMatch)

    const self = this

    // Error handler
    // Note: we go through some acrobatics to make sure the arity of the
    // function passed to use() is 4.

    exp.use((err, req, res, next) => self.errorHandler(err, req, res, next))

    return exp
  }

  setupMiddleware (exp) {
    return undefined
  }

  setupParams (exp) {
    return undefined
  }

  setupRoutes (exp) {
    return undefined
  }

  startCustom (callback) {
    return callback(null)
  }

  stopCustom (callback) {
    return callback(null)
  }

  envInt (env, key, def) {
    if (env[key]) { return parseInt(env[key], 10) } else { return def }
  }

  envJSON (env, key, def) {
    if (env[key]) { return JSON.parse(env[key]) } else { return def }
  }

  envBool (env, key, def) {
    if (env[key] != null) {
      let needle, needle1
      if ((needle = env[key].toLowerCase(), ['true', 'yes', 'on', '1'].includes(needle))) {
        return true
      } else if ((needle1 = env[key].toLowerCase(), ['false', 'no', 'off', '0'].includes(needle1))) {
        return false
      } else {
        throw new Error(`Not a boolean: ${env[key]}`)
      }
    } else {
      return def
    }
  }

  environmentToConfig (environment) {
    const config = {
      port: this.envInt(environment, 'PORT', 80),
      hostname: environment['HOSTNAME'],
      address: environment['ADDRESS'] || '0.0.0.0',
      key: environment['KEY'],
      cert: environment['CERT'],
      logLevel: environment['LOG_LEVEL'] || 'info',
      logFile: environment['LOG_FILE'] || null,
      slackHook: environment['SLACK_HOOK'],
      driver: environment['DRIVER'],
      params: this.envJSON(environment, 'PARAMS', {}),
      maxUploadSize: environment['MAX_UPLOAD_SIZE'] || '50mb',
      appKeys: {},
      slackHooks: {},
      timingInterval: this.envInt(environment, 'TIMING_INTERVAL', ONE_DAY)
    }

    for (const name in environment) {
      const value = environment[name]
      let match = name.match(/^APP_KEY_(.*)$/)

      if (match) {
        const [, appName] = Array.from(match)
        config.appKeys[value] = appName.toLowerCase()
      }

      match = name.match(/^SLACK_HOOK_(.*)$/)

      if (match) {
        const [, type] = Array.from(match)
        config.slackHooks[type.toLowerCase()] = value
      }
    }

    return config
  }

  noRouteMatch (req, res, next) {
    // OPTIONS default handler falls through here; let it
    if (req.method === 'OPTIONS') {
      return next()
    } else {
      return next(new HTTPError(`No route found for ${req.originalUrl}`, 404))
    }
  }
}

module.exports = Microservice
module.exports.HTTPError = HTTPError
