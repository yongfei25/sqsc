import * as assert from 'assert'
import * as AWS from 'aws-sdk'
import * as sqlite3 from 'sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import * as pull from '../../lib/pull'
import * as common from '../../lib/common'
import {listMessage} from '../../lib/list-message'

describe('Pull API', function () {
  const dbPath = path.join(__dirname, '../temp/testdb')
  let db:sqlite3.Database
  let sqs:AWS.SQS
  let totalMessages = 50

  before(async function () {
    console.log('Opening DB')
    await new Promise((resolve, reject) => {
      db = new sqlite3.Database(':memory:')
      db.on('open', resolve)
      db.on('error', reject)
    })

    // Create queues and populate SQS messages
    sqs = common.getSQS(process.env.NODE_ENV)
    let result = await Promise.all([
      common.recreateQueue(sqs, 'TestQueue'),
      common.recreateQueue(sqs, 'TestErrorQueue')
    ])
    let queueUrls = result.map((x:AWS.SQS.CreateQueueResult) => x.QueueUrl)
    // populate messages
    console.log('Populating SQS messages.')
    let messages:string[] = fs.readFileSync(path.join(__dirname, '../fixtures/messages')).toString().split('\n')
    let promises = messages.map((msg:string) => {
      return sqs.sendMessage({ MessageBody: msg, QueueUrl: queueUrls[0] }).promise()
    })
    let send = await Promise.all(promises)
  })
  after(async function () {
    await new Promise((resolve, reject) => {
      db.on('close', resolve)
      db.on('error', reject)
      db.close()
    })
    console.log('Deleting queues')
    let queues = await sqs.listQueues().promise()
    let result = await Promise.all([
      common.deleteQueue(sqs, 'TestQueue'),
      common.deleteQueue(sqs, 'TestErrorQueue')
    ])
  })

  it('should create table for queue', async function () {
    let data = await pull.recreateMessageTable (db, 'TestQueue')
    db.get('select count(*) count from msg_TestQueue', (err, data) => {
      if (err) return Promise.reject(err)
      assert.equal(data.count, 0)
    })
  })
  it('should pull messages and store in sqlite', async function () {
    let totalInserted = await pull.pull(sqs, db, { queueName: 'TestQueue' })
    assert.equal(totalInserted, totalMessages)
    db.get('select count(*) count from msg_TestQueue', (err, data) => {
      if (err) return Promise.reject(err)
      assert.equal(data.count, totalMessages)
    })
  })
  it('should pull messages and store in sqlite for second time', async function () {
    let totalInserted = await pull.pull(sqs, db, { queueName: 'TestQueue' })
    assert.equal(totalInserted, totalMessages)
  })
  it('should have valid data structure for new records', async function () {
    db.get('select * from msg_TestQueue', (err, row) => {
      if (err) Promise.reject(err)
      assert.ok(JSON.parse(row.body).first_name)
      assert.notEqual(new Date(row.sent_timestamp), 'Invalid Date')
      assert.notEqual(new Date(row.first_receive_timestamp), 'Invalid Date')
    })
  })
})
