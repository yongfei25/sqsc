import * as assert from 'assert'
import * as AWS from 'aws-sdk'
import * as fs from 'fs'
import * as path from 'path'
import * as async from 'async'
import * as common from '../../lib/common'
import {listMessage} from '../../lib/list-message'

describe('Basic command tests', function () {
  const sqs:AWS.SQS = new AWS.SQS({
    apiVersion: '2012-11-05',
    region: 'us-east-1',
    endpoint: 'http://0.0.0.0:5576'
  })

  before(async function () {
    try {
      // Create queues and populate SQS messages
      console.log('Reseting test queues.')
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
    } catch (e) {
      console.error(e)
      throw e
    }
  })

  after(async function () {
    console.log('Deleting queues')
    let queues = await sqs.listQueues().promise()
    let result = await Promise.all([
      common.deleteQueue(sqs, 'TestQueue'),
      common.deleteQueue(sqs, 'TestErrorQueue')
    ])
  })

  it('Should list all messages', async function () {
    let messages = await listMessage(sqs, { queueName: 'TestQueue' })
    assert.equal(messages.length, 50)
  })
})
