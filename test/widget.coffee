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

{Databank, DatabankObject} = require 'databank'

Widget = DatabankObject.subClass 'widget'
Widget.count = 0

Widget.schema =
  pkey: 'id'
  fields: [
    'name'
    'createdAt'
    'updatedAt'
  ]

Widget.beforeCreate = (props, callback) ->

  props.id = Widget.count
  props.createdAt = (new Date()).toISOString()
  callback null, props

Widget::afterCreate = (callback) ->
  Widget.count++
  callback null

module.exports = Widget
