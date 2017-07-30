import * as yargs from 'yargs'
import * as columnify from 'columnify'
import * as common from '../lib/common'
import * as localDb from '../lib/local-db'

exports.command = 'list-table'
exports.desc = 'List all local tables pulled with sqsc.'
exports.handler = async function (argv:yargs.Arguments) {
  const db = await localDb.getDb()
  const stats = await localDb.getAllMessageTableStats(db)
  const cols = stats.map((stat) => {
    return {
      name: getQueueNameFromTableName(stat.tableName),
      message: stat.numOfMessage,
      latest_message: latestTimeStampString(stat.lastMessageTimestamp)
    }
  })
  console.log(columnify(cols))
}

function getQueueNameFromTableName (tableName:string):string|null {
  let match = tableName.match(/msg_(\w+)_\w+_\w+_\w+/)
  if (match) {
    return match[1]
  } else {
    return null
  }
}

function latestTimeStampString (d:Date|null):string {
  if (d) {
    return d.toISOString()
  } else {
    return 'N/A'
  }
}
