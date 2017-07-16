import * as AWS from 'aws-sdk'
import * as sqlite3 from 'sqlite3'

function getTableName (queueName:string):string {
  return `msg_${queueName}`
}

function convertTs (ts:string):string {
  let d = new Date(parseInt(ts))
  let ds = d.toISOString()
  return ds.substring(0,10) + ' ' + ds.substring(11, ds.length-1)
}

export async function recreateMessageTable (db:sqlite3.Database, queueName:string):Promise<sqlite3.RunResult> {
  const tableName = getTableName(queueName)
  let createTableSql = `
    create table ${tableName} (
      id text primary key,
      receipt_handle text,
      md5_body text,
      body text,
      sent_timestamp text,
      sender_id text,
      receive_count text,
      first_receive_timestamp text,
      group_id text,
      deduplication_id text,
      sequence_number text
    );
  `
  return new Promise<sqlite3.RunResult>((resolve, reject) => {
    db.serialize(function () {
      db.run(`drop table if exists ${tableName};`)
      db.run(createTableSql)
      db.run(`create index if not exists idx_sequence_number on ${tableName} (sequence_number);`)
      db.run(`create index if not exists idx_sent_timestamp on ${tableName} (sent_timestamp);`, (err) => {
        if (err) return reject(err)
        return resolve()
      })
    })
  })
}

export async function insertMessages (db:sqlite3.Database, queueName:string, messages:AWS.SQS.Message[]):Promise<sqlite3.RunResult> {
  const tableName = getTableName(queueName)
  let sql = `insert or replace into ${tableName} values `
  let params = []
  for (let i=0; i<messages.length; i++) {
    sql += '(?,?,?,?,?,?,?,?,?,?,?),'
    let m = messages[i]
    params.push(
      m.MessageId, m.ReceiptHandle, m.MD5OfBody, m.Body, convertTs(m.Attributes['SentTimestamp']),
      m.Attributes['SenderId'], m.Attributes['ApproximateReceiveCount'], convertTs(m.Attributes['ApproximateFirstReceiveTimestamp']),
      m.Attributes['MessageGroupId'], m.Attributes['MessageDeduplicationId'], m.Attributes['SequenceNumber']
    )
  }
  sql = sql.substring(0, sql.length-1)
  return new Promise<sqlite3.RunResult>((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

export async function pull (sqs:AWS.SQS, queueName:string) {

}
