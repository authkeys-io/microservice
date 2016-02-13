# Copyright 2016 Fuzzy.io
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

http = require 'http'
https = require 'https'

_ = require 'lodash'
async = require 'async'
express = require 'express'
bodyParser = require 'body-parser'
{Databank, DatabankObject} = require 'databank'
Logger = require 'bunyan'
uuid = require 'node-uuid'
request = require 'request'

HTTPError = require './httperror'

psw = (str) ->
  process.stderr.write str + "\n"

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
    ], (err) ->
      if err
        callback err
      else
        callback null

  stop: (callback) ->

    async.waterfall [
      (callback) =>
        @stopNetwork callback
      (callback) =>
        @stopDatabase callback
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

    @srv.once 'error', (err) ->
      callback err

    @srv.once 'listening', () ->
      callback null

    address = @config.address or @config.hostname

    @srv.listen @config.port, address

    undefined

  stopNetwork: (callback) ->

    @srv.once 'close', () =>
      callback null

    @srv.once 'error', (err) ->
      callback err

    @srv.close()
    @srv = undefined

  stopDatabase: (callback) ->

    @db.disconnect callback
    @db = undefined
    Databank.db = undefined

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
        req.log.warn {tokenString: tokenString, appKeys: appKeys}, "Unauthorized token string"
        next new HTTPError("Unauthorized token string", 403)

  bearerToken: (req, callback) ->
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

    exp = express()
    exp.log = @setupLogger()

    exp.use requestLogger
    exp.use bodyParser.json()

    exp.config = @config
    exp.config.name = @getName()

    @setupRoutes exp

    # Error handler
    exp.use (err, req, res, next) ->
      config = req.app.config

      if err.name == "NoSuchThingError"
        res.statusCode = 404
      else
        res.statusCode = err.statusCode or 500
      if req.log
        req.log.error {err: err}, "Error"
      if config.slackHook
        options =
          url: config.slackHook
          headers:
            "Content-Type": "application/json"
          json:
            text: "#{config.name}/#{config.hostname} #{err.name}: #{err.message}."
            username: "microservice"
            icon_emoji: ":bomb:"
        request.post options, (err, response, body) ->
          if err
            console.error err
      res.setHeader "Content-Type", "application/json"
      res.json {status: 'error', message: err.message, }

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
      logFile: environment['LOG_FILE'] || null
      slackHook: environment['SLACK_HOOK']
      driver: environment['DRIVER']
      params: if environment['PARAMS'] then JSON.parse(environment['PARAMS']) else {}
      appKeys: {}

    for name, value of environment
      match = name.match /^APP_KEY_(.*)$/
      if match
        [full, appName] = match
        config.appKeys[value] = appName.toLowerCase()

    config

module.exports = Microservice
