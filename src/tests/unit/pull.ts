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
  const sqs:AWS.SQS = new AWS.SQS({
     accessKeyId: 'foo',
    secretAccessKey: 'bar',
    apiVersion: '2012-11-05',
    region: 'us-east-1',
    endpoint: 'http://0.0.0.0:4476'
  })
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
    let messages:string[] = fs.readFileSync(path.join(__dirname, '../../../fixtures/messages')).toString().split('\n')
    let promises = messages.map((msg:string) => {
      return sqs.sendMessage({ MessageBody: msg, QueueUrl: queueUrls[0] }).promise()
    })
    let send = await Promise.all(promises)
    return send
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

  it('should pull messages and store in sqlite', async function () {
    try {
      let totalInserted = await pull.pull(sqs, db, { queueName: 'TestQueue' })
      assert.equal(totalInserted, totalMessages)
    } catch (err) {
      console.log('Failed pulling')
      throw err
    }
    return new Promise((resolve, reject) => {
      db.get('select count(*) count from msg_TestQueue_us_east_1', (err, data) => {
        if (err) return reject(err)
        assert.equal(data.count, totalMessages)
        resolve()
      })
    })
  })
  it('should pull messages and store in sqlite for second time', async function () {
    let totalInserted = await pull.pull(sqs, db, { queueName: 'TestQueue' })
    assert.equal(totalInserted, totalMessages)
  })
  it('should have valid data structure for new records', async function () {
    return new Promise((resolve, reject) => {
      db.get('select * from msg_TestQueue_us_east_1', (err, row) => {
        if (err) return reject(err)
        assert.ok(JSON.parse(row.body).first_name)
        assert.notEqual(new Date(row.sent_timestamp), 'Invalid Date')
        assert.notEqual(new Date(row.first_receive_timestamp), 'Invalid Date')
        resolve()
      })
    })
  })
  it('should deduplicate messages', async function () {
    await pull.recreateMessageTable (db, 'TestQueue')
    let queueUrl = await common.getQueueUrl(sqs, 'TestQueue')
    let result = await sqs.receiveMessage({ QueueUrl: queueUrl, MaxNumberOfMessages: 10 }).promise()
    let inserted = await pull.insertMessages(db, 'TestQueue', result.Messages)
    assert.equal(inserted, 10)
    inserted = await pull.insertMessages(db, 'TestQueue', result.Messages)
    assert.equal(inserted, 0)
  })
})
