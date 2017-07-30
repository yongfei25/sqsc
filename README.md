# sqsc
[![Build Status](https://travis-ci.org/yongfei25/s3events.svg?branch=master)](https://travis-ci.org/yongfei25/sqsc) 

`sqsc` is a command line tool for interacting with SQS queues.

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

## Development setup
```bash
# Starting localstack
export TMPDIR=/private$TMPDIR # MacOS only
docker-compose up -d
npm test

# Populating queues and messages for Development
export LOCALSTACK=1
bin/populate-dev.js
```
