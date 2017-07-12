import * as AWS from 'aws-sdk'

export async function deleteQueue (sqs:AWS.SQS, queueUrl:string, queueUrls:string[]):Promise<any> {
  if (queueUrls.includes(queueUrl)) {
    return await sqs.deleteQueue({ QueueUrl: queueUrl }).promise()
  } else {
    return Promise.resolve()
  }
}

export async function recreateQueue (sqs:AWS.SQS, queueUrl:string, queueUrls:string[]):Promise<AWS.SQS.CreateQueueResult> {
  await deleteQueue(sqs, queueUrl, queueUrls)
  let queueName:string | undefined = queueUrl.split('/').pop()
  if (!queueName) {
    throw new Error(`Unable to create queue from url ${queueUrl}`)
  }
  return sqs.createQueue({ QueueName: queueName }).promise()
}

export async function getQueueUrl (sqs:AWS.SQS, queueName:string):Promise<string|null> {
  let result = await sqs.listQueues({ QueueNamePrefix: queueName }).promise()
  if (result.QueueUrls && result.QueueUrls.length > 0) {
    return Promise.resolve(result.QueueUrls[0])
  } else {
    return Promise.resolve(null)
  }
}
