import * as yargs from 'yargs'
import * as columnify from 'columnify'
import * as common from '../lib/common'
import { listMessage } from '../lib/list-message'

exports.command = 'ls <queue-name>'
exports.desc = 'List messages in a queue'
exports.builder = function (yargs:yargs.Argv) {
  yargs
    .describe('timestamp', 'Show timestamp')
    .describe('limit', 'Number of messages')
    .describe('timeout', 'Message visibility timeout in seconds while reading')
    .default('timeout', 30)
  return yargs
}
exports.handler = async function (argv:yargs.Arguments) {
  const sqs:AWS.SQS = common.getSQS()
  const messages = await listMessage(sqs, {
    queueName: argv.queueName,
    print: true,
    limit: argv.limit,
    timeout: argv.timeout,
    timestamp: argv.timestamp
  })
}
