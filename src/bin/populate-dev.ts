#!/usr/bin/env node
import * as common from '../lib/common'
import * as fs from 'fs'
import * as path from 'path'

let sqs:AWS.SQS = common.getLocalSQS()

async function populate () {
  try {
    // Create queues and populate SQS messages
    console.log('Reseting test queues.')
    let queues = await sqs.listQueues().promise()
    let result = await Promise.all([
      common.recreateQueue(sqs, 'DevelopmentQueue'),
      common.recreateQueue(sqs, 'DevelopmentErrorQueue'),
      common.recreateQueue(sqs, 'CustomerQueue'),
      common.recreateQueue(sqs, 'CustomerErrorQueue')
    ])
    let queueUrls = result.map((x:AWS.SQS.CreateQueueResult) => x.QueueUrl)
    // populate messages
    console.log('Populating SQS messages.')
    let messages:string[] = fs.readFileSync(path.join(__dirname, '../tests/fixtures/messages')).toString().split('\n')
    let promises = messages.map((msg:string) => {
      return sqs.sendMessage({ MessageBody: msg, QueueUrl: queueUrls[0] }).promise()
    })
    let send = await Promise.all(promises)
  } catch (e) {
    console.error(e)
    throw e
  }
}

populate().then(() => {
  console.log('Done')
})
