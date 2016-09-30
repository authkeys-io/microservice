# Copyright 2016 Fuzzy.ai
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

util = require 'util'
http = require 'http'
https = require 'https'
os = require 'os'
assert = require 'assert'

debug = require('debug')('microservice')
_ = require 'lodash'
async = require 'async'
express = require 'express'
bodyParser = require 'body-parser'
{Databank, DatabankObject} = require 'databank'
Logger = require 'bunyan'
uuid = require 'node-uuid'
request = require 'request'

HTTPError = require './httperror'

ONE_DAY = 24 * 60 * 60 * 1000

class Microservice

  constructor: (environment) ->

    # Default to process.env

    if !environment?
      environment = process.env

    @config = @environmentToConfig environment
    @log = @setupLogger()
    @express = @setupExpress()
    @srv = null
    @db = null

  resetTiming: ->
    # Timing of requests

    @timing =
      max: -Infinity
      min: Infinity
      avg: NaN
      count: 0

  start: (callback) ->

    mu = @

    @resetTiming()

    async.waterfall [
      (callback) ->
        mu.startDatabase callback
      (callback) ->
        mu.startNetwork callback
      (callback) ->
        mu.startTimers callback
      (callback) ->
        mu.startCustom callback
    ], (err) ->
      if err
        callback err
      else
        callback null

  stop: (callback) ->

    mu = @

    # Clear timing of requests

    @resetTiming()

    async.waterfall [
      (callback) ->
        mu.stopCustom callback
      (callback) ->
        mu.stopTimers callback
      (callback) ->
        mu.stopNetwork callback
      (callback) ->
        mu.stopDatabase callback
    ], callback

  startDatabase: (callback) ->

    if !_.isString(@config.driver)
      return callback new Error("No databank driver configured")

    if !_.isObject(@config.params)
      return callback new Error("No databank params configured")

    schema = @getSchema()

    if !_.isObject(schema)
      return callback new Error("No schema defined for this microservice class")

    @config.params.schema = schema

    @db = Databank.get @config.driver, @config.params

    if @config.params.checkSchema?
      @db.checkSchema = @config.params.checkSchema

    @db.connect @config.params, (err) =>
      if err
        callback err
      else
        DatabankObject.bank = @db
        callback null

  startNetwork: (callback) ->

    if @config.key
      options =
        key: @config.key
        cert: @config.cert
      @srv = https.createServer(options, @express)
    else
      @srv = http.createServer(@express)

    onError = (err) ->
      clearListeners()
      callback err

    onListening = () ->
      callback null

    clearListeners = () =>
      @srv.removeListener 'error', onError
      @srv.removeListener 'listening', onListening

    @srv.on 'error', onError
    @srv.on 'listening', onListening

    address = @config.address or @config.hostname

    @srv.listen @config.port, address

    undefined

  stopNetwork: (callback) ->

    # If there's no server, no need to do this

    if !@srv?
      debug("Skipping stopNetwork(); no server")
      return callback null

    onError = (err) =>
      clearListeners()
      @srv = null
      callback err

    onClose = =>
      clearListeners()
      @srv = null
      callback null

    clearListeners = =>
      @srv.removeListener 'error', onError
      @srv.removeListener 'close', onClose

    @srv.on 'error', onError
    @srv.on 'close', onClose

    @srv.close()

  stopDatabase: (callback) ->

    if !@db?
      debug("Skipping stopDatabase(); no database")
      return callback null

    @db.disconnect (err) =>
      @db = undefined
      DatabankObject.db = undefined
      callback err

  startTimers: (callback) ->
    # XXX: If there are other timers add them here
    @startTimingTimer()
    callback null

  stopTimers: (callback) ->
    # XXX: If there are other timers add them here
    @stopTimingTimer()
    callback null

  startTimingTimer: ->
    @timingTimer = setTimeout @reportTiming, @config.timingInterval

  stopTimingTimer: ->
    clearTimeout @timingTimer

  reportTiming: =>
    if @timing.count is 0
      message = "No requests during this period"
    else
      message = "count: #{@timing.count}, average: #{@timing.avg}, " +
        "stddev: #{@timing.stddev}, min: #{@timing.min}, max: #{@timing.max}"
    @resetTiming()
    @slackMessage 'timing', message,  (err) =>
      if err
        @express.log.error {err: err}, "Error posting to Slack"

  getName: () ->
    "microservice"

  getSchema: () ->
    null

  setupLogger: () ->
    logParams =
      serializers:
        req: Logger.stdSerializers.req
        res: Logger.stdSerializers.res
        err: Logger.stdSerializers.err
      level: @config.logLevel

    if @config.logFile
      logParams.streams = [{path: @config.logFile}]
    else
      logParams.streams = [{stream: process.stderr}]

    logParams.name = @getName()

    log = new Logger logParams

    log.debug "Initializing"

    log

  appAuthc: (req, res, next) ->
    appKeys = req.app.config.appKeys

    Microservice::bearerToken req, (err, tokenString) ->
      if err
        next err
      else if appKeys[tokenString]?
        req.appName = appKeys[tokenString]
        next()
      else
        props = {tokenString: tokenString, appKeys: appKeys}
        req.log.warn props, "Unauthorized token string"
        next new HTTPError("Unauthorized token string", 401)

  bearerToken: (req, callback) ->
    authorization = req.headers.authorization
    debug("Checking #{authorization} for a bearer token")
    if authorization
      m = /^[Bb]earer\s+(\S+)$/.exec authorization
      if !m?
        msg = "Authorization header should be like 'Bearer <token>'"
        callback new HTTPError(msg, 401)
      else
        tokenString = m[1]
        callback null, tokenString
    else if req.query?.access_token?
      debug("No #{authorization} header; using access_token query param")
      debug(req.query?.access_token)
      callback null, req.query?.access_token
    else
      callback new HTTPError("Authorization required", 401)

  errorHandler: (err, req, res, next) ->

    config = @config

    if err.name == "NoSuchThingError"
      res.statusCode = 404
    else
      res.statusCode = err.statusCode or 500

    if req.log
      req.log.error {err: err}, "Error"

    # Report server errors; these are something we have to fix

    if res.statusCode >= 500 and res.statusCode < 600
      @slackMessage 'error', "#{err.name}: #{err.message}", ":bomb:", (err) =>
        if err
          @express.log.error {err: err}, "Error posting to Slack"

    # This is required for 401 responses

    if res.statusCode is 401
      res.setHeader "WWW-Authenticate", "Bearer"

    res.setHeader "Content-Type", "application/json"
    res.json {status: 'error', message: err.message}

  slackMessage: (type, message, icon, callback) ->

    if !callback?
      callback = icon
      icon = ':speech_balloon:'

    assert _.isString(type)
    assert _.isString(message)
    assert _.isString(icon)
    assert _.isFunction(callback)

    if type? and _.has(@config.slackHooks, type)
      hook = @config.slackHooks[type]
    else
      hook = @config.slackHook

    if !hook?
      return callback null

    hostname = os.hostname()

    options =
      url: hook
      headers:
        "Content-Type": "application/json"
      json:
        text: "#{hostname} #{message}"
        username: @getName()
        icon_emoji: icon

    request.post options, (err, response, body) ->
      callback err

  requestLogger: (req, res, next) ->
    req.id = uuid.v4()
    weblog = req.app.log.child
      req_id: req.id
      url: req.originalUrl
      method: req.method
      component: "web"
    end = res.end
    req.log = weblog
    res.end = (chunk, encoding) ->
      res.end = end
      res.end(chunk, encoding)
      rec = {req: req, res: res}
      weblog.info(rec)
    next()

  requestTimer: (req, res, next) =>
    startTime = Date.now()
    end = res.end
    res.end = (chunk, encoding) =>
      res.end = end
      res.end(chunk, encoding)
      endTime = Date.now()
      duration = endTime - startTime
      {count, avg, stddev} = @timing
      @timing.count += 1
      if @timing.count is 1
        @timing.max = duration
        @timing.min = duration
        @timing.avg = duration
        @timing.stddev = 0
      else
        if duration > @timing.max
          @timing.max = duration
        if duration < @timing.min
          @timing.min = duration
        @timing.avg = ((count * avg) + duration)/@timing.count
        # From http://math.stackexchange.com/questions/102978/incremental-computation-of-standard-deviation
        @timing.stddev = Math.sqrt(((count - 1)*Math.pow(stddev, 2) + count * Math.pow(avg - @timing.avg, 2) + Math.pow(duration - @timing.avg, 2))/count)

    next()

  setupExpress: () ->

    exp = express()
    exp.log = @log.child component: "express"

    exp.use @requestTimer
    exp.use @requestLogger
    exp.use bodyParser.json({limit: @config.maxUploadSize})

    exp.config = @config
    exp.config.name = @getName()

    @setupMiddleware exp
    @setupParams exp
    @setupRoutes exp

    exp.use @noRouteMatch

    self = @

    # Error handler
    # Note: we go through some acrobatics to make sure the arity of the
    # function passed to use() is 4.

    exp.use (err, req, res, next) ->
      self.errorHandler err, req, res, next

    exp

  setupMiddleware: (exp) ->
    undefined

  setupParams: (exp) ->
    undefined

  setupRoutes: (exp) ->
    undefined

  startCustom: (callback) ->
    callback null

  stopCustom: (callback) ->
    callback null

  envInt: (env, key, def) ->
    if env[key] then parseInt(env[key], 10) else def

  envJSON: (env, key, def) ->
    if env[key] then JSON.parse(env[key]) else def

  envBool: (env, key, def) ->
    if env[key]?
      if env[key].toLowerCase() in ["true", "yes", "on", "1"]
        true
      else if env[key].toLowerCase() in ["false", "no", "off", "0"]
        false
      else
        throw new Error("Not a boolean: #{env[key]}")
    else
      def

  environmentToConfig: (environment) ->

    config =
      port: @envInt environment, 'PORT', 80
      hostname: environment['HOSTNAME']
      address: environment['ADDRESS'] || '0.0.0.0'
      key: environment['KEY']
      cert: environment['CERT']
      logLevel: environment['LOG_LEVEL'] || 'info'
      logFile: environment['LOG_FILE'] || null
      slackHook: environment['SLACK_HOOK']
      driver: environment['DRIVER']
      params: @envJSON environment, 'PARAMS', {}
      maxUploadSize: environment['MAX_UPLOAD_SIZE'] or '50mb'
      appKeys: {}
      slackHooks: {}
      timingInterval: @envInt environment, 'TIMING_INTERVAL', ONE_DAY

    for name, value of environment

      match = name.match /^APP_KEY_(.*)$/

      if match
        [full, appName] = match
        config.appKeys[value] = appName.toLowerCase()

      match = name.match /^SLACK_HOOK_(.*)$/

      if match
        [full, type] = match
        config.slackHooks[type.toLowerCase()] = value

    config

  noRouteMatch: (req, res, next) ->
    # OPTIONS default handler falls through here; let it
    if req.method == "OPTIONS"
      next()
    else
      next new HTTPError("No route found for #{req.originalUrl}", 404)

module.exports = Microservice
module.exports.HTTPError = HTTPError
