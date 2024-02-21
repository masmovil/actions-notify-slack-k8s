#!/bin/sh -l

echo 'Running entrypoint'

ls -l /usr/local/go/bin

SLACK_ACCESS_TOKEN=${1} \
COMMIT_URL=${2} \
COMMIT_AUTHOR_USERNAME=${3} \
COMMIT_AUTHOR_EMAIL=${4} \
COMMIT_MESSAGE=${5} \
/usr/local/go/bin/go run /main.go

echo 'Running entrypoint done'
