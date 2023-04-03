#!/usr/bin/env bash

# Common Script Header Begin
# Tips: all the quotes  --> "'`
# Tips: other chars --> ~

# https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
# set -Eeuo pipefail

set -Eeuo pipefail

trap cleanup SIGINT SIGTERM ERR #EXIT

cleanup() {
  trap - SIGINT SIGTERM ERR #EXIT
  echo "** Trapped SIGINT or SIGTERM or ERR **"
  # shellcheck disable=SC2046
  [[ -z "$(jobs -p)" ]] || kill $(jobs -p)
}

UNAME_S=$(uname -s)
readonly UNAME_S

readlink_() {
  if [[ $UNAME_S == "Darwin" ]]; then
    (which greadlink >/dev/null 2>&1 || brew install coreutils >/dev/null 2>&1)
    greadlink "$@"
  else
    readlink "$@"
  fi
}

getScriptDir() {
  local lScriptPath="$1"
  local ls
  local link
  # Need this for relative symlinks.
  while [ -h "${lScriptPath}" ]; do
    ls="$(ls -ld "${lScriptPath}")"
    link="$(expr "${ls}" : '.*-> \(.*\)$')"
    if expr "${link}" : '/.*' >/dev/null; then
      lScriptPath="${link}"
    else
      lScriptPath="$(dirname "${lScriptPath}")/${link}"
    fi
  done
  readlink_ -f "${lScriptPath%/*}"
}

current_dir="$(pwd)"
readonly current_dir
script_path="$(readlink_ -f "${BASH_SOURCE[0]}")"
readonly script_path
script_dir="$(getScriptDir "${script_path}")"
readonly script_dir
script_file="$(basename "${script_path}")"
readonly script_file
script_name="${script_file%\.*}"
readonly script_name
script_ext="$([[ ${script_file} == *.* ]] && echo ".${script_file##*.}" || echo '')"
readonly script_ext

initLog() {
  mkdir -p "${script_log_dir}"
}

sAPPS_PATH() {
  local -r APPS_DIR_NAME=${1:-APPs}
  if [ -d "${APPS_PATH-}" ]; then
    echo "APPS_PATH by ENV [${APPS_PATH}]"
  else
    APPS_PATH="${HOME}/${APPS_DIR_NAME}"
    [ -d "/data" ] && APPS_PATH="/data/${APPS_DIR_NAME}"
    [ -d "/code" ] && APPS_PATH="/code/${APPS_DIR_NAME}"
    echo "APPS_PATH [${APPS_PATH}]"
  fi
  mkdir -p "${APPS_PATH}"
}

architectureOs() {
  uname -m
}

uppercase(){
    echo "$@" | awk '{print toupper($0)}'
}

zig_i_darwin() {
  sAPPS_PATH
  local -r TOOL_NAME="Zig"
  local -r APP_PATH="${APPS_PATH}/${TOOL_NAME}"
  local -r ZSHRC_PATH="${HOME}/.zshrc"
  local -r lLinuxArchitecture=$(architectureOs)
  local lArchitecture=${lLinuxArchitecture}
  case ${lLinuxArchitecture} in
    arm64*)
      lArchitecture="aarch64"
      ;;
  esac
  cd "${APPS_PATH}"
  JQ_SEARCH=.master.\"$lArchitecture-macos\".tarball
  ZIG_URL=$(curl -s https://ziglang.org/download/index.json | jq -r "$JQ_SEARCH")
  echo "$ZIG_URL"
  curl "$ZIG_URL" -o zig.tar.xz
  tar -xf zig.tar.xz
  rm zig.tar.xz
  rm -rf "$APP_PATH"
  mv zig-macos* "$APP_PATH"
  export PATH="${APP_PATH}${PATH:+:$PATH}"
  sed -i '' "/### +++ $(uppercase "${TOOL_NAME}") +++ ###/,/### --- $(uppercase "${TOOL_NAME}") --- ###/d" "${ZSHRC_PATH}"
  {
    echo "### +++ $(uppercase "${TOOL_NAME}") +++ ###"
    echo "[ -d \"${APP_PATH}\" ] && export PATH=\"${APP_PATH}\${PATH:+:\$PATH}\""
    echo "### --- $(uppercase "${TOOL_NAME}") --- ###"
  } >>"${ZSHRC_PATH}"
  which ${TOOL_NAME}
  ${TOOL_NAME} version
}

zig_i_darwin
