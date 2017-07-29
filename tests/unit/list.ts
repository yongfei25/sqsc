import * as assert from 'assert'
import * as AWS from 'aws-sdk'
import * as sqlite3 from 'sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import * as list from '../../lib/list'
import * as common from '../../lib/common'
import * as pull from '../../lib/pull'

describe('List API', function () {
  const dbPath = path.join(__dirname, '../temp/testdb')
  let db:sqlite3.Database
  let sqs:AWS.SQS = common.getLocalSQS()
  let totalMessages = 50

  before(async function () {
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
    let messages:string[] = fs.readFileSync(path.join(__dirname, '../fixtures/messages')).toString().split('\n')
    let promises = messages.map((msg:string) => {
      return sqs.sendMessage({ MessageBody: msg, QueueUrl: queueUrls[0] }).promise()
    })
    let send = await Promise.all(promises)
    let totalInserted = await pull.pull(sqs, db, { queueName: 'TestQueue' })
    return totalInserted
  })
  after(async function () {
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
  })

  it('should list messages', async function () {
    let rows = await list.list(db, { queueName: 'TestQueue' })
    let row = rows[0]
    assert.equal(rows.length, totalMessages)
    assert(row.timestamp, 'Missing timestamp')
    assert(row.body, 'Missing body')
  })
  it('should limit number of messages', async function () {
    const limit = 5
    let rows = await list.list(db, { queueName: 'TestQueue', limit: limit })
    assert.equal(rows.length, limit)
  })
  it('should return matched messages', async function () {
    let rows = await list.list(db, { queueName: 'TestQueue', like: '%Ronna%' })
    assert(rows.length >= 1)
    assert(rows[0].body.includes('Ronna'))
  })
  it('should return correct order', async function () {
    let rows = await list.list(db, { queueName: 'TestQueue', limit: 5 })
    assert(rows[0].timestamp < rows[4].timestamp)
    rows = await list.list(db, { queueName: 'TestQueue', limit: 5, descending: true })
    assert(rows[0].timestamp > rows[4].timestamp)
  })
})
