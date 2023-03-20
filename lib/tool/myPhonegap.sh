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

# http://docs.phonegap.com/phonegap-build/developer-api/read/
# http://docs.phonegap.com/phonegap-build/developer-api/write/

[ -f "${current_dir}/.env" ] && source "${current_dir}/.env"

if isEmpty "${PHONEGAP_TOKEN}"; then
  echo "ERROR!!! -- PHONEGAP_TOKEN not valid or defined [${PHONEGAP_TOKEN}]"
  exit 1
fi

readonly gcPhoneGapApiToken="${PHONEGAP_TOKEN}"
readonly gcPhoneGapBuildUrl="https://build.phonegap.com"
readonly gcPhoneGapApiBaseUrl="${gcPhoneGapBuildUrl}/api/v1"
readonly gcCurlPrefixCommand="curl -sSL"

phoneGapApiServiceUrl() {
  echo "${gcPhoneGapApiBaseUrl}/$1?auth_token=${gcPhoneGapApiToken}"
}

phoneGapApiMe() {
  $gcCurlPrefixCommand "$(phoneGapApiServiceUrl "me")" \
    | jq .
  return "$?"
}

phoneGapApiApps() {
  $gcCurlPrefixCommand "$(phoneGapApiServiceUrl "apps")" \
    | jq .
  return "$?"
}

phoneGapApiApp() {
  $gcCurlPrefixCommand "$(phoneGapApiServiceUrl "apps/$1")" \
    | jq .
  return "$?"
}

phoneGapApiAppFileCreate() {
  # http://docs.phonegap.com/phonegap-build/developer-api/write/#_post_https_build_phonegap_com_api_v1_apps
  local -r lZipFilePath=${1:-./phonegap.zip}
  local -r lPrivate=${2:-true}
  local -r lShare=${3:-true}
  ${gcCurlPrefixCommand} \
    -F "file=@${lZipFilePath}" \
    -F "data={\"title\":\"myPhonegap APP\",\"private\":\"${lPrivate}\",\"share\":\"${lShare}\",\"create_method\":\"file\",\"keys\":{$(phoneGapKeyAndroid)}}" \
    "$(phoneGapApiServiceUrl "apps")" \
    | jq .
  return "$?"
}

phoneGapApiAppDelete() {
  $gcCurlPrefixCommand \
    -X DELETE \
    "$(phoneGapApiServiceUrl "apps/$1")" \
    | jq .
  return "$?"
}

phoneGapApiKeys() {
  $gcCurlPrefixCommand "$(phoneGapApiServiceUrl "keys")" \
    | jq .
  return "$?"
}

phoneGapApiKeysPlatform() {
  local -r lPlatform=${1:-"android"}
  $gcCurlPrefixCommand "$(phoneGapApiServiceUrl "keys/${lPlatform}")" \
    | jq .
  return "$?"
}

phoneGapApiKey() {
  local -r lPlatform=${1:-"android"}
  $gcCurlPrefixCommand "$(phoneGapApiServiceUrl "keys/${lPlatform}/$2")" \
    | jq .
  return "$?"
}

phoneGapApiKeyDelete() {
  local -r lPlatform=${1:-"android"}
  $gcCurlPrefixCommand \
    -X DELETE \
    "$(phoneGapApiServiceUrl "keys/${lPlatform}/$2")" \
    | jq .
  return "$?"
}

phoneGapApiKeyFileCreateAndroid() {
  # http://docs.phonegap.com/phonegap-build/developer-api/write/#_post_https_build_phonegap_com_api_v1_keys_platform
  local -r lFilePath=${1:-"./keystore.keystore"}
  local -r lAlias=${2:-"aliasKeystore"}
  local -r lStorePw=${3:-"storepass1qaz2wsX"}
  local -r lKeyPw=${4:-"keypass1qaz2wsX"}
  local -r lTitle=${5:-"RELEASE"}
  $gcCurlPrefixCommand \
    -F "keystore=@${lFilePath}" \
    -F "data={\"title\":\"${lTitle}\",\"alias\":\"${lAlias}\", \"key_pw\":\"${lKeyPw}\",\"keystore_pw\":\"${lStorePw}\"}" \
    "$(phoneGapApiServiceUrl "keys/android")" \
    | jq .
  return "$?"
}

phoneGapKeyAndroid() {
  local lKeyId="${1:-$(phoneGapKeyId "android")}"
  if isEmpty "${lKeyId}"; then
    lKeyId="$(phoneGapApiKeyFileCreateAndroid \
      | jq .id)"
  fi
  if isEmpty "${lKeyId}"; then
    return 1
  else
    echo "\"android\":{\"id\":\"${lKeyId}\"}"
    return 0
  fi
}

phoneGapApiKeySelect() {
  local -r lPlatform=${1:-"android"}
  local -r lKeyId=${2:-$(phoneGapKeyId "${lPlatform}")}
  local -r lStorePw=${3:-"storepass1qaz2wsX"}
  local -r lKeyPw=${4:-"keypass1qaz2wsX"}
  $gcCurlPrefixCommand \
    -X PUT \
    -d "data={\"key_pw\":\"${lKeyPw}\",\"keystore_pw\":\"${lStorePw}\"}" \
    "$(phoneGapApiServiceUrl "keys/${lPlatform}/${lKeyId}")" \
    | jq .
  return "$?"
}

phoneGapAppId() {
  phoneGapApiApps \
    | jq -c '.apps[] | select(.private | contains(true)) | .id'
  return "$?"
}

phoneGapKeyId() {
  local -r lPlatform=${1:-"android"}
  phoneGapApiKeysPlatform "${lPlatform}" \
    | jq -c '.keys[] | select(.title | contains("RELEASE")) | .id'
  return "$?"
}

phoneGapKeyDelete() {
  local -r lPlatform=${1:-"android"}
  local -r lKeyId=$(phoneGapKeyId "${lPlatform}")
  if isEmpty "${lKeyId}"; then
    echo "No key to delete!!!"
    return 0
  else
    phoneGapApiKeyDelete "${lPlatform}" "${lKeyId}"
    return "$?"
  fi
}

phoneGapKeyDeployAndroid() {
  echoExecOk phoneGapKeyDelete "android" \
    && echoExecOk phoneGapApiKeyFileCreateAndroid
  return "$?"
}

phoneGapDeploy() {
  local -r lAppIdToDelete="$(phoneGapAppId)"
  if ! (isEmpty "${lAppIdToDelete}"); then
    echoExecOk phoneGapApiAppDelete "${lAppIdToDelete}"
  fi
  local -r lZipFilePath="${1:-./phonegap.zip}"
  local -r lPrivate="${2:-true}"
  local -r lShare="${3:-true}"
  echoExecOk phoneGapApiAppFileCreate "${lZipFilePath}" "${lPrivate}" "${lShare}"
  return "$?"
}

phoneGapStatus() {
  local -r lPlatform="${1}"
  local -r lAppId="$(phoneGapAppId)"
  if isEmpty "${lAppId}"; then
    return 1
  fi
  phoneGapApiApp "${lAppId}" \
    | jq ".status${lPlatform}"
  return "$?"
}

phoneGapWait() {
  local -r lPlatform="${1:-".android"}"
  local -r lStatusOk="${2:-'"complete"'}"
  echo "lStatusOk -> [${lStatusOk}]"
  local lStatus
  lStatus=$(phoneGapStatus "${lPlatform}")
  echo "lStatus -> [${lStatus}]"
  while [[ ${lStatus} == '"pending"' ]]; do
    sleep 2s
    lStatus=$(phoneGapStatus "${lPlatform}")
    echo "lStatus -> [${lStatus}]"
  done
  if [[ ${lStatusOk} == "${lStatus}" ]]; then
    return 0
  else
    return 1
  fi
}

phoneGapDownload() {
  local -r lPlatform="${1:-"android"}"
  if [[ $(phoneGapWait ".${lPlatform}") ]]; then
    local -r lAppIdToDownload=$(phoneGapAppId)
    echo "lAppIdToDownload -> [${lAppIdToDownload}]"
    if ! (isEmpty "${lAppIdToDownload}"); then
      local -r lPartialUrl="$(curl -SsL "${gcPhoneGapBuildUrl}/apps/${lAppIdToDownload}/share" | grep "${lPlatform}" | grep href | sed -e 's/.*href="\([^"]*\)".*/\1/')"
      if [ $? -eq 0 ] && ! (isEmpty "${lPartialUrl}"); then
        local -r lUrl="${gcPhoneGapBuildUrl}${lPartialUrl}"
        echo "Downloading from -> [${lUrl}]"
        $gcCurlPrefixCommand -o app.apk "${lUrl}"
      else
        return 1
      fi
    else
      return 1
    fi
  else
    return 1
  fi
  return "$?"
}

mustBeHereNVM() {
  (hash nvm 2>/dev/null) || toolManager.sh nvm_i
  return "$?"
}

mustBeHereNPM() {
  (hash npm 2>/dev/null) || (mustBeHereNVM && nvm use 12)
  return "$?"
}

mustBeHereCordovaRes() {
  (hash cordova-res 2>/dev/null) || (mustBeHereNPM && npm -g install cordova-res)
  return "$?"
}

phoneGapPrepare() {
  local -r lPhoneGapDirPath="${1:-${current_dir}/phonegap}"
  if [[ ! -d ${lPhoneGapDirPath} ]]; then
    echo "Error!!! -- lPhoneGapDirPath do not exist -> [${lPhoneGapDirPath}]"
    return 1
  fi
  pushd "${lPhoneGapDirPath}" \
    && (rm -rf ./resources/android ./resources/ios || true) \
    && (mustBeHereCordovaRes && cordova-res) \
    && popd
  return "$?"
}

phoneGapZip() {
  local -r lPhoneGapDirPath="${1:-${current_dir}/phonegap}"
  local -r lZipFilePath="${2:-${current_dir}/phonegap.zip}"
  (rm "${lZipFilePath}" || true) \
    && mustBeHere zip \
    && pushd "${lPhoneGapDirPath}" \
    && echoExecOk zip -9 -r "${lZipFilePath}" . -x platforms/\* -x node_modules/\* \
    && popd \
    && echoExecOk zip -T "${lZipFilePath}"
  return "$?"
}

phoneGapZipDeploy() {
  local -r lPhoneGapDirPath="${1:-${current_dir}/phonegap}"
  local -r lZipFilePath="${2:-${current_dir}/phonegap.zip}"
  echoExecOk phoneGapZip "${lPhoneGapDirPath}" "${lZipFilePath}" \
    && echoExecOk phoneGapDeploy "${lZipFilePath}"
  return "$?"
}

phoneGapBuild() {
  local -r lPhoneGapDirPath="${1:-${current_dir}/phonegap}"
  local -r lZipFilePath="${2:-${current_dir}/phonegap.zip}"
  echoExecOk phoneGapPrepare "${lPhoneGapDirPath}" \
    && echoExecOk phoneGapZipDeploy "${lPhoneGapDirPath}" "${lZipFilePath}"
  return "$?"
}

createPhonegapProject() {
  phonegap create "${current_dir}/$1" --id "com.lucaguzzon.pg_$1" --name "$2"
}

main() {
  mustBeHere curl
  mustBeHere jq
  local lResult=0
  local -r helpString="$(printf '%s\n%s' "Help, valid options are :" "$(tr "\n" ":" <"${script_path}" | grep -o '# Commands start here:.*# Commands finish here' | tr ":" "\n" | grep -o '^ *\-[^)]*)' | sed 's/.$//' | sed 's/^ *//' | sed 's/^\(.\)/    \1/' | sort)")"
  if [[ $# -gt 0 ]]; then

    while [ "$#" -gt 0 ]; do
      case $1 in
        # Commands start here
        -apps | --phoneGapApiApps)
          echoExecOk phoneGapApiApps
          lResult="$?"
          ;;
        -buildCordova | --phoneGapBuildCordova)
          echoExecOk phoneGapBuild cordova
          lResult="$?"
          ;;
        -build | --phoneGapBuild)
          echoExecOk phoneGapBuild
          lResult="$?"
          ;;
        -cPGProj | --createPhonegapProject)
          shift
          echoExecOk createPhonegapProject "$1" "$2"
          shift
          lResult="$?"
          if [[ ${lResult} -ne 0 ]]; then
            break
          fi
          ;;
        -downloadAndroid | --downloadAppAndroid)
          echoExecOk phoneGapDownload android
          lResult="$?"
          ;;
        -deployDownloadCordova | --deployDownloadCordova)
          ${script_file} -zipDeployCordova -keySelect -downloadAndroid || ${script_file} -downloadAndroid
          lResult="$?"
          ;;
        -deployDownloadPhonegap | --deployDownloadPhonegap)
          ${script_file} -zipDeploy -keySelect -downloadAndroid || ${script_file} -downloadAndroid
          lResult="$?"
          ;;
        -deployZip | --phoneGapDeploy)
          echoExecOk phoneGapDeploy
          lResult="$?"
          ;;
        -id | --phoneGapAppId)
          echoExecOk phoneGapAppId
          lResult="$?"
          ;;
        -idKeyAndroid | --phoneGapKeyIdAndroid)
          echoExecOk phoneGapKeyId "android"
          lResult="$?"
          ;;
        -keys | --phoneGapApiKeys)
          echoExecOk phoneGapApiKeys
          lResult="$?"
          ;;
        -keySelect | --phoneGapApiKeySelect)
          echoExecOk phoneGapApiKeySelect
          lResult="$?"
          ;;
        -keysAndroid | --phoneGapApiKeysAndroid)
          echoExecOk phoneGapApiKeysPlatform android
          lResult="$?"
          ;;
        -deployKeyAndroid | --phoneGapKeyDeployAndroid)
          echoExecOk phoneGapKeyDeployAndroid
          lResult="$?"
          ;;
        -me | --phoneGapApiMe)
          echoExecOk phoneGapApiMe
          lResult="$?"
          ;;
        -prepare | --phoneGapPrepare)
          echoExecOk phoneGapPrepare
          lResult="$?"
          ;;
        -statusAndroid | --phoneGapStatusAndroid)
          echoExecOk phoneGapStatus ".android"
          lResult="$?"
          ;;
        -status | --phoneGapStatus)
          echoExecOk phoneGapStatus
          lResult="$?"
          ;;
        -zipDeployCordova | --phoneGapZipDeployCordova)
          echoExecOk phoneGapZipDeploy cordova
          lResult="$?"
          ;;
        -zipDeploy | --phoneGapZipDeploy)
          echoExecOk phoneGapZipDeploy
          lResult="$?"
          ;;
        -wait | --phoneGapWait)
          echoExecOk phoneGapWait
          lResult="$?"
          ;;
        -zzz | --Dummy)
          phoneGapKeyAndroid
          lResult="$?"
          ;;
        # Commands finish here
        *) echo "${helpString}" ;;
      esac
      shift
    done

  else
    echo "${helpString}"
  fi
  return "${lResult}"
}

echoExecOk main "$@"

exit "$?"
# Script End
