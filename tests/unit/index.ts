import * as assert from 'assert'
import * as AWS from 'aws-sdk'
import * as fs from 'fs'
import * as path from 'path'
import * as async from 'async'
import * as common from '../../lib/common'
import { listMessage } from '../../lib/list-message'
import { copyMessage } from '../../lib/copy-message'

const sqs:AWS.SQS = new AWS.SQS({
  accessKeyId: 'foo',
  secretAccessKey: 'bar',
  apiVersion: '2012-11-05',
  region: 'us-east-1',
  endpoint: 'http://0.0.0.0:4476'
})

async function recreateQueueAndData () {
  try {
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
  } catch (e) {
    console.error(e)
    throw e
  }
}

async function removeQueues () {
  let queues = await sqs.listQueues().promise()
  let result = await Promise.all([
    common.deleteQueue(sqs, 'TestQueue'),
    common.deleteQueue(sqs, 'TestErrorQueue')
  ])
}

describe('Common lib', function () {
  before(recreateQueueAndData)
  after(removeQueues)
  it('Should receive 20 messages', async function () {
    const queueUrl = await common.getQueueUrl(sqs, 'TestQueue')
    const timeout = 5
    let count = 0
    let allMessages = await common.receiveMessage(sqs, { queueUrl, timeout }, async (messages) => {
      count += messages.length
      return count < 20
    })
    assert.equal(allMessages.length, 20)
  })
})

describe('list-message', function () {
  beforeEach(recreateQueueAndData)
  afterEach(removeQueues)
  it('Should list all messages', async function () {
    let messages = await listMessage(sqs, { queueName: 'TestQueue' })
    assert.equal(messages.length, 50)
  })
  it('Should list 5 messages', async function () {
    let messages = await listMessage(sqs, { queueName: 'TestQueue', limit: 5 })
    assert.equal(messages.length, 5)
  })
  it('Should list no message', async function () {
    let messages = await listMessage(sqs, { queueName: 'TestErrorQueue' })
    assert.equal(messages.length, 0)
  })
})

describe('copy-message', function () {
  before(recreateQueueAndData)
  after(removeQueues)
  it('Should copy no message', async function () {
    const messages = await copyMessage(sqs, {
      sourceQueueName: 'TestErrorQueue',
      targetQueueName: 'TestQueue',
      timeout: 30
    })
    assert.equal(messages.length, 0)
  })
  it('Should return messages copied', async function () {
    const messages = await copyMessage(sqs, {
      sourceQueueName: 'TestQueue',
      targetQueueName: 'TestErrorQueue',
      timeout: 30
    })
    assert.equal(messages.length, 50)
  })
  it('should copy messages to target queue', async function () {
    const queueUrl = await common.getQueueUrl(sqs, 'TestErrorQueue')
    const numOfMessage = await common.getNumOfMessages(sqs, queueUrl)
    assert.equal(numOfMessage, 50)
  })
})

describe('move-message', function () {
  before(recreateQueueAndData)
  after(removeQueues)
  it('should moves messages to target queue', async function () {
    const messages = await copyMessage(sqs, {
      sourceQueueName: 'TestQueue',
      targetQueueName: 'TestErrorQueue',
      timeout: 30,
      move: true
    })
    let queueUrl = await common.getQueueUrl(sqs, 'TestErrorQueue')
    let numOfMessage = await common.getNumOfMessages(sqs, queueUrl)
    assert.equal(numOfMessage, 50)
  })
  it('should not have any messages in source queue', async function () {
    let queueUrl = await common.getQueueUrl(sqs, 'TestQueue')
    let numOfMessage = await common.getNumOfMessages(sqs, queueUrl)
    assert.equal(numOfMessage, 0)
  })
})

describe('MessageDeduplicator', function () {
  const deduplicator = new common.MessageDeduplicator()
  it('should add message', function () {
    const ret = deduplicator.addIfNotExist('firstMessage')
    assert.equal(ret, true)
    assert.equal(deduplicator.messageIds['firstMessage'], true)
  })
  it('should not add duplicated message', function () {
    const ret = deduplicator.addIfNotExist('firstMessage')
    assert.equal(ret, false)
    assert.equal(deduplicator.messageIds['firstMessage'], true)
  })
})
