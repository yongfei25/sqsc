import * as AWS from 'aws-sdk'
import * as columnify from 'columnify'
import * as common from './common'

export interface ListMessageRequest {
  limit?:number
  queueName:string
  print?:boolean
  timestamp?:boolean
  timeout?:number
}

export async function listMessage (sqs:AWS.SQS, param:ListMessageRequest):Promise<AWS.SQS.Message[]> {
  const queueUrl:string|null = await common.getQueueUrl(sqs, param.queueName)
  if (!queueUrl) {
    throw new Error(`Queue ${param.queueName} does not exists.`)
  }
  const numOfMessages:number = await common.getNumOfMessages(sqs, queueUrl)
  if (numOfMessages < 1) {
    return Promise.resolve([])
  }
  param.limit = param.limit || Number.MAX_SAFE_INTEGER
  let receiveParam = { queueUrl: queueUrl, timeout: param.timeout, resetTimeout: true }
  let allMessages = []
  await common.receiveMessage(sqs, receiveParam, async (messages, totalNumReceived) => {
    if (totalNumReceived > param.limit) {
      messages = messages.slice(0, Math.abs(param.limit - messages.length))
    }
    allMessages = allMessages.concat(messages)
    if (param.print) {
      print(messages, param.timestamp)
    }
    const shouldContinue = totalNumReceived < param.limit
    return shouldContinue
  })
  return Promise.resolve(allMessages)
}

function print (messages:AWS.SQS.Message[], timestamp:boolean = false):number {
  let cols = []
  messages.forEach((x:AWS.SQS.Message) => {
    if (x.Attributes) {
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
