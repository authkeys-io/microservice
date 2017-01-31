fuzzy.ai-microservice
=====================

This is the microservice class we use for Fuzzy.ai. The goal is to avoid
re-writing a lot of boilerplate needed to set up an HTTP server and a database
connection. It has a couple of nice characteristics that make this useful for
us.

* It's configured using environment variables.
* It uses [databank](https://github.com/e14n/databank) for data access.
* It uses [express](http://expressjs.com/) for the web interface.
* It uses [Bunyan](https://github.com/trentm/node-bunyan) for logging.

We use Docker, so it dumps out its logs to stdout.

License
-------

Copyright 2016 Fuzzy.ai

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Usage
-----

You should be able to write pretty small microservice servers. Here's an
example.

```coffeescript

Microservice = require 'fuzzy.ai-microservice'

# Subclass Microservice

class BasicServer extends Microservice

  # Override setupRoutes to add routes to your expressjs server

  setupRoutes: (exp) ->

    exp.get '/version', (req, res, next) ->
      res.json {version: '0.1.0'}

    # This one uses the built-in app authentication

    exp.get '/who-am-i', @appAuthc, (req, res, next) ->
      res.json {appName: req.appName}

server = new BasicServer()

server.start (err) ->
  if err
    console.error(err)
  else
    console.log("Server started.")

```

Calling a microservice
----------------------

Note that you probably shouldn't invoke Microservice directly; you should use
a sub-class. Here are the methods that you should use:

* `constructor(environment)`. Takes an environment as a parameter. If none is
  provided, uses process.env. The environment variables are changed into
  configuration options.
* `start(callback)`. Start the microservice. `callback` is called with either
  an `err` argument or `null`.
* `stop(callback)`. Stop the microservice. `callback` is called with either an
  `err` argument or `null`.

Methods to overload
-------------------

These are methods that sub-classes of Microservice should overload.

* `getName()`. Return the name of the microservice. Used for error reporting and
  the like.
* `getSchema()`. Return the Databank schema for the microservice. See
  https://github.com/e14n/databank#schemata for the format.
* `setupMiddleware(exp)`. If you have any custom middleware to set up for the
  express server `exp`, do it here.
* `setupParams(exp)`. Any custom params would go here. Good place for
  `exp.param()` statements.
* `setupRoutes(exp)`. All your routes should go here.
* `startCustom(callback)`. If you need to have something happen after starting
  the server, do it here. This is a good time for ensuring databank items, for
  example.
* `stopCustom(callback)`. If you need to do something before stopping (what?),
  do it here.
* `environmentToConfig(env)`. Convert the environment to a config object.

Utility methods
---------------

These are some useful methods for microservice sub-classes to use.

* `envInt(env, key, def)`: Return the environment variable from `env` at `key`,
  as an integer, or `def` if the variable doesn't exist.
* `envJSON(env, key, def)`: Return the environment variable from `env` at `key`,
  parsed as JSON, or `def` if the variable doesn't exist.
* `envBool(env, key, def)`: Return the environment variable from `env` at `key`,
  interpreted as a boolean, or `def` if the variable doesn't exist.
  Case-insensitive variables that match "true", "yes", "on", or "1" are boolean
  `true`; ones that match "false", "no", "off", or "0" are boolean `false`.
  Anything else gives an error.
* `appAuthc(req, res, next)`: Middleware for checking the bearer token of a
  request against the configured app keys (see below). Will give the correct
  authorization error if none is allowed. Use this in your routes!
* `slackMessage(type, message, icon, callback)`. Notification method for sending
  updates to Slack. Errors are sent to Slack by default, but you can send other
  notifications if you need to. You can send things to different hooks using
  the 'type' modifier. If there is no specific hook for that type (see
  SLACK_HOOK_SOMETHING below for how to do that), it will be sent via the
  default hook.
* `dontLog(req, res, next)`. Middleware to use when you don't want to have
  a route logged. Useful for e.g. health-check URLs.

Environment variables
---------------------

The system uses environment variables for configuration. This is great if you
use Docker. We use Docker Compose, so that's even more great.

Here are the variables it uses by default.

* **PORT**: The port to listen on. Defaults to 443 if `KEY` is set (see below),
  otherwise 80.
* **ADDRESS**: IP address to listen on. Defaults to '0.0.0.0', meaning all
  addresses.
* **HOSTNAME**: hostname to use. Use address instead, usually.
* **KEY**: SSL key to use. This is the full key, not the name of a file.
* **CERT**: SSL cert to use. This is the full cert, not the name of a file.
* **LOG_LEVEL**: Bunyan log level. Defaults to 'info'.
* **APP_KEY_SOMETHING**: The app key that app 'something' will use to access
  this server. Supported by internal appAuthc.
* **MAX_UPLOAD_SIZE**: Maximum size of an upload. Use a string with 'mb', 'gb'
  or 'kb' to define a size in bytes. Defaults to '50mb'.
* **SLACK_HOOK** A [Webhook](https://en.wikipedia.org/wiki/Webhook) from
  [Slack](https://api.slack.com/incoming-webhooks) for posting messages.
* **SLACK_HOOK_SOMETHING** The hook for sending 'something' messages to Slack.
  This lets you specialise your Slack messages. By default, the error handler
  will use the 'error' hook, or it will fall back to the default. Note that
  hook 'SLACK_HOOK_SOMETHING' will get lowercased to 'something' when you need
  to send a slack message.

You can have a microservice grab more environment variables by overloading
`environmentToConfig`.

```coffeescript
  environmentToConfig: (environment) ->
    cfg = super environment
    cfg.foo = environment.FOO
    cfg
```
