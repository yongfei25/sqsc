#!/usr/bin/env node
import {getSQS, recreateQueue} from '../lib/common'
import * as fs from 'fs'
import * as path from 'path'

let sqs:AWS.SQS = getSQS('test')
const accountId = '123456789012'
const host = 'http://0.0.0.0:4576'

async function populate () {
  try {
    // Create queues and populate SQS messages
    console.log('Reseting test queues.')
    let queues = await sqs.listQueues().promise()
    let result = await Promise.all([
      recreateQueue(sqs, `${host}/${accountId}/DevelopmentQueue`, queues.QueueUrls || []),
      recreateQueue(sqs, `${host}/${accountId}/DevelopmentErrorQueue`, queues.QueueUrls || [])
    ])
    // populate messages
    console.log('Populating SQS messages.')
    let messages:string[] = fs.readFileSync(path.join(__dirname, '../tests/fixtures/messages')).toString().split('\n')
    let promises = messages.map((msg:string) => {
      return sqs.sendMessage({ MessageBody: msg, QueueUrl: `${host}/${accountId}/DevelopmentQueue` }).promise()
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
