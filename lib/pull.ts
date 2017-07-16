import * as AWS from 'aws-sdk'
import * as sqlite3 from 'sqlite3'
import * as common from './common'

interface ProgressCallback {
  (current:number, total:number): void
}

interface PullParams {
  queueName:string,
  timeout?:number
}

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

export async function insertMessages (db:sqlite3.Database, queueName:string, messages:AWS.SQS.Message[]):Promise<number> {
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
  return new Promise<number>((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err)
      resolve(this.changes)
    })
  })
}

export async function pull (sqs:AWS.SQS, db:sqlite3.Database, params:PullParams, progress?:ProgressCallback):Promise<number> {
  let queueUrl = await common.getQueueUrl(sqs, params.queueName)
  let result = 0
  if (queueUrl) {
    let results = await Promise.all([
      recreateMessageTable(db, params.queueName),
      sqs.getQueueAttributes({
        QueueUrl: queueUrl,
        AttributeNames: ['ApproximateNumberOfMessages']
      }).promise()
    ])
    let createTableResult = results[0]
    let attributes = results[1]
    let total:number = attributes.Attributes ? parseInt(attributes.Attributes.ApproximateNumberOfMessages) : Number.MAX_SAFE_INTEGER;
    let current:number = 0
    let receiptHandles:string[] = []
    while (current < total) {
      let data = await sqs.receiveMessage({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
        VisibilityTimeout: params.timeout || 30,
        AttributeNames: ['All']
      }).promise()
      let inserted = await insertMessages(db, params.queueName, data.Messages)
      receiptHandles = receiptHandles.concat(data.Messages.map(m => m.ReceiptHandle))
      current += inserted
      result = current
      if (progress) {
        progress(current, total)
      }
    }
    await common.changeTimeout(sqs, queueUrl, receiptHandles, 0)
  }
  return Promise.resolve(result)
}
