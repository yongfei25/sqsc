import * as AWS from 'aws-sdk'
import * as common from './common'

interface CopyMessageRequest {
  sourceQueueName:string
  targetQueueName:string
  timeout:number,
  move?:boolean
}

interface CopyMessageProgress {
  (messages:AWS.SQS.Message[]):void
}

export async function copyMessage(sqs:AWS.SQS, param:CopyMessageRequest, progress?:CopyMessageProgress):Promise<AWS.SQS.Message[]> {
  let [sourceQueueUrl, targetQueueUrl] = await Promise.all([
    common.getQueueUrl(sqs, param.sourceQueueName),
    common.getQueueUrl(sqs, param.targetQueueName)
  ])
  if (!sourceQueueUrl) {
    throw new Error(`Queue ${param.sourceQueueName} does not exists.`)
  } else if (!targetQueueUrl) {
    throw new Error(`Queue ${param.targetQueueName} does not exists.`)
  }
  let receiveParam = {
    queueUrl: sourceQueueUrl,
    timeout: param.timeout,
    // Existing message will moved so no need to reset timeout
    resetTimeout: !param.move
  }
  let allMessages = await common.receiveMessage(sqs, receiveParam, async function (messages, numReceived) {
    const entries = messages.map(message => {
      return {
        Id: message.MessageId,
        MessageBody: message.Body,
        MessageAttributes: message.MessageAttributes
      }
    })
    await sqs.sendMessageBatch({ Entries: entries, QueueUrl: targetQueueUrl }).promise()
    if (param.move) {
      const rmEntries = messages.map(message => {
        return {
          Id: message.MessageId,
          ReceiptHandle: message.ReceiptHandle
        }
      })
      await sqs.deleteMessageBatch({
        QueueUrl: sourceQueueUrl,
        Entries: rmEntries
      }).promise()
    }
    if (progress) {
      await progress(messages)
    }
    return true
  })
  return allMessages
}
