import * as yargs from 'yargs'

exports.command = 'schema'
exports.desc = 'Display the local table schema.'
exports.handler = async function (argv:yargs.Arguments) {
  console.log(`
    id text
    receipt_handle text
    md5_body text
    body text
    sent_timestamp text
    sender_id text
    receive_count text
    first_receive_timestamp text
    group_id text
    deduplication_id text
    sequence_number text
  `)
}
