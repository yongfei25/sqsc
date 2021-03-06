import * as yargs from 'yargs'
import * as ora from 'ora'
import * as common from '../lib/common'
import * as localDb from '../lib/local-db'
import * as pull from '../lib/pull'

exports.command = 'pull <queue-name>'
exports.desc = 'Pull and store messages in local database'
exports.builder = function (yargs:yargs.Argv) {
  yargs
    .default('timeout', 30)
    .describe('timeout', 'Visibility timeout')
  return yargs
}
exports.handler = function (argv:yargs.Arguments) {
  pullMessages(argv).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

async function pullMessages (argv:yargs.Arguments) {
  let sqs = common.getSQS()
  let db = await localDb.getDb()
  let param = { queueName: argv.queueName }
  let spinner = ora('Pulling SQS messages').start()
  try {
    let result = await pull.pull(sqs, db, param, (current, total) => {
      spinner.text = `Received ${current} / ${total} messages.`
    })
    spinner.succeed(`Done. Stored ${result} messages.`)
  } catch (err) {
    spinner.fail(err.message)
  }
}
