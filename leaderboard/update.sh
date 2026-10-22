#!/usr/bin/env bash
# Updates the code (and table permissions) of the already-deployed leaderboard Lambda.
# Needs far fewer rights than deploy.sh: iam:PutRolePolicy on the role and
# lambda:UpdateFunctionCode + lambda:GetFunction on the function.
# Usage: ./leaderboard/update.sh [region]        (pick credentials with AWS_PROFILE=...)
set -euo pipefail

REGION="${1:-ap-southeast-1}"
NAME="monster-hunter-leaderboard"
TABLE="monster-hunter-scores"
HERE="$(cd "$(dirname "$0")" && pwd)"
export AWS_REGION="$REGION"

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
TABLE_ARN="arn:aws:dynamodb:$REGION:$ACCOUNT:table/$TABLE"

echo "Updating table permissions on role $NAME"
aws iam put-role-policy --role-name "$NAME" --policy-name table-access --policy-document \
  "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"dynamodb:Query\",\"dynamodb:GetItem\",\"dynamodb:PutItem\",\"dynamodb:UpdateItem\",\"dynamodb:ConditionCheckItem\"],\"Resource\":\"$TABLE_ARN\"}]}"

ZIP="$(mktemp -d)/lambda.zip"
(cd "$HERE/lambda" && zip -q "$ZIP" index.mjs app.mjs catalog.mjs)
echo "Uploading code to $NAME"
aws lambda update-function-code --function-name "$NAME" --zip-file "fileb://$ZIP" --query 'CodeSha256' --output text
aws lambda wait function-updated --function-name "$NAME"
echo "Done."
