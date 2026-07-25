#!/usr/bin/env bash
# Appends a compact failure summary (matching log lines + artifact link) to
# $GITHUB_STEP_SUMMARY so maintainers can triage a failed CI job without
# opening the full raw log first.
#
# Usage:
#   scripts/ci-summarize-failure.sh <job-title> <artifact-name> <artifact-url> <log-file> [log-file ...]
#
# <artifact-name>/<artifact-url> may be empty strings if no artifact was
# uploaded (e.g. the log file didn't exist).

set -euo pipefail

TITLE="${1:?job title required}"
ARTIFACT_NAME="${2:-}"
ARTIFACT_URL="${3:-}"
shift 3 || { echo "usage: $0 <job-title> <artifact-name> <artifact-url> <log-file> [log-file ...]" >&2; exit 1; }

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <job-title> <artifact-name> <artifact-url> <log-file> [log-file ...]" >&2
  exit 1
fi

SUMMARY_TARGET="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
FAILURE_PATTERN='FAIL|✕|✗|error TS[0-9]|error\[|panicked at|test result: FAILED|Error:|ELIFECYCLE'

{
  echo "### ❌ ${TITLE}"
  echo

  found_match=0
  for log_file in "$@"; do
    if [ ! -f "$log_file" ]; then
      continue
    fi

    matches="$(grep -E -i "$FAILURE_PATTERN" "$log_file" 2>/dev/null | sed -n '1,20p' || true)"
    if [ -n "$matches" ]; then
      found_match=1
      echo "**${log_file}:**"
      echo '```'
      echo "$matches"
      echo '```'
      echo
    fi
  done

  if [ "$found_match" -eq 0 ]; then
    echo "_No specific failure lines detected automatically — see the full log artifact below._"
    echo
  fi

  if [ -n "$ARTIFACT_URL" ]; then
    echo "📄 **Full logs:** [${ARTIFACT_NAME}](${ARTIFACT_URL})"
  elif [ -n "$ARTIFACT_NAME" ]; then
    echo "📄 **Full logs:** \`${ARTIFACT_NAME}\` (see the Artifacts section of this run)"
  fi
  echo
} >> "$SUMMARY_TARGET"
