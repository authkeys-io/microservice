# Copyright 2016 Fuzzy.io. All rights reserved.

http = require 'http'
https = require 'https'

_ = require 'lodash'
async = require 'async'
express = require 'express'
bodyParser = require 'body-parser'
db = require 'databank'
Logger = require 'bunyan'
uuid = require 'node-uuid'

Databank = db.Databank
DatabankObject = db.DatabankObject

class Microservice

  constructor: (environment) ->

    # Default to process.env

    if !environment?
      environment = process.env

    @config = @environmentToConfig environment
    @express = @setupExpress()
    @srv = null
    @db = null

  start: (callback) ->

    async.waterfall [
      (callback) =>
        @startDatabase callback
      (callback) =>
        @startNetwork callback
    ], callback

  stop: (callback) ->

    async.waterfall [
      (callback) =>
        @stopNetwork callback
      (callback) =>
        @stopDatabase callback
    ], callback

  startDatabase: (callback) =>

    @config.params.schema = @setupSchema()

    @db = Databank.get @config.driver, @config.params

    if @config.params.checkSchema?
      @db.checkSchema = @config.params.checkSchema

    @db.connect @config.params, (err) =>
      if err
        callback err
      else
        DatabankObject.bank = @db
        callback null

  startNetwork: (callback) =>

    if @config.key
      options =
        key: @config.key
        cert: @config.cert
      @srv = https.createServer(options, @express)
    else
      @srv = http.createServer(@express)

    @srv.once 'error', (err) ->
      callback err

    @srv.once 'listening', () ->
      callback null

    address = @config.address or @config.hostname

    @srv.listen @config.port, address

    undefined

  stopNetwork: (callback) =>

    @srv.once 'close', () =>
      callback null

    @srv.once 'error', (err) ->
      callback err

    @srv.close()
    @srv = undefined

  stopDatabase: (callback) =>

    @db.disconnect callback
    @db = undefined
    Databank.db = undefined

  getName: () ->
    "microservice"

  getSchema: () ->
    {}

  setupLogger: () ->
    logParams =
      serializers:
        req: Logger.stdSerializers.req
        res: Logger.stdSerializers.res
        err: Logger.stdSerializers.err
      level: @config.loglevel

    if @config.logfile
        logParams.streams = [{path: @config.logfile}]
    else
        logParams.streams = [{stream: process.stderr}]

    logParams.name = @getName()

    log = new Logger logParams

    log.debug "Initializing"

    log

  appAuthc: (req, res, next) ->
    bearerToken = (req, callback) ->
      authorization = req.headers.authorization
      if !authorization?
        callback new HTTPError("No Authorization header", 401)
      else
        m = /^[Bb]earer\s+(\w+)$/.exec authorization
        if !m?
          callback new HTTPError("Authorization header should be like 'Bearer <token>'", 400)
        else
          tokenString = m[1]
          callback null, tokenString

    appKeys = req.app.config.appKeys

    bearerToken req, (err, tokenString) ->
      if err
        next err
      else if appKeys[tokenString]?
        req.appName = appKeys[tokenString]
        next()
      else
        req.log.warn {tokenString: tokenString, appKeys: appKeys}, "Unauthorized token string"
        next new HTTPError("Unauthorized token string", 401)

  setupExpress: () ->

    requestLogger = (req, res, next) ->
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
      next()

    exp = express()
    exp.log = @setupLogger()

    exp.use requestLogger
    exp.use bodyParser.json()

    # Error handler

    exp.use (err, req, res, next) ->
      if err.name == "NoSuchThingError"
        res.statusCode = 404
      else
        res.statusCode = err.statusCode or 500
      if req.log
        req.log.error {err: err}, "Error"
      res.setHeader "Content-Type", "application/json"
      res.json {message: err.message}

    @setupRoutes exp

    exp

  setupRoutes: (exp) ->
    undefined

  environmentToConfig: (environment) ->

    config =
      port: if environment['PORT'] then parseInt(environment['PORT'], 10) else 80
      hostname: environment['HOSTNAME']
      address: environment['ADDRESS'] || '0.0.0.0'
      key: environment['KEY']
      cert: environment['CERT']
      logLevel: environment['LOG_LEVEL'] || 'info'
      appKeys: {}

    for name, value of environment
      match = name.match /^APP_KEY_(.*)$/
      if match
        [full, appName] = match
        config.appKeys[value] = appName.toLowerCase()

    config

module.exports = Microservice
