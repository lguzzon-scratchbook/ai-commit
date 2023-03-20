#!/usr/bin/env bash

# Tips: all the quotes  --> "'`
# Tips: other chars --> ~
# Tips: script path --> $(readlink -f "${0%/*}")

include "commons.sh"

# checkSSHKey() {
#   local -r lUser="$1"
#   local -r lHost="$2"
#   local -r lFileToCheck="${script_dir}/checkSSHKey/${lUser}${lHost}"
#   mkdir -p "${script_dir}/checkSSHKey"
#   if [ ! -f "${lFileToCheck}" ]; then
#     local lRET=1
#     until [ ${lRET} -eq 0 ]; do
#       ssh-copy-id -i ~/.ssh/id_rsa.pub ${lUser}@${lHost} 2>/dev/null && touch "${lFileToCheck}"
#       lRET=$?
#       sleep 1
#     done
#   fi
# }

# resetCheckSSHKey() {
#   rm -Rf "${script_dir}/checkSSHKey" || true
# }

safeSSH() {
  local -r lUser="$1"
  local -r lHost="$2"
  local -r lCommand="$3"
  # checkSSHKey ${lUser} ${lHost}
  ssh -i "${HOME}/.ssh/id_rsa" ${lUser}@${lHost} "HOST_IP=${lHost};${lCommand}"
}

sshUserHost() {
  # REFs: https://unix.stackexchange.com/questions/76162/how-do-i-capture-the-return-status-and-use-tee-at-the-same-time-in-korn-shell#76171
  local -r lUser="$1"
  local -r lHost="$2"
  shift 2
  safeSSH "${lUser}" "${lHost}" "$@" | teeNoColor "${script_log_dir}/${lHost}.log"
  return ${PIPESTATUS[0]}
}

sshRootHost() {
  local -r lHost="$1"
  shift
  sshUserHost root "${lHost}" "$@"
  return $?
}

waitSSH() {
  local -r lHost="$1"
  local -r lFirstDelayinSecs="${2:-60}"
  local -r lMaxRetries="${3:-10}"
  local lDelay=${lFirstDelayinSecs}
  for ((lRetry = 1; lRetry <= lMaxRetries; lRetry++)); do
    sshRootHost "${lHost}" "uptime && uname -a"
    if [ "$?" -eq "0" ]; then
      echo "OK !!! -- can connect with ssh to [${lHost}]"
      return 0
    fi
    echo "INFO !!! -- wait [${lDelay}] secs before try to connect to [${lHost}]"
    sleep "${lDelay}"
    lDelay=$((lDelay / 2))
    if [ "$lDelay" -eq "0" ]; then
      lDelay=${lFirstDelayinSecs}
    fi
  done
  echo "ERROR !!! -- can not connect with ssh to [${lHost}]"
  return 1
}

waitSSHs() {
  local -r lFirstDelayinSecs="${1:-60}"
  local -r lMaxRetries="${2:-10}"
  for lServerIP in ${clusterHosts}; do
    waitSSH "${lServerIP}" "${lFirstDelayinSecs}" "${lMaxRetries}" &
  done
  wait
  return $?
}
