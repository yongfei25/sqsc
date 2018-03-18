import * as assert from 'assert'
import * as AWS from 'aws-sdk'
import * as sqlite3 from 'sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import { query, injectTableName, findQueueName } from '../../lib/query'
import * as common from '../../lib/common'
import * as pull from '../../lib/pull'
import * as localDb from '../../lib/local-db'

const dbPath = path.join(__dirname, '../temp/testdb')
let db:sqlite3.Database
const sqs:AWS.SQS = new AWS.SQS({
  accessKeyId: 'foo',
  secretAccessKey: 'bar',
  apiVersion: '2012-11-05',
  region: 'us-east-1',
  endpoint: 'http://0.0.0.0:4476'
})
const totalMessages = 50

async function populateQueueAndDb () {
  await new Promise((resolve, reject) => {
    db = new sqlite3.Database(':memory:')
    db.on('open', resolve)
    db.on('error', reject)
  })

  // Create queues and populate SQS messages
  let result = await Promise.all([
    common.recreateQueue(sqs, 'TestQueue'),
    common.recreateQueue(sqs, 'TestErrorQueue')
  ])
  let queueUrls = result.map((x:AWS.SQS.CreateQueueResult) => x.QueueUrl)
  // populate messages
  let messages:string[] = fs.readFileSync(path.join(__dirname, '../../../fixtures/messages')).toString().split('\n')
  let promises = messages.map((msg:string) => {
    return sqs.sendMessage({ MessageBody: msg, QueueUrl: queueUrls[0] }).promise()
  })
  let send = await Promise.all(promises)
  await pull.pull(sqs, db, { queueName: 'TestQueue' })
  await pull.pull(sqs, db, { queueName: 'TestErrorQueue' })
}

async function cleanup () {
  await new Promise((resolve, reject) => {
    db.on('close', resolve)
    db.on('error', reject)
    db.close()
  })
  let queues = await sqs.listQueues().promise()
  let result = await Promise.all([
    common.deleteQueue(sqs, 'TestQueue'),
    common.deleteQueue(sqs, 'TestErrorQueue')
  ])
  return result
}

describe('local-db', function () {
  before(populateQueueAndDb)
  after(cleanup)

  it('should return table name', function () {
    const tableName = localDb.getTableName('Test-Queue')
    assert.equal(tableName, 'msg_Test_Queue_us_east_1')
  })
  it('should list all message tables', async function () {
    let tables = await localDb.getMessageTables(db)
    assert(tables.includes('msg_TestQueue_us_east_1'))
    assert(tables.includes('msg_TestErrorQueue_us_east_1'))
  })
  it('should return the correct number of rows', async function () {
    const tableName = localDb.getTableName('TestQueue')
    const numRows = await localDb.countRows(db, tableName)
    assert.equal(numRows, 50)
  })
  it('should return 0 num of rows.', async function () {
    const tableName = localDb.getTableName('TestErrorQueue')
    const numRows = await localDb.countRows(db, tableName)
    assert.equal(numRows, 0)
  })
  it('should return last sent_timestamp', async function () {
    const tableName = localDb.getTableName('TestQueue')
    const lastTimestamp = await new Promise<Date>((resolve, reject) => {
      db.get('SELECT MAX(sent_timestamp) last FROM msg_TestQueue_us_east_1', (err, row) => {
        if (err) return reject(err)
        return resolve(new Date(row.last))
      })
    })
    const lastTimestampResult = await localDb.getLastSentTimestamp(db, tableName)
    assert.equal(lastTimestampResult.getTime(), lastTimestamp.getTime())
  })
  it('should return correct stat', async function () {
    const tableName = localDb.getTableName('TestQueue')
    const lastTimestamp = await localDb.getLastSentTimestamp(db, tableName)
    const stat = await localDb.getMessageTableStat(db, tableName)
    assert.equal(stat.numOfMessage, 50)
    assert.strictEqual(stat.lastMessageTimestamp.getTime(), lastTimestamp.getTime())
  })
  it('should return stats for all tables', async function () {
    const stats = await localDb.getAllMessageTableStats(db)
    assert(stats.length === 2)
  })
})

describe('query', function () {
  before(populateQueueAndDb)
  after(cleanup)

  it('should inject actual table name', function () {
    const userQuery = 'select * from development-queue limit 1'
    const queueName = findQueueName(userQuery)
    const tableName = localDb.getTableName(queueName)
    const sql = injectTableName(userQuery, queueName, tableName)
    const expected = 'select * from msg_development_queue_us_east_1 limit 1'
    assert.equal(sql, expected)
  })
  it('should list messages', async function () {
    let rows = await query(db, 'select sent_timestamp, body from TestQueue')
    let row = rows[0]
    assert.equal(rows.length, totalMessages)
    assert(row.sent_timestamp, 'Missing timestamp')
    assert(row.body, 'Missing body')
  })
  it('should limit number of messages', async function () {
    const limit = 5
    let rows = await query(db, 'select sent_timestamp, body from TestQueue limit 5')
    assert.equal(rows.length, 5)
  })
  it('should return matched messages', async function () {
    let rows = await query(db, `select sent_timestamp, body from TestQueue where body like '%Ronna%' limit 5`)
    assert(rows.length >= 1)
    assert(rows[0].body.includes('Ronna'))
  })
})
