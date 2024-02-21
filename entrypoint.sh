#!/bin/sh -l

echo 'Running entrypoint'

ls -l /usr/local/go/bin

SLACK_ACCESS_TOKEN=${1} \
SLACK_CHANNEL_NAME=${2} \
COMMIT_URL=${3} \
COMMIT_AUTHOR_USERNAME=${4} \
COMMIT_AUTHOR_EMAIL=${5} \
COMMIT_MESSAGE=${6} \
/usr/local/go/bin/go run /main.go

echo 'Running entrypoint done'
