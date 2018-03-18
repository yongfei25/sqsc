import * as yargs from 'yargs'
import * as path from 'path'

exports.command = 'version'
exports.desc = 'Display current sqsc version.'
exports.handler = async function (argv:yargs.Arguments) {
  console.log(require(path.join(__dirname, '../package.json')).version)
}
