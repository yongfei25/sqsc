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

function tableExists (db:sqlite3.Database, queueName:string):Promise<boolean> {
  const tableName = common.getTableName(queueName)
  return new Promise<boolean>((resolve, reject) => {
    db.get('SELECT name FROM sqlite_master WHERE type=? and name = ?', ['table', tableName], (err, row) => {
      if (err) return reject(err)
      return resolve((row && row.name === tableName))
    })
  })
}

export async function recreateMessageTable (db:sqlite3.Database, queueName:string):Promise<sqlite3.RunResult> {
  const tableName = common.getTableName(queueName)
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
  const tableName = common.getTableName(queueName)
  let sql = `insert or ignore into ${tableName} values `
  let params = []
  for (let i=0; i<messages.length; i++) {
    sql += '(?,?,?,?,?,?,?,?,?,?,?),'
    let m = messages[i]
    params.push(
      m.MessageId, m.ReceiptHandle, m.MD5OfBody, m.Body, common.convertTs(m.Attributes['SentTimestamp']),
      m.Attributes['SenderId'], m.Attributes['ApproximateReceiveCount'], common.convertTs(m.Attributes['ApproximateFirstReceiveTimestamp']),
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

export async function getAllReceiptHandles (sqs:AWS.SQS, db:sqlite3.Database, queueName:string):Promise<string[]> {
  const tableName = common.getTableName(queueName)
  let p1 = new Promise<string[]>((resolve, reject) => {
    db.all(`select receipt_handle from ${tableName}`, (err, rows) => {
      if (err) return reject(err)
      let receiptHandles:string[] = rows.map(r => r.receipt_handle)
      return resolve(receiptHandles)
    })
  })
  return p1
}

// WARN: if the message current is not inflight, changing the timeout will receive error 400
export async function resetAllTimeout (sqs:AWS.SQS, db:sqlite3.Database, queueName:string, queueUrl?:string):Promise<number> {
  const tableName = common.getTableName(queueName)
  let exists = await tableExists(db, queueName)
  let result = 0
  if (exists) {
    let results = await Promise.all([
      getAllReceiptHandles(sqs, db, queueName),
      queueUrl? queueUrl : common.getQueueUrl(sqs, queueName)
    ])
    let receiptHandles:string[] = results[0]
    let url = results[1]
    if (receiptHandles.length > 0) {
      await common.changeTimeout(sqs, url, receiptHandles, 1)
      result = receiptHandles.length
    }
  }
  return Promise.resolve(result)
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
