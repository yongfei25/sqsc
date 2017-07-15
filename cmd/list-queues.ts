import * as yargs from 'yargs'
import * as AWS from 'aws-sdk'
import * as columnify from 'columnify'
import * as common from '../lib/common'

exports.command = 'lq [prefix]'
exports.desc = 'List all queues'
exports.handler = function (argv:yargs.Arguments) {
  let sqs:AWS.SQS = common.getSQS(process.env.NODE_ENV)
  sqs.listQueues({
    QueueNamePrefix: argv.prefix || undefined
  }, (err, data) => {
    if (err) throw err
    if (data.QueueUrls) {
      let columns = data.QueueUrls.map(url => {
        const name = url.split('/').pop()
        return { name, url }
      })
      console.log(columnify(columns, { showHeaders: false }))
    }
  })
}
