// env.coffee
// Common stuff for microservice batches
// Copyright 2016 Fuzzy.ai <node@fuzzy.ai>
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

const env = {
  SLACK_HOOK: 'http://localhost:1516/default',
  SLACK_HOOK_ERROR: 'http://localhost:1516/error',
  SLACK_HOOK_FOO: 'http://localhost:1516/foo',
  SLACK_HOOK_TIMING: 'http://localhost:1516/timing',
  PORT: '2342',
  DRIVER: 'memory',
  HOSTNAME: 'localhost',
  LOG_FILE: '/dev/null',
  APP_KEY_UNIT_TEST: 'bract-else-aside-hug-torso',
  APP_KEY_UNDERSCORE: 'bract_else_aside_hug_torso',
  APP_KEY_PERIOD: 'bract.else.aside.hug.torso',
  APP_KEY_SLASH: 'bract/else/aside/hug/torso',
  TIMING_INTERVAL: '2000'
};

module.exports = env;
