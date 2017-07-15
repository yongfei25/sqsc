# sqsc

## Development setup
```bash
# Starting localstack
# Unix
docker-compose up -d
# MacOS
TMPDIR=/private$TMPDIR docker-compose up -d

# Populating queues and messages for Development
bin/populate-dev.js
```
