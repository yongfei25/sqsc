import * as AWS from 'aws-sdk'
import * as sqlite3 from 'sqlite3'

function getTableName (queueName:string):string {
  return `msg_${queueName}`
}

async function recreateMessageTable (db:sqlite3.Database, queueName:string):Promise<sqlite3.RunResult> {
  let sql = `
    drop table if exists $tableName;
    create table $tableName (
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
    create index if not exists idx_sequence_number on $tableName (sequence_number);
    create index if not exists idx_sent_timestamp on $tableName (sent_timestamp);
  `
  return new Promise<sqlite3.RunResult>((resolve, reject) => {
    db.run(sql, { $tableName: getTableName(queueName) }, (err) => {
      if (err) return reject(err)
      return resolve()
    })
  })
}

async function insertMessages (db:sqlite3.Database, queueName:string, messages:AWS.SQS.Message[]):Promise<sqlite3.RunResult> {
  let sql = `insert or replace into ? values `
  let params = [getTableName(queueName)]
  for (let i=0; i<messages.length; i++) {
    sql += ('(?,?,?,?,?,?,?,?,?,?,?)')
    let m = messages[i]
    params.push(
      m.MessageId, m.ReceiptHandle, m.MD5OfBody, m.Body, m.Attributes['SentTimestamp'],
      m.Attributes['SenderId'], m.Attributes['ApproximateReceiveCount'], m.Attributes['ApproximateFirstReceiveTimestamp'],
      m.Attributes['MessageGroupId'], m.Attributes['MessageDeduplicationId'], m.Attributes['SequenceNumber']
    )
  }
  return new Promise<sqlite3.RunResult>((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

export async function pull (sqs:AWS.SQS, queueName:string) {

}
