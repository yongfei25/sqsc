import * as AWS from 'aws-sdk'
import * as columnify from 'columnify'
import {getQueueUrl} from './common'

export interface ListMessageRequest {
  limit?:number,
  queueName:string,
  print?:boolean,
  timestamp?:boolean,
  timeout?:number
}

export async function listMessage (sqs:AWS.SQS, param:ListMessageRequest):Promise<AWS.SQS.Message[]> {
  let queueUrl:string|null = await getQueueUrl(sqs, param.queueName)
  let count:number = 0
  let messages:AWS.SQS.Message[] = []
  if (!queueUrl) {
    return Promise.resolve(messages)
  }
  let attributes = await sqs.getQueueAttributes({
    QueueUrl: queueUrl,
    AttributeNames: ['ApproximateNumberOfMessages']
  }).promise()

  let numOfMessages:number = attributes.Attributes ? parseInt(attributes.Attributes.ApproximateNumberOfMessages) : Number.MAX_SAFE_INTEGER;
  let printCount = 0
  param.limit = param.limit || Number.MAX_SAFE_INTEGER
  while (count < param.limit && count < numOfMessages) {
    let data = await sqs.receiveMessage({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 0,
      VisibilityTimeout: param.timeout || 5,
      AttributeNames: ['All']
    }).promise()
    if (data.Messages) {
      count += data.Messages.length
      messages = messages.concat(data.Messages)
      if (param.print) {
        printCount += print(data.Messages, Math.min(param.limit, param.limit - printCount), param.timestamp)
      }
    }
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
