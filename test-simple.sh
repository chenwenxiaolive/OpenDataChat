#!/bin/bash
curl -X POST 'http://localhost:54891/api/agent' \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hello"}],"availableFiles":[]}'
