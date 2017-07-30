#!/usr/bin/env node
import * as yargs from 'yargs'
import * as path from 'path'

yargs
  .commandDir(path.join(__dirname, '../cmd'))
  .demandCommand(1)
  .help()
  .argv
