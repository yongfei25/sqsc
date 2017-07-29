#!/usr/bin/env node
import * as yargs from 'yargs'
import * as path from 'path'

let blacklist = /(pull|query)/
yargs
  .commandDir(path.join(__dirname, '../cmd'), { exclude: blacklist })
  .demandCommand(1)
  .help()
  .argv
