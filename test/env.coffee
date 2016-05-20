# env.coffee
# Common stuff for microservice batches
# Copyright 2016 Fuzzy.io <legal@fuzzy.io>
# All rights reserved

env =
  SLACK_HOOK: "http://localhost:1516/default"
  SLACK_HOOK_ERROR: "http://localhost:1516/error"
  SLACK_HOOK_FOO: "http://localhost:1516/foo"
  PORT: "2342"
  DRIVER: "memory"
  HOSTNAME: "localhost"
  LOG_FILE: "/dev/null"
  APP_KEY_UNIT_TEST: "bract-else-aside-hug-torso"
  APP_KEY_UNDERSCORE: "bract_else_aside_hug_torso"
  APP_KEY_PERIOD: "bract.else.aside.hug.torso"
  APP_KEY_SLASH: "bract/else/aside/hug/torso"

module.exports = env
