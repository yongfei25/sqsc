import * as AWS from 'aws-sdk'

export function getSQS (env?:string) {
  if (env && env === 'test') {
    return new AWS.SQS({
      region: 'us-east-1',
      endpoint: 'http://0.0.0.0:4576'
    })
  } else {
    return new AWS.SQS()
  }
}

function queueExists(queueUrls:string[], queueName:string):boolean {
  queueUrls.forEach((url:string) => {
    if (url.split('/').pop() === queueName) {
      return true
    }
  })
  return false
}

export async function deleteQueue (sqs:AWS.SQS, queueUrl:string, queueUrls:string[]):Promise<any> {
  if (queueUrls.includes(queueUrl)) {
    return await sqs.deleteQueue({ QueueUrl: queueUrl }).promise()
  } else {
    return Promise.resolve()
  }
}

export async function recreateQueue (sqs:AWS.SQS, queueName:string):Promise<AWS.SQS.CreateQueueResult|void> {
  try {
    let queueUrl = await getQueueUrl(sqs, queueName)
    if (queueUrl) {
      await sqs.deleteQueue({ QueueUrl: queueUrl }).promise()
    }
    return await sqs.createQueue({ QueueName: queueName }).promise()
  } catch (err) {
    if (err.code === 'AWS.SimpleQueueService.NonExistentQueue') {
      return Promise.resolve()
    }
    throw err
  }
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
    return await sqs.getQueueAttributes({
      QueueUrl: data.QueueUrl,
      AttributeNames: ['All']
    }).promise()
  }
}
