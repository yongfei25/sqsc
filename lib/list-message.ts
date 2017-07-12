import {getQueueUrl} from './common'
import * as AWS from 'aws-sdk'

export interface ListMessageRequest {
  limit?:number,
  queueName:string,
  print?:boolean,
  timestamp?:boolean
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
  param.limit = param.limit || Number.MAX_SAFE_INTEGER
  while (count < param.limit && count < numOfMessages) {
    let data = await sqs.receiveMessage({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 0,
      VisibilityTimeout: 5,
      AttributeNames: ['All']
    }).promise()
    if (data.Messages) {
      count += data.Messages.length
      data.Messages.forEach((x:AWS.SQS.Message) => {
        messages.push(x)
        if (param.print && x.Attributes) {
          if (param.timestamp) {
            console.log(`${new Date(parseInt(x.Attributes.SentTimestamp)).toISOString()} ${x.Body}`)
          } else {
            console.log(x.Body)
          }
        }
      })
    }
  }
  return Promise.resolve(messages)
}
