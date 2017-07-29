import * as AWS from 'aws-sdk'
import * as common from './common'

interface CopyMessageRequest {
  sourceQueueName:string
  targetQueueName:string
  timeout:number
}

export async function copyMessage(sqs:AWS.SQS, param:CopyMessageRequest):Promise<AWS.SQS.Message[]> {
  let [sourceQueueUrl, targetQueueUrl] = await Promise.all([
    common.getQueueUrl(sqs, param.sourceQueueName),
    common.getQueueUrl(sqs, param.targetQueueName)
  ])
  if (!sourceQueueUrl) {
    console.error(`Queue ${param.sourceQueueName} does not exists.`)
    return
  } else if (!targetQueueUrl) {
    console.error(`Queue ${param.targetQueueName} does not exists.`)
    return
  }
  let receiveParam = { queueUrl: sourceQueueUrl, timeout: param.timeout }
  let allMessages = await common.receiveMessage(sqs, receiveParam, async function (messages, numReceived) {
    const entries = messages.map(message => {
      return {
        Id: message.MessageId,
        MessageBody: message.Body,
        MessageAttributes: message.MessageAttributes
      }
    })
    await sqs.sendMessageBatch({ Entries: entries, QueueUrl: targetQueueUrl }).promise()
    return true
  })
  return allMessages
}