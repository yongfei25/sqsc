# sqsc

## Development setup
```bash
# Starting localstack
export TMPDIR=/private$TMPDIR # MacOS only
docker-compose up -d

# Populating queues and messages for Development
export LOCALSTACK=1
bin/populate-dev.js
```
