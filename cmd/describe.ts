import * as yargs from 'yargs'
import * as columnify from 'columnify'
import * as common from '../lib/common'

exports.command = 'describe <queue-name>'
exports.desc = 'Show SQS queue attributes'
exports.handler = async function (argv:yargs.Arguments) {
  const sqs:AWS.SQS = common.getSQS()
  const getAttributes = await common.getQueueAttributes(sqs, argv.queueName)
  const attr = getAttributes.Attributes 
  for (let key in attr) {
    if (key.endsWith('Timestamp')) {
      console.log(`${key} = ${toDateString(attr[key])}`)
    } else {
      console.log(`${key} = ${attr[key]}`)
    }
  }
}

function toDateString(s:string):string {
  let d = new Date(parseInt(s) * 1000)
  return d.toISOString()
}
