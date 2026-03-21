#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path')
PROJECT_DIR=$(echo "$INPUT" | jq -r '.cwd')

cd "$PROJECT_DIR" && bun run format -- "$FILE_PATH" 2>&1
exit 0
