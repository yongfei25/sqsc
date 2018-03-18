import * as yargs from 'yargs'
import * as columnify from 'columnify'
import * as common from '../lib/common'

exports.command = 'describe <queue-name>'
exports.desc = 'Show SQS queue attributes'
exports.handler = function (argv:yargs.Arguments) {
  const sqs:AWS.SQS = common.getSQS()
  common.getQueueAttributes(sqs, argv.queueName).then((getAttributes) => {
    const attr = getAttributes.Attributes 
    for (let key in attr) {
      if (key.endsWith('Timestamp')) {
        console.log(`${key} = ${toDateString(attr[key])}`)
      } else {
        console.log(`${key} = ${attr[key]}`)
      }
    }
  }).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

function toDateString(s:string):string {
  let d = new Date(parseInt(s) * 1000)
  return d.toISOString()
}
