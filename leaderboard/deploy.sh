#!/usr/bin/env bash
# Deploys (or updates) the leaderboard API: DynamoDB table + IAM role + Lambda with a public function URL.
# Requires: AWS CLI v2 with admin-level credentials, zip. Usage: ./leaderboard/deploy.sh [region]
# Already deployed and only the code changed? ./leaderboard/update.sh needs far fewer permissions.
set -euo pipefail

REGION="${1:-ap-southeast-1}"
NAME="monster-hunter-leaderboard"
TABLE="monster-hunter-scores"
ORIGINS='["https://oleg.manida.com","http://oleg.manida.com","https://pira.github.io","http://localhost:8000"]'
HERE="$(cd "$(dirname "$0")" && pwd)"
export AWS_REGION="$REGION"

# Only create the table when it really doesn't exist (an AccessDenied must not look like "missing").
if ! OUT=$(aws dynamodb describe-table --table-name "$TABLE" 2>&1 >/dev/null); then
  case "$OUT" in
    *ResourceNotFoundException*) ;;
    *) echo "$OUT" >&2; echo "Can't read table $TABLE with these credentials. To update an existing deployment, use ./leaderboard/update.sh" >&2; exit 1 ;;
  esac
  echo "Creating table $TABLE"
  aws dynamodb create-table --table-name "$TABLE" \
    --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
    --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST >/dev/null
  aws dynamodb wait table-exists --table-name "$TABLE"
  aws dynamodb update-time-to-live --table-name "$TABLE" \
    --time-to-live-specification Enabled=true,AttributeName=ttl >/dev/null
fi
TABLE_ARN=$(aws dynamodb describe-table --table-name "$TABLE" --query Table.TableArn --output text)

if ! aws iam get-role --role-name "$NAME" >/dev/null 2>&1; then
  echo "Creating role $NAME"
  aws iam create-role --role-name "$NAME" --assume-role-policy-document \
    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam attach-role-policy --role-name "$NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  sleep 10
fi
aws iam put-role-policy --role-name "$NAME" --policy-name table-access --policy-document \
  "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"dynamodb:Query\",\"dynamodb:GetItem\",\"dynamodb:PutItem\",\"dynamodb:UpdateItem\",\"dynamodb:ConditionCheckItem\"],\"Resource\":\"$TABLE_ARN\"}]}"
ROLE_ARN=$(aws iam get-role --role-name "$NAME" --query Role.Arn --output text)

ZIP="$(mktemp -d)/lambda.zip"
(cd "$HERE/lambda" && zip -q "$ZIP" index.mjs app.mjs catalog.mjs)

if aws lambda get-function --function-name "$NAME" >/dev/null 2>&1; then
  echo "Updating function code"
  aws lambda update-function-code --function-name "$NAME" --zip-file "fileb://$ZIP" >/dev/null
else
  echo "Creating function $NAME"
  SECRET=$(openssl rand -base64 32)
  aws lambda create-function --function-name "$NAME" --runtime nodejs22.x --handler index.handler \
    --role "$ROLE_ARN" --zip-file "fileb://$ZIP" --timeout 10 --memory-size 256 --architectures arm64 \
    --environment "Variables={TABLE_NAME=$TABLE,TOKEN_SECRET=$SECRET}" >/dev/null
  aws lambda wait function-active --function-name "$NAME"
  aws lambda create-function-url-config --function-name "$NAME" --auth-type NONE \
    --cors "{\"AllowOrigins\":$ORIGINS,\"AllowMethods\":[\"GET\",\"POST\"],\"AllowHeaders\":[\"content-type\"],\"MaxAge\":86400}" >/dev/null
  aws lambda add-permission --function-name "$NAME" --statement-id public-url \
    --action lambda:InvokeFunctionUrl --principal '*' --function-url-auth-type NONE >/dev/null
  aws lambda add-permission --function-name "$NAME" --statement-id public-invoke \
    --action lambda:InvokeFunction --principal '*' --invoked-via-function-url >/dev/null
  # Cap cost if the public URL gets hammered, and don't keep logs forever.
  aws lambda put-function-concurrency --function-name "$NAME" --reserved-concurrent-executions 10 >/dev/null
  aws logs create-log-group --log-group-name "/aws/lambda/$NAME" 2>/dev/null || true
  aws logs put-retention-policy --log-group-name "/aws/lambda/$NAME" --retention-in-days 30
fi

URL=$(aws lambda get-function-url-config --function-name "$NAME" --query FunctionUrl --output text)
echo "Leaderboard API: $URL"
echo "Put it in config.js -> leaderboardUrl"
