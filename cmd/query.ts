import * as yargs from 'yargs'
import * as sqlite3 from 'sqlite3'
import * as columnify from 'columnify'
import * as common from '../lib/common'
import * as list from '../lib/list'

exports.command = 'query <queue-name>'
exports.desc = 'Query for messages'
exports.builder = function (yargs:yargs.Argv) {
  yargs
    .demand(['queue'])
    .describe('queue', 'Queue name')
    .describe('detail', 'Display more details')
    .describe('limit', 'Number of messages to list')
    .describe('like', 'Percent sign (%) wildcard matching on message body')
    .describe('desc', 'Order by timestamp descending')
  return yargs
}
exports.handler = async function (argv:yargs.Arguments) {
  let db:sqlite3.Database = await common.getDb()
  let params = {
    queueName: argv.queueName,
    like: argv.like,
    limit: argv.limit,
    descending: argv.desc
  }
  let messages = await list.list(db, params)
  let cols = []
  let showCol
  if (!argv.detail) {
    cols = messages.map(m => { return { body: m.body }})
    showCol = columnify(cols, { showHeaders: false })
  } else {
    cols = messages.map(m => {
      return {
        sent_time: common.getDateString(m.timestamp),
        body: m.body,
        fifo_seq: m.sequenceNum
      }
    })
    showCol = columnify(cols)
  }
  console.log(showCol)
}
