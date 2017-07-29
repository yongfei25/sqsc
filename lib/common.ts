import * as AWS from 'aws-sdk'
import * as ini from 'ini'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as sqlite3 from 'sqlite3'

interface ReceiveMessageRequest {
  queueUrl: string
  timeout:number
}
interface ReceiveMessageProgress {
  (messages:AWS.SQS.Message[]):boolean
}
interface MessageMap {
  [index:string]:boolean
}

export class MessageDeduplicator {
  messageIds:MessageMap
  constructor() {
    this.messageIds = {}
  }
  addIfNotExist (messageId:string) {
    if (!this.messageIds[messageId]) {
      this.messageIds[messageId] = true
      return true
    } else {
      return false
    }
  }
}

export function getRegionOrDefault(defRegion:string):string {
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

export async function getDb():Promise<sqlite3.Database> {
  let filename = path.join(__dirname, '../main.db')
  let promise = new Promise<sqlite3.Database>((resolve, reject) => {
    let db = new sqlite3.Database(filename)
    db.on('error', (err) => reject(err))
    db.on('open', () => resolve(db))
  })
  return promise
}

export function getTableName (queueName:string):string {
  return `msg_${queueName}`
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
  let data = await sqs.getQueueUrl({ QueueName: queueName }).promise()
  if (!data.QueueUrl) {
    throw new Error(`QueueUrl does not exists for ${queueName}`)
  } else {
    return sqs.getQueueAttributes({
      QueueUrl: data.QueueUrl,
      AttributeNames: ['All']
    }).promise()
  }
}

export async function changeTimeout (sqs:AWS.SQS, queueUrl:string, receiptHandles:string[], timeout:number)
  :Promise<any> {
  if (process.env.LOCALSTACK) {
    // Can't seem to use batch API in localstack?
    // Getting "500: null" Error
    let promises = receiptHandles.map((r:string) => {
      return sqs.changeMessageVisibility({
        QueueUrl: queueUrl,
        ReceiptHandle: r,
        VisibilityTimeout: timeout
      }).promise()
    })
    return Promise.all(promises)
  } else {
    let entries = receiptHandles.map((r:string) => {
      return { Id: r, ReceiptHandle: r, VisibilityTimeout: timeout }
    })
    return sqs.changeMessageVisibilityBatch({
      QueueUrl: queueUrl,
      Entries: entries
    }).promise()
  }
}

// Receive messages from SQS, perform deduplication with message ID
// Reset timeout at the end of function
export async function receiveMessage (sqs:AWS.SQS, param:ReceiveMessageRequest, progress:ReceiveMessageProgress):Promise<AWS.SQS.Message[]> {
  const deduplicator = new MessageDeduplicator()
  let allMessages = []
  let shouldContinue = true
  while (shouldContinue) {
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
        }
      })
      shouldContinue = progress(messages)
    }
  }
  // Reset all visibility timeouts
  const receiptHandles = allMessages.map(m => m.ReceiptHandle)
  if (receiptHandles.length > 0) {
    try {
      await changeTimeout(sqs, param.queueUrl, receiptHandles, 1)
    } catch (err) {
      console.error('Error changing visibility timeout', err.message)
    }
  }
  return Promise.resolve(allMessages)
}