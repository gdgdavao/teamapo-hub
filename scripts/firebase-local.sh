#!/usr/bin/env bash

set -euo pipefail

# Firebase Firestore emulation requires a JDK. Prefer the Homebrew runtime
# when it is installed, while keeping the script usable with system Java.
if command -v brew >/dev/null 2>&1 && brew --prefix openjdk@21 >/dev/null 2>&1; then
  java_prefix="$(brew --prefix openjdk@21)"
  export JAVA_HOME="${java_prefix}/libexec/openjdk.jdk/Contents/Home"
  export PATH="${java_prefix}/bin:${PATH}"
fi

exec bunx firebase-tools@latest "$@"
