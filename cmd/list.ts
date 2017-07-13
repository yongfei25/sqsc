import * as yargs from 'yargs'

exports.command = 'ls [queue] [timeout]'
exports.desc = 'List all queues or messages'
exports.handler = function (argv:yargs.Arguments) {
  console.log(argv)
}
