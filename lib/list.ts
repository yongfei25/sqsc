import * as sqlite3 from 'sqlite3'
import * as AWS from 'aws-sdk'
import * as common from './common'

export interface ListParams {
  queueName:string,
  like?:string,
  limit?:number,
  descending?:boolean
}

export interface ListItem {
  timestamp:Date,
  body:string,
  sequenceNum:string
}

export async function list (db:sqlite3.Database, params:ListParams):Promise<ListItem[]> {
  const tableName = common.getTableName(params.queueName)
  let vals = []
  let predicates = []
  let sql = `select sent_timestamp, sequence_number, body from ${tableName}`
  if (params.like) {
    predicates.push('body like ?')
    vals.push(params.like)
  }
  if (predicates.length > 0) {
    sql += ' where ' + predicates.join(' AND ')
  }
  sql += ` order by sequence_number, sent_timestamp ${params.descending? 'desc' : 'asc'}`
  if (params.limit) {
    sql += ' limit ?'
    vals.push(params.limit)
  }
  let q = new Promise<ListItem[]>((resolve, reject) => {
    db.all(sql, vals, (err, rows) => {
      if (err) return reject(err)
      let result:ListItem[] = rows.map((row) => {
        return { body: row.body, timestamp: new Date(row.sent_timestamp), sequenceNum: row.sequence_number }
      })
      return resolve(result)
    })
  })
  return await q
}
