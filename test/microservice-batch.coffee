# microservice-batch.coffee
# Common stuff for microservice batches


http = require 'http'

_ = require 'lodash'
vows = require 'vows'
assert = require 'assert'
async = require 'async'
request = require 'request'

APP_KEY = "soothlesseecovezqislam"

process.on 'uncaughtException', (err) ->
  console.error err

microserviceBatch = (rest) ->
  base =
    'When we set up a mock Slack server':
      topic: ->
        callback = @callback
        slack = http.createServer (req, res) ->
          res.writeHead 200,
            'Content-Type': 'text/plain'
            'Content-Length': '0'
          res.end()
        slack.listen 1516, () ->
          callback null, slack
        undefined
      'it works': (err, slack) ->
        assert.ifError err
      teardown: (slack) ->
        callback = @callback
        slack.once 'close', ->
          callback null
        slack.close()
        undefined
      'and we start a WidgetService':
        topic: ->
          WidgetService = require './widgetservice'
          env =
            SLACK_HOOK: "http://localhost:1516/default"
            SLACK_HOOK_ERROR: "http://localhost:1516/error"
            SLACK_HOOK_FOO: "http://localhost:1516/foo"
            PORT: "2342"
            DRIVER: "memory"
            HOSTNAME: "localhost"
            LOG_FILE: "/dev/null"
            APP_KEY_UNIT_TEST: APP_KEY
          service = new WidgetService env
          service.start (err) =>
            if err
              @callback err
            else
              @callback null, service
          undefined
        'it works': (err, service) ->
          assert.ifError err
        teardown: (service) ->
          callback = @callback
          service.stop (err) ->
            callback null
          undefined

  batch = _.clone(base)

  key = _.keys(rest)[0]

  batch['When we set up a mock Slack server']['and we start a WidgetService'][key] = rest[key]

  batch

microserviceBatch.appKey = APP_KEY

module.exports = microserviceBatch
