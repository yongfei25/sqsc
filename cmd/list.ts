import * as yargs from 'yargs'
import * as common from '../lib/common'
import {listMessage} from '../lib/list-message'

exports.command = 'ls'
exports.desc = 'List all messages'
exports.builder = function (yargs:yargs.Argv) {
  yargs
    .demand(['name'])
    .describe('name', 'Queue name')
    .describe('timeout', 'Visibility timeout (seconds) on read')
    .default('timeout', '5')
    .describe('timestamp', 'Display timestamp of message received')
    .default('timestamp', false)
    .describe('limit', 'Number of messages to list')
  return yargs
}
exports.handler = function (argv:yargs.Arguments) {
  let sqs:AWS.SQS = common.getSQS(process.env.NODE_ENV)
  listMessage(sqs, {
    queueName: argv.name,
    timestamp: argv.timestamp,
    limit: argv.limit,
    print: true
  })
}
