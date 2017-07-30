import * as sqlite3 from 'sqlite3'
import * as common from './common'

function getTableRegionSuffix () {
  return common.getRegionOrDefault('us-east-1').replace(/\-/g, '_')
}

export function getTableName (queueName:string):string {
  return `msg_${queueName}_${getTableRegionSuffix()}`
}

export async function getMessageTables (db:sqlite3.Database):Promise<string[]> {
  const region = getTableRegionSuffix()
  const sql = 'SELECT name from sqlite_master where type=? AND name LIKE ?'
  const wildcard = `msg_%_${region}`
  return new Promise<string[]>((resolve, reject) => {
    db.all(sql, ['table', wildcard], (err, rows) => {
      if (err) return reject(err)
      resolve(rows.map(r => r.name))
    })
  })
}
