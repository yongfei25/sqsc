import * as yargs from 'yargs'
import * as columnify from 'columnify'
import * as common from '../lib/common'
import { copyMessage } from '../lib/copy-message'

exports.command = 'mv <from-queue-name> <to-queue-name>'
exports.desc = 'Move all messages from source queue to target queue.'
exports.builder = function (yargs:yargs.Argv) {
  yargs
    .describe('timeout', 'Message visibility timeout in seconds while reading')
    .default('timeout', 30)
  return yargs
}
exports.handler = function (argv:yargs.Arguments) {
  const sqs:AWS.SQS = common.getSQS()
  const param = {
    sourceQueueName: argv.fromQueueName,
    targetQueueName: argv.toQueueName,
    timeout: argv.timeout,
    move: true
  }
  copyMessage(sqs, param, (messages) => {
    messages.forEach(message => {
      console.log(`Moved ${truncateBody(message.Body, 60)}`)
    })
  }).then((allMessages) => {
    console.log(`Done. Moved ${allMessages.length}.`)
  }).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

function truncateBody (s:string, length:number):string {
  return s.substr(0, Math.min(length, s.length)) + '...'
}
