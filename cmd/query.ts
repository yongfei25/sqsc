import * as yargs from 'yargs'
import * as sqlite3 from 'sqlite3'
import * as columnify from 'columnify'
import * as common from '../lib/common'
import * as localDb from '../lib/local-db'
import { query, findQueueName } from '../lib/query'

exports.command = 'query <sql>'
exports.desc = 'Eg: sqsc query "select * from TestQueue"'
exports.builder = function (yargs:yargs.Argv) {
  yargs
    .describe('hide-headers', 'Hide headers')
  return yargs
}
exports.handler = async function (argv:yargs.Arguments) {
  const db:sqlite3.Database = await localDb.getDb()
  try {
    const messages = await query(db, argv.sql)
    console.log(columnify(messages, { showHeaders: !argv.hideHeaders }))
  } catch (err) {
    if (err.message.includes('No table found for queue')) {
      const queueName = findQueueName(argv.sql)
      console.log(`Cannot find local data for queue ${queueName}. Try doing 'sqsc pull ${queueName}' first.`)
    } else {
      console.error(err.message)
    }
  }
}
