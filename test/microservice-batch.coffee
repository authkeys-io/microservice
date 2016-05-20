# microservice-batch.coffee
# Common stuff for microservice batches


http = require 'http'

_ = require 'lodash'
vows = require 'vows'
assert = require 'assert'
async = require 'async'
request = require 'request'

env = require './env'

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

  _.assign batch['When we set up a mock Slack server']['and we start a WidgetService'], rest

  batch

microserviceBatch.appKey = env.APP_KEY_UNIT_TEST

module.exports = microserviceBatch
