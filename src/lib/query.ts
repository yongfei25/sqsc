import * as sqlite3 from 'sqlite3'
import * as AWS from 'aws-sdk'
import * as common from './common'
import * as localDb from './local-db'

export function findQueueName (sql:string):string|null {
  const match = sql.match(/.+from\s([\w\-]+)\s?.*/i)
  if (!match) {
    return null
  }
  const queueName = match[1]
  return queueName
}

export function injectTableName (sql:string, queueName:string, tableName:string):string {
  const regexp = new RegExp(queueName, 'ig')  
  return sql.replace(regexp, tableName)
}

export async function query (db:sqlite3.Database, userQuery:string):Promise<any[]> {
  const queueName = findQueueName(userQuery)
  if (!queueName) throw new Error('Unable to find queue name from the query.')

  const tableName = localDb.getTableName(queueName)
  const tableExists = await localDb.hasTable(db, tableName)
  if (!tableExists) {
    throw new Error(`No table found for queue ${queueName}`)
  }
  let sql = injectTableName(userQuery, queueName, tableName)
  let q = new Promise<any[]>((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) return reject(err)
      return resolve(rows)
    })
  })
  return await q
}
