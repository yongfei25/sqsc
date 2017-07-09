import * as assert from 'assert'
import * as AWS from 'aws-sdk'
import * as fs from 'fs'
import * as path from 'path'
import * as async from 'async'

const region = 'us-east-1'
const accountId = '123456789012'
const host = 'http://0.0.0.0:4576'
let sqs = new AWS.SQS({
  region: region
})
sqs.endpoint = new AWS.Endpoint(host)

async function deleteQueue (queueUrl:string, queueUrls:string[]) {
  if (queueUrls.includes(queueUrl)) {
    return await sqs.deleteQueue({ QueueUrl: queueUrl }).promise()
  } else {
    return Promise.resolve()
  }
}

async function recreateQueue (queueUrl:string, queueUrls:string[]) {
  await deleteQueue(queueUrl, queueUrls)
  let queueName:string | undefined = queueUrl.split('/').pop()
  if (!queueName) {
    throw new Error(`Unable to create queue from url ${queueUrl}`)
  }
  return sqs.createQueue({ QueueName: queueName }).promise()
}

describe('Basic command tests', function () {
  beforeEach(async function () {
    try {
      // Create queues and populate SQS messages
      console.log('Reseting test queues.')
      let queues = await sqs.listQueues().promise()
      let result = await Promise.all([
        recreateQueue(`${host}/${accountId}/TestQueue`, queues.QueueUrls || []),
        recreateQueue(`${host}/${accountId}/TestErrorQueue`, queues.QueueUrls || [])
      ])
      // populate messages
      console.log('Populating SQS messages.')
      let messages:string[] = fs.readFileSync(path.join(__dirname, '../fixtures/messages')).toString().split('\n')
      let promises = messages.map((msg:string) => {
        return sqs.sendMessage({ MessageBody: msg, QueueUrl: `${host}/${accountId}/TestQueue` }).promise()
      })
      let send = await Promise.all(promises)
    } catch (e) {
      console.error(e)
      throw e
    }
  })
  
  afterEach(async function () {
    console.log('Deleting queues')
    let queues = await sqs.listQueues().promise()
    let result = await Promise.all([
      deleteQueue(`${host}/${accountId}/TestQueue`, queues.QueueUrls || []),
      deleteQueue(`${host}/${accountId}/TestErrorQueue`, queues.QueueUrls || [])
    ])
  })
  
  it('Should pass', function (done) {
    assert(true)
    done()
  })
})
