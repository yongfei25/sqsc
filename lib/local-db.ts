import * as sqlite3 from 'sqlite3'
import * as path from 'path'
import * as common from './common'

interface MessageTableStat {
  tableName:string
  numOfMessage:number
  lastMessageTimestamp:Date|null
}

function getTableRegionSuffix () {
  return common.getRegionOrDefault('us-east-1').replace(/\-/g, '_')
}

export function getTableName (queueName:string):string {
  const name = queueName.replace(/\-/g, '_')
  return `msg_${name}_${getTableRegionSuffix()}`
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

export function hasTable (db:sqlite3.Database, tableName:string):Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    db.get('SELECT name FROM sqlite_master WHERE type=? and name = ?', ['table', tableName], (err, row) => {
      if (err) return reject(err)
      return resolve((row && row.name === tableName))
    })
  })
}

export async function getMessageTables (db:sqlite3.Database):Promise<string[]> {
  const region = getTableRegionSuffix()
  const sql = 'SELECT name from sqlite_master where type=? AND name LIKE ?'
  const wildcard = `msg_%_${region}`
  return new Promise<string[]>((resolve, reject) => {
    db.all(sql, ['table', wildcard], (err, rows) => {
      if (err) return reject(err)
      resolve(rows.map(r => r.name))
    })
  })
}

export function countRows (db:sqlite3.Database, tableName:string):Promise<number> {
  return new Promise<number>((resolve, reject) => {
    db.get(`SELECT COUNT(*) numRows FROM ${tableName}`, (err, row) => {
      if (err) return reject(err)
      return resolve(row.numRows)
    })
  })
}

export function getLastSentTimestamp (db:sqlite3.Database, tableName):Promise<Date|null> {
  return new Promise<Date|null>((resolve, reject) => {
    db.get(`SELECT MAX(sent_timestamp) last_timestamp FROM ${tableName}`, (err, row) => {
      if (err) return reject(err)
      if (row.last_timestamp) {
        return resolve(new Date(row.last_timestamp))
      } else {
        return resolve(null)
      }
    })
  })
}

export async function getMessageTableStat (db:sqlite3.Database, tableName:string):Promise<MessageTableStat> {
  const tableExists = await hasTable(db, tableName)
  if (!tableExists) {
    throw new Error(`Table ${tableName} does not exists.`)
  }
  try {
    const [numOfMessage, lastMessageTimestamp] = await Promise.all([
      countRows(db, tableName),
      getLastSentTimestamp(db, tableName)
    ])
    return { tableName, numOfMessage, lastMessageTimestamp }
  } catch (err) {
    console.error(`Error fetching stat for message table ${tableName}`, err.message)
    throw err
  }
}

export async function getAllMessageTableStats (db:sqlite3.Database):Promise<MessageTableStat[]> {
  const tables = await getMessageTables(db)
  const promises = tables.map(table => getMessageTableStat(db, table))
  return await Promise.all(promises)
}
