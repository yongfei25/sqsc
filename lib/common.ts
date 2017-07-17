import * as AWS from 'aws-sdk'
import * as ini from 'ini'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as sqlite3 from 'sqlite3'

export function getSQS (env?:string) {
  if (env && env === 'test') {
    return new AWS.SQS({
      region: 'us-east-1',
      endpoint: 'http://0.0.0.0:4576',
      apiVersion: '2012-11-05'
    })
  } else {
    try {
      const configPath = path.join(os.homedir(), '.aws', 'config')
      const profile = process.env.AWS_PROFILE || 'default'
      const config = ini.parse(fs.readFileSync(configPath, 'utf-8'))
      const region = config[`profile ${profile}`] ? config[`profile ${profile}`].region : 'us-east-1'
      return new AWS.SQS({
        apiVersion: '2012-11-05',
        region: region
      })
    } catch (e) {
      return new AWS.SQS({
        apiVersion: '2012-11-05',
        region: 'us-east-1'
      })
    }
  }
}

export async function getDb():Promise<sqlite3.Database> {
  let filename = path.join(__dirname, '../main.db')
  let promise = new Promise<sqlite3.Database>((resolve, reject) => {
    let db = new sqlite3.Database(filename)
    db.on('error', (err) => reject(err))
    db.on('open', () => resolve(db))
  })
  return promise
}

export async function deleteQueue (sqs:AWS.SQS, queueName:string):Promise<any> {
  let queueUrl = await getQueueUrl(sqs, queueName)
  if (queueUrl) {
    await sqs.deleteQueue({ QueueUrl: queueUrl }).promise()
  }
  return Promise.resolve()
}

export async function recreateQueue (sqs:AWS.SQS, queueName:string):Promise<AWS.SQS.CreateQueueResult|void> {
  await deleteQueue(sqs, queueName)
  return await sqs.createQueue({ QueueName: queueName }).promise()
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
    return sqs.getQueueAttributes({
      QueueUrl: data.QueueUrl,
      AttributeNames: ['All']
    }).promise()
  }
}

export async function changeTimeout (sqs:AWS.SQS, queueUrl:string, receiptHandles:string[], timeout:number)
  :Promise<any> {
  if (process.env.SQSC_NODE_ENV === 'test') {
    // Can't seem to use batch API in localstack?
    // Getting "500: null" Error
    let promises = receiptHandles.map((r:string) => {
      return sqs.changeMessageVisibility({
        QueueUrl: queueUrl,
        ReceiptHandle: r,
        VisibilityTimeout: timeout
      }).promise()
    })
    return Promise.all(promises)
  } else {
    let entries = receiptHandles.map((r:string) => {
      return { Id: r, ReceiptHandle: r, VisibilityTimeout: timeout }
    })
    return sqs.changeMessageVisibilityBatch({
      QueueUrl: queueUrl,
      Entries: entries
    }).promise()
  }
}
