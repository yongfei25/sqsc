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
    return Promise.resolve([])
  }
  const numOfMessages:number = await common.getNumOfMessages(sqs, queueUrl)
  if (numOfMessages < 1) {
    return Promise.resolve([])
  }
  param.limit = param.limit || Number.MAX_SAFE_INTEGER
  let count = 0
  let printCount = 0
  let receiveParam = { queueUrl: queueUrl, timeout: param.timeout }
  const allMessages = await common.receiveMessage(sqs, receiveParam, async (messages, numReceived) => {
    count = numReceived
    if (param.print) {
      printCount += print(messages, Math.min(param.limit, param.limit - printCount), param.timestamp)
    }
    const shouldContinue = count < param.limit
    return shouldContinue
  })
  return Promise.resolve(allMessages)
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
