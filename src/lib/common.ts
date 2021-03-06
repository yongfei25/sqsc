import * as AWS from 'aws-sdk'
import * as ini from 'ini'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as crypto from 'crypto'
import * as sqlite3 from 'sqlite3'

const createChunks = require('lodash.chunk');

interface ReceiveMessageRequest {
  queueUrl: string
  timeout:number
  resetTimeout?:boolean
}
interface ReceiveMessageProgress {
  (messages:AWS.SQS.Message[], numReceived:number):Promise<boolean>
}
interface MessageMap {
  [index:string]:boolean
}

export class MessageDeduplicator {
  messageIds:MessageMap
  constructor() {
    this.messageIds = {}
  }
  addIfNotExist (messageId:string):boolean {
    if (!this.messageIds[messageId]) {
      this.messageIds[messageId] = true
      return true
    } else {
      return false
    }
  }
}

export function getRegionOrDefault(defRegion:string):string {
  if (process.env.LOCALSTACK) {
    return 'us-east-1'
  } else {
    try {
      const configPath = path.join(os.homedir(), '.aws', 'config')
      const profile = process.env.AWS_PROFILE || 'default'
      const config = ini.parse(fs.readFileSync(configPath, 'utf-8'))
      let region = defRegion
      if (config[`profile ${profile}`]) {
        region = config[`profile ${profile}`].region
      } else if (config[profile]) {
        region = config[profile].region
      }
      return region
    } catch (err) {
      return defRegion
    }
  }
}

export function getSQS ():AWS.SQS {
  if (process.env.LOCALSTACK) {
    return getLocalSQS()
  } else {
    return new AWS.SQS({
      apiVersion: '2012-11-05',
      region: getRegionOrDefault('us-east-1')
    })
  }
}

export function getLocalSQS ():AWS.SQS {
  const sqs = new AWS.SQS({
    apiVersion: '2012-11-05',
    region: 'us-east-1',
    endpoint: 'http://0.0.0.0:4576'
  })
  return sqs
}

export function convertTs (ts:string):string {
  let d = new Date(parseInt(ts))
  let ds = d.toISOString()
  return ds.substring(0,10) + ' ' + ds.substring(11, ds.length-1)
}

export function getDateString (d:Date):string {
  let ds = d.toISOString()
  return ds.substring(0,10) + ' ' + ds.substring(11, ds.length-1)
}

export async function deleteQueue (sqs:AWS.SQS, queueName:string):Promise<any> {
  let queueUrl = await getQueueUrl(sqs, queueName)
  if (queueUrl) {
    await sqs.deleteQueue({ QueueUrl: queueUrl }).promise()
  }
  return Promise.resolve()
}

export async function recreateQueue (sqs:AWS.SQS, queueName:string):Promise<AWS.SQS.CreateQueueResult|void> {
  await deleteQueue(sqs, queueName)
  return await sqs.createQueue({ QueueName: queueName }).promise()
}

export async function getQueueUrl (sqs:AWS.SQS, queueName:string):Promise<string|null> {
  let result = await sqs.listQueues({ QueueNamePrefix: queueName }).promise()
  if (result.QueueUrls && result.QueueUrls.length > 0) {
    return Promise.resolve(result.QueueUrls[0])
  } else {
    return Promise.resolve(null)
  }
}

export async function getQueueAttributes (sqs:AWS.SQS, queueName:string):Promise<AWS.SQS.Types.GetQueueAttributesResult> {
  const queueUrl:string|null = await getQueueUrl(sqs, queueName)
  if (!queueUrl) {
    throw new Error(`Queue ${queueName} does not exists.`)
  }
  return sqs.getQueueAttributes({
    QueueUrl: queueUrl,
    AttributeNames: ['All']
  }).promise()
}

export function getBatchItemId (str:string):string {
  return crypto.createHash('md5').update((new Date()).toISOString() + str).digest("hex")
}

export async function changeTimeout (sqs:AWS.SQS, queueUrl:string, receiptHandles:string[], timeout:number)
  :Promise<any> {
  if (process.env.LOCALSTACK) {
    // Can't seem to use batch API in localstack?
    // Getting "500: null" Error
    const promises = receiptHandles.map((r:string) => {
      return sqs.changeMessageVisibility({
        QueueUrl: queueUrl,
        ReceiptHandle: r,
        VisibilityTimeout: timeout
      }).promise()
    })
    return Promise.all(promises)
  } else {
    const entries = receiptHandles.map((r:string) => {
      return { Id: getBatchItemId(r), ReceiptHandle: r, VisibilityTimeout: timeout }
    })
    const chunks = createChunks(entries, 10)
    const promises = chunks.map((batchEntries) => {
      return sqs.changeMessageVisibilityBatch({
        QueueUrl: queueUrl,
        Entries: batchEntries
      }).promise()
    })
    return await Promise.all(promises)
  }
}

export async function getNumOfMessages (sqs:AWS.SQS, queueUrl:string):Promise<number> {
  const attributes = await sqs.getQueueAttributes({
    QueueUrl: queueUrl,
    AttributeNames: ['ApproximateNumberOfMessages']
  }).promise()
  const numOfMessages:number = attributes.Attributes ? parseInt(attributes.Attributes.ApproximateNumberOfMessages) : Number.MAX_SAFE_INTEGER;
  return numOfMessages
}

// Receive messages from SQS, perform deduplication with message ID
// Reset timeout at the end of function
// The loop continues until it received all messages in the queue, or progress returns false
export async function receiveMessage (sqs:AWS.SQS, param:ReceiveMessageRequest, progress:ReceiveMessageProgress):Promise<AWS.SQS.Message[]> {
  const numOfMessages:number = await getNumOfMessages(sqs, param.queueUrl)
  if (numOfMessages < 1) {
    return Promise.resolve([])
  }
  const deduplicator = new MessageDeduplicator()
  let count = 0
  let allMessages = []
  let shouldContinue = true
  while (shouldContinue && count < numOfMessages) {
    let data = await sqs.receiveMessage({
      QueueUrl: param.queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 0,
      VisibilityTimeout: param.timeout,
      AttributeNames: ['All']
    }).promise()
    if (data.Messages) {
      let messages = []
      data.Messages.forEach((message) => {
        if (deduplicator.addIfNotExist(message.MessageId)) {
          messages.push(message)
          allMessages.push(message)
          count += 1
        }
      })
      shouldContinue = await progress(messages, count)
    }
  }
  // Reset all visibility timeouts
  if (param.resetTimeout) {
    const receiptHandles = allMessages.map(m => m.ReceiptHandle)
    if (receiptHandles.length > 0) {
      try {
        await changeTimeout(sqs, param.queueUrl, receiptHandles, 1)
      } catch (err) {
        console.error('Error changing visibility timeout', err.message)
      }
    }
  }
  return Promise.resolve(allMessages)
}
