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

getLibPath() {
  local lLibDirOK=1
  local lLibDir="$1"
  while true; do
    if [[ -d "${lLibDir}/lib" ]]; then
      lLibDirOK=0
      lLibDir="${lLibDir}/lib"
      echo "${lLibDir}"
      break
    else
      if [[ ${lLibDir} == "$(dirname "${lLibDir}")" ]]; then
        break
      fi
    fi
    lLibDir="$(dirname "${lLibDir}")"
  done
  return "${lLibDirOK}"
}

lib_path="$(getLibPath "${script_path}")"
readonly lib_path
if test $? -eq 1; then
  echo "ERROR!!! -- source [lib] dir not found"
  exit 1
fi

# Sources ...
# shellcheck disable=SC1091
source "${lib_path}/loader.bash"
loader_addpath "${lib_path}"

include "commons.sh"

script_log_dir="${script_dir}/LOGs/${script_name}-$(sortDate)"
readonly script_log_dir
# Common Script Header End

# Script Begin

# echo "lib_path [${lib_path}]"
# echo "current_dir [${current_dir}]"
# echo "script_path [${script_path}]"
# echo "script_dir [${script_dir}]"
# echo "script_file [${script_file}]"
# echo "script_name [${script_name}]"
# echo "script_ext [${script_ext}]"
# echo "script_log_dir [${script_log_dir}]"

mustBeHere curl
mustBeHere install

# REFs: https://blog.markvincze.com/download-artifacts-from-a-latest-github-release-in-sh-and-powershell/
# https://github.com/tsuru/tsuru-client/releases/download/1.7.4/tsuru_1.7.4_linux_amd64.tar.gz
readonly lGitHubUser="tsuru"
readonly lGitHubRepo="tsuru-client"
readonly lGitHubApp="tsuru"
readonly lGitHubAppArchivePath="${script_dir}/${lGitHubApp}.tar.gz"
readonly lGitHubUserRepo="${lGitHubUser}/${lGitHubRepo}"
readonly lAppLatestRelease=$(curl -L -s -H 'Accept: application/json' "https://github.com/${lGitHubUserRepo}/releases/latest")
# shellcheck disable=SC2001
readonly lAppLatestReleaseVersion=$(echo "${lAppLatestRelease}" | sed -e 's/.*"tag_name":"\([^"]*\)".*/\1/')
readonly lGitHubAppURL="https://github.com/${lGitHubUserRepo}/releases/download/${lAppLatestReleaseVersion}/${lGitHubApp}_${lAppLatestReleaseVersion}_linux_amd64.tar.gz"
# echo "lAppLatestRelease --> ${lAppLatestRelease}"
# echo ${lAppLatestReleaseVersion}
# echo ${lGitHubAppURL}
curl -o "${lGitHubAppArchivePath}" -L "${lGitHubAppURL}" \
  && mustBeHere tar \
  && mustBeHere gzip \
  && (rm "${script_dir}/${lGitHubApp}" 2>/dev/null || true) \
  && tar -zxvf "${lGitHubAppArchivePath}" "${lGitHubApp}" \
  && chmod +x "${script_dir}/${lGitHubApp}" \
  && (rm "${lGitHubAppArchivePath}" 2>/dev/null || true)
readonly lHomeBin="${HOME}/bin"
# shellcheck disable=SC2016
mkdir -p "${lHomeBin}" \
  && install "${script_dir}/${lGitHubApp}" "${lHomeBin}/" \
  && addPrePathInProfile '${HOME}/bin' \
  && updatePrePath "${lHomeBin}"
rm "${script_dir}/${lGitHubApp}"
"${script_dir}/${lGitHubApp}" --version

# Script End
