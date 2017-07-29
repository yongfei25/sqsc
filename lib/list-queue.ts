import * as AWS from 'aws-sdk'
import * as common from './common'

interface ListQueueParam {
  prefix:string
}

interface ListQueueResult {
  queueName:string,
  numOfVisible:number,
  numOfInvisible:number,
  numOfDelayed:number
}

export async function listQueue (sqs:AWS.SQS, param:ListQueueParam):Promise<ListQueueResult[]> {
  let data = await sqs.listQueues({ QueueNamePrefix: param.prefix }).promise()
  let result:ListQueueResult[] = []

  if (data.QueueUrls) {
    let promises = data.QueueUrls.map((url:string) => {
      return sqs.getQueueAttributes({
        QueueUrl: url,
        AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible', 'ApproximateNumberOfMessagesDelayed']
      }).promise().then((attr:AWS.SQS.Types.GetQueueAttributesResult) => {
        return {
          queueName: url.split('/').pop(),
          numOfVisible: parseInt(attr.Attributes['ApproximateNumberOfMessages']),
          numOfInvisible: parseInt(attr.Attributes['ApproximateNumberOfMessagesNotVisible']),
          numOfDelayed: parseInt(attr.Attributes['ApproximateNumberOfMessagesDelayed'])
        }
      })
    })
    result = await Promise.all(promises)
  }
  return result
}
