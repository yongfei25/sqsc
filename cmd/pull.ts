import * as yargs from 'yargs'
import * as ora from 'ora'
import * as common from '../lib/common'
import * as pull from '../lib/pull'

exports.command = 'pull'
exports.desc = 'Store messages in local database'
exports.builder = function (yargs:yargs.Argv) {
  yargs
    .demand(['queue'])
    .describe('queue', 'Queue name')
    .default('timeout', 30)
    .describe('timeout', 'Visibility timeout')
  return yargs
}
exports.handler = async function (argv:yargs.Arguments) {
  let sqs = common.getSQS()
  let db = await common.getDb()
  let param = { queueName: argv.queueName }
  let spinner = ora('Pulling SQS messages').start()
  let result = await pull.pull(sqs, db, param, (current, total) => {
    spinner.text = `Received ${current} / ${total} messages.`
  })
  spinner.succeed(`Done. Stored ${result} messages.`)
}
