import * as AWS from 'aws-sdk'
import * as columnify from 'columnify'
import * as common from './common'

export interface ListMessageRequest {
  limit?:number,
  queueName:string,
  print?:boolean,
  timestamp?:boolean,
  timeout?:number
}

interface MessageMap {
  [index:string]:boolean
}

class MessageDeduplicator {
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

async function getNumOfMessages (sqs:AWS.SQS, queueUrl:string):Promise<number> {
  const attributes = await sqs.getQueueAttributes({
    QueueUrl: queueUrl,
    AttributeNames: ['ApproximateNumberOfMessages']
  }).promise()
  const numOfMessages:number = attributes.Attributes ? parseInt(attributes.Attributes.ApproximateNumberOfMessages) : Number.MAX_SAFE_INTEGER;
  return numOfMessages
}

export async function listMessage (sqs:AWS.SQS, param:ListMessageRequest):Promise<AWS.SQS.Message[]> {
  const queueUrl:string|null = await common.getQueueUrl(sqs, param.queueName)
  if (!queueUrl) {
    return Promise.resolve([])
  }
  const numOfMessages:number = await getNumOfMessages(sqs, queueUrl)
  if (numOfMessages < 1) {
    return Promise.resolve([])
  }
  const deduplicator = new MessageDeduplicator()
  let count = 0
  let messages:AWS.SQS.Message[] = []
  let printCount = 0
  param.limit = param.limit || Number.MAX_SAFE_INTEGER
  while (count < param.limit && count < numOfMessages) {
    let data = await sqs.receiveMessage({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 0,
      VisibilityTimeout: param.timeout || 30,
      AttributeNames: ['All']
    }).promise()
    if (data.Messages) {
      data.Messages.forEach((message) => {
        if (deduplicator.addIfNotExist(message.MessageId)) {
          count +=1
          messages.push(message)
        }
      })
      if (param.print) {
        printCount += print(data.Messages, Math.min(param.limit, param.limit - printCount), param.timestamp)
      }
    }
  }
  // Reset all visibility timeouts
  const receiptHandles = messages.map(m => m.ReceiptHandle)
  try {
    await common.changeTimeout(sqs, queueUrl, receiptHandles, 1)
  } catch (err) {
    console.error(err)
  }
  return Promise.resolve(messages)
}

function print (messages:AWS.SQS.Message[], limit:number, timestamp:boolean = false):number {
  let printCount = 0
  let cols = []
  messages.forEach((x:AWS.SQS.Message) => {
    if (x.Attributes && printCount < limit) {
      printCount += 1
      cols.push({
        timestamp: new Date(parseInt(x.Attributes.SentTimestamp)).toISOString(),
        body: x.Body
      })
    }
  })
  let show = []
  if (timestamp) show.push('timestamp')
  show.push('body')
  console.log(columnify(cols, {
    showHeaders: false,
    columns: show
  }))
  return cols.length
}
