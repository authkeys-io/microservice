fuzzy.io-microservice
=====================

This is the microservice class we use for Fuzzy.io. The goal is to avoid
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

Copyright 2016 Fuzzy.io

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

Microservice = require 'fuzzy.io-microservice'

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

You can have a microservice grab more environment variables by overloading
`environmentToConfig`.

```coffeescript
  environmentToConfig: (environment) ->
    cfg = super environment
    cfg.foo = environment.FOO
    cfg
```
