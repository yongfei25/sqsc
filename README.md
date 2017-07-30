# sqsc
[![Build Status](https://travis-ci.org/yongfei25/s3events.svg?branch=master)](https://travis-ci.org/yongfei25/sqsc) 

`sqsc` is a command line tool for interacting with AWS SQS queues.

## Installation
```bash
npm install -g sqsc
```

## Features
### List queues: `sqsc lq [queue-prefix]`
![list queue](./media/list-queue.png)

### List messages: `sqsc ls <queue-name>`
![list messages](./media/list-message.png)

### Copy all messages to queue: `sqsc cp <from-queue-name> <to-queue-name>`
### Move all messages to queue: `sqsc mv <from-queue-name> <to-queue-name>`
![list messages](./media/copy-message.png)

### Describe queue: `sqsc describe <queue-name>`
![describe](./media/describe.png)

### SQL query: `sqsc query "SELECT body FROM <queue-name> WHERE body LIKE '%user%'"`
1. Run `sqsc pull <queue-name>` to store messages in local sqlite database.
2. To query, run `sqsc query <sql-query>`. Internally, `sqsc` will try to guess the queue name in the SQL.
3. To see what queues are available for query, run `sqsc list-table`.
4. To see the table schema, run `sqsc schema`.
![query](./media/query.png)

## Unsupported Features
- Server side encryption
- FIFO queue

## Development Setup
```bash
# Install dependencies
npm install

# Running tests
npm test

# Starting localstack
export TMPDIR=/private$TMPDIR # MacOS only
docker-compose up -d

# Populating queues and messages for Development
export LOCALSTACK=1
tsc -p .
bin/populate-dev.js
```
