import * as yargs from 'yargs'
import * as columnify from 'columnify'
import * as common from '../lib/common'
import {listMessage} from '../lib/list-message'
import {getStats} from '../lib/get-stats'

interface StatColumn {
  name:string,
  visible:number,
  invisible:number,
  delayed:number
}

exports.command = 'stat'
exports.desc = 'Display common stats for queues'
exports.builder = function (yargs:yargs.Argv) {
  yargs
    .demand(['prefix'])
    .describe('prefix', 'Queue name prefix')
  return yargs
}
exports.handler = function (argv:yargs.Arguments) {
  let sqs:AWS.SQS = common.getSQS(process.env.NODE_ENV)
  getStats(sqs, argv.prefix).then((result) => {
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
