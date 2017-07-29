import * as yargs from 'yargs'
import * as columnify from 'columnify'
import * as common from '../lib/common'
import { listQueue } from '../lib/list-queue'

interface StatColumn {
  name:string,
  visible:number,
  invisible:number,
  delayed:number
}

exports.command = 'lq [prefix]'
exports.desc = 'List the queues'
exports.builder = function (yargs:yargs.Argv) {
  yargs
    .describe('prefix', 'Queue name prefix')
  return yargs
}
exports.handler = function (argv:yargs.Arguments) {
  let sqs:AWS.SQS = common.getSQS()
  listQueue(sqs, { prefix: argv.prefix }).then((result) => {
    let cols:StatColumn[] = result.map((item) => {
      return {
        name: item.queueName,
        visible: item.numOfVisible,
        invisible: item.numOfInvisible,
        delayed: item.numOfDelayed
      }
    })
    console.log(columnify(cols))
  })
}
