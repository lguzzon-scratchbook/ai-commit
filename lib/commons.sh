#!/usr/bin/env bash

# Tips: all the quotes  --> "'`
# Tips: other chars --> ~
# Tips: script path --> $(readlink -f "${0%/*}")

# https://github.com/fidian/ansi
include "ansi.sh"

# apt-get not verbose
export apt_get_options="--force-yes -y -qq"
export apt_get_options_install="${apt_get_options} -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold""
export installedPackagesApt=~/installedPackagesApt.txt
export installedPackagesPython=~/installedPackagesPython.txt

# https://stackoverflow.com/questions/5947742/how-to-change-the-output-color-of-echo-in-linux#5947802

teeNoColor() {
  (tee -a >(sed -r 's/\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]//g' >"$1"))
  return $?
}

createDirectory() {
  if [ ! -d "$1" ]; then
    mkdir -p "$1"
  fi
  return $?
}

echoError() {
  printf "%s\n" "$*" >&2
  return 0
}

timer() {
  if [ $# -eq 0 ]; then
    date '+%s'
  else
    local stime=$1
    local etime
    etime=$(date '+%s')

    if [ -z "$stime" ]; then
      stime=$etime
    fi

    local dt=$((etime - stime))
    local ds=$((dt % 60))
    local dm=$(((dt / 60) % 60))
    local dh=$((dt / 3600))
    printf '%d:%02d:%02d' $dh $dm $ds
  fi
  return $?
}

echoExecOk() {
  echo "$(ansi --yellow "[")$*$(ansi --yellow "]-------------------------------------[> Start")"
  local lStart
  lStart=$(timer)
  "$@"
  local lResult=$?
  echo -ne "$(ansi --yellow "[")$*$(ansi --yellow "]-------------------------------------<] Stop")"
  local lEnd
  lEnd=$(timer "$lStart")
  if test $lResult -eq 0; then
    echo -ne ": $(ansi --green --bold Ok)"
  else
    echo -ne ": $(ansi --red --blink Ko!!!)"
  fi
  echo "$(ansi --yellow " -- Elapsed time [")$(ansi --bold "$lEnd")$(ansi --yellow "]")"
  return $lResult
}

## associative array for job status
declare -A lJOBS

## run command in the background
background() {
  eval "$1" &
  lJOBS[$!]="$1"
  return $?
}

## check exit status of each job
## preserve exit status in ${lJOBS}
## returns 1 if any job failed
backgroundsWait() {
  local cmd
  local status=0
  for pid in "${!lJOBS[@]}"; do
    cmd=${lJOBS[${pid}]}
    wait "${pid}"
    lJOBS[${pid}]=$?
    if [[ ${lJOBS[${pid}]} -ne 0 ]]; then
      status=${lJOBS[${pid}]}
      echo -e "[${pid}] Exited with status: ${status}\n${cmd}"
    fi
  done
  return ${status}
}

isRoot() {
  if [ "$EUID" -ne 0 ]; then
    return 1
  else
    return 0
  fi
}

sudoString() {
  if (isRoot); then
    return 1
  else
    echo "sudo "
    return 0
  fi
}

isPresentInFile() {
  # local vars
  local lStringToFind=$1
  local lFileToSearchIn=$2
  # local script
  # Return value 0==true 1==false
  if grep -q "${lStringToFind}" "${lFileToSearchIn}" 2>/dev/null; then
    return 0
  else
    return 1
  fi
}

appendToFileIfNotPresent() {
  # local vars
  local lStringToAdd=$1
  local lFileToSearchIn=$2
  local lLinePrefix=${3-}
  # local script
  # Return value 0==true 1==false
  if ! (isPresentInFile "${lStringToAdd}" "${lFileToSearchIn}"); then
    echo "${lLinePrefix}${lStringToAdd}" >>"${lFileToSearchIn}"
    return 0
  else
    return 1
  fi
}

removeLinesFromFileContaining() {
  # local vars
  local lStringToSearch=$1
  local lFileToSearchIn=$2
  local lSedExpr="/${lStringToSearch}/d"
  # local script
  # Return value 0==true 1==false
  sed -i "${lSedExpr}" "${lFileToSearchIn}"
  return $?
}

isNull() {
  # local script
  # Return value 0==true 1==false
  if [ "$1" == "null" ]; then
    return 0
  else
    return 1
  fi
}

notNull() {
  # local script
  # Return value 0==true 1==false
  if (isNull "$1"); then
    return 1
  else
    return 0
  fi
}

isEmpty() {
  # local script
  # Return value 0==true 1==false
  if [ "$1" == "" ]; then
    return 0
  else
    return 1
  fi
}

notEmpty() {
  # local script
  # Return value 0==true 1==false
  if (isEmpty "$1"); then
    return 1
  else
    return 0
  fi
}

pushSubversionProxy() {
  # local script
  echoExecOk cp "/etc/subversion/servers" "/etc/subversion/servers.old"
  if (notEmpty "${proxyServer-}"); then
    echo "http-proxy-host = ${proxyServer}" \
      | teeNoColor "/etc/subversion/servers"
  fi
  if (notEmpty "${proxyPort-}"); then
    echo "http-proxy-port = ${proxyPort}" \
      | teeNoColor "/etc/subversion/servers"
  fi
  # Return value 0==true 1==false
  return 0
}

popSubversionProxy() {
  echoExecOk mv "/etc/subversion/servers.old" "/etc/subversion/servers"
  # Return value 0==true 1==false
  return 0
}

setupProxy() {
  # local vars
  local lhttp_proxy="http://"
  local lftp_proxy="ftp://"

  # local script
  if (isEmpty "${proxyServer}"); then
    lhttp_proxy=
    lftp_proxy=
  else
    lhttp_proxy="$lhttp_proxy${proxyServer}"
    lftp_proxy="$lftp_proxy${proxyServer}"
  fi

  if (notEmpty "${proxyPort}"); then
    if (notEmpty "$lhttp_proxy"); then
      lhttp_proxy="$lhttp_proxy:${proxyPort}"
      lftp_proxy="$lftp_proxy:${proxyPort}"
    fi
  fi

  if (notEmpty "$lhttp_proxy"); then
    lhttp_proxy="$lhttp_proxy/"
    lftp_proxy="$lftp_proxy/"
  fi
  export http_proxy="$lhttp_proxy"
  export ftp_proxy="$lftp_proxy"
  echo "Using http proxy [$http_proxy]"
  echo "Using ftp  proxy [$ftp_proxy]"
  return 1
}

updatePackages() {
  echoExecOk $(sudoString)apt-get ${apt_get_options} clean
  echoExecOk $(sudoString)apt-get ${apt_get_options} autoclean
  echoExecOk $(sudoString)apt-get ${apt_get_options} update
  echoExecOk $(sudoString)apt-get ${apt_get_options} upgrade
  #echoExecOk $(sudoString)apt-get ${apt_get_options} dist-upgrade
  #echoExecOk $(sudoString)apt-get ${apt_get_options} upgrade
  echoExecOk $(sudoString)apt-get ${apt_get_options} autoremove
  return $?
}

installPackage() {
  # local vars
  local lProduct=$1
  local lInterface="installPackage [$lProduct]"
  # local script
  echo "$lInterface"
  if [ ! -f "${installedPackagesApt}" ]; then
    touch "${installedPackagesApt}"
    updatePackages >/dev/null 2>/dev/null
  fi
  if (echoExecOk $(sudoString)apt-get ${apt_get_options_install} install "${lProduct}"); then
    appendToFileIfNotPresent "$1" "${installedPackagesApt}"
  fi
  return $?
}

mustBeHere() {
  # local vars
  local unixCommand=$1
  local aptPackage=${2-}
  local ppaRepository=${3-}
  local returnCode=1
  # local script
  if isEmpty "${aptPackage}"; then
    aptPackage=${unixCommand}
  fi
  if ! (hash "${unixCommand}" 2>/dev/null); then
    if notEmpty "${ppaRepository}"; then
      (echoExecOk $(sudoString)add-apt-repository "${ppaRepository}") >/dev/null 2>/dev/null
      updatePackages >/dev/null 2>/dev/null
    fi
    dpkg -s "${aptPackage}" 2>/dev/null | grep "Status:" | grep -q "installed"
    local rc=$?
    if [[ $rc != 0 ]]; then
      installPackage "${aptPackage}" >/dev/null 2>/dev/null
      returnCode=$?
    else
      returnCode=0
    fi
  fi
  if [[ $returnCode != 0 ]]; then
    if ! (hash "${unixCommand}" 2>/dev/null); then
      if ! (hash "pip" 2>/dev/null); then
        installPackage "python-pip" >/dev/null 2>/dev/null
      fi
      if (echoExecOk $(sudoString)pip install --upgrade "${unixCommand}" >/dev/null 2>/dev/null); then
        appendToFileIfNotPresent "${unixCommand}" "${installedPackagesPython}"
      fi
    fi
    if (hash "${unixCommand}" 2>/dev/null); then
      return 0
    else
      return 1
    fi
  else
    return 0
  fi
}

resetPackages() {
  # http://stackoverflow.com/questions/10929453/read-a-file-line-by-line-assigning-the-value-to-a-variable
  while read -r line || [[ -n $line ]]; do
    (echoExecOk $(sudoString)pip uninstall -y "$line") >/dev/null 2>/dev/null
  done <"${installedPackagesPython}" 2>/dev/null
  rm "${installedPackagesPython}" 2>/dev/null
  while read -r line || [[ -n $line ]]; do
    (echoExecOk $(sudoString)apt-get purge -y "$line") >/dev/null 2>/dev/null
  done <"${installedPackagesApt}" 2>/dev/null
  rm "${installedPackagesApt}" 2>/dev/null
  return $?
}

doReleaseUpgrade() {
  local -r lAPT_CONFIG_OLD=${APT_CONFIG}
  local -r lAptConfFilePath=$(mktemp "/tmp/${FUNCNAME[0]}.XXXXXX")

  export APT_CONFIG="${lAptConfFilePath}"
  {
    echo 'DPkg::Options "";'
    # echo "DPkg::Options:: \"--force-confnew\";"
    # echo "DPkg::Options:: \"--force-confmiss\";"
    echo 'DPkg::Options:: "--force-all";'
  } >>"${lAptConfFilePath}"

  export DEBIAN_FRONTEND=noninteractive

  # apt-config dump | grep DPkg
  do-release-upgrade -m server -f DistUpgradeViewNonInteractive

  APT_CONFIG=${lAPT_CONFIG_OLD}
  rm "${lAptConfFilePath}"
  return $?
}

execJqQuery() {
  local lResult="null"
  if (mustBeHere "jq"); then
    lResult=$(echo "$1" | python -mjson.tool | jq "$3" "$2")
  fi
  echo "${lResult}"
  return $?
}

execJqQueryRawResult() {
  execJqQuery "$1" "$2" "-r"
  return $?
}

getUUID() {
  tr -dc 'a-zA-Z0-9' </dev/urandom | fold -w 32 | head -n 1 || true
  return $?
}

getRandomString() {
  local -r lLength=${1:-32}
  tr -dc 'a-zA-Z0-9' </dev/urandom | fold -w ${lLength} | head -n 1 || true
  return $?
}

sortDate() {
  local -r lResult=$(date +'%Y%m%d-%H%M%S')${1-}
  echo "${lResult}"
  return $?
}

pathAdd() {
  if [ -d "$1" ] && [[ ":$PATH:" != *":$1:"* ]]; then
    export PATH="${PATH:+"$PATH:"}$1"
  fi
  return $?
}

updatePATH() {
  pathAdd "$1"
  hash -r
  return $?
}

addPostPath() {
  if [ -d "$1" ] && [[ ":$PATH:" != *":$1:"* ]]; then
    export PATH="$PATH:$1"
    return 0
  else
    return 1
  fi
}

updatePostPath() {
  if addPostPath "$1"; then
    hash -r
    return 0
  else
    return 1
  fi
}

addPostPathInProfile() {
  if updatePostPath "$1"; then
    appendToFileIfNotPresent "PATH=\"\$PATH:$1\"" "${HOME}/.profile" "\n"
  fi
  return $?
}

addPrePath() {
  if [ -d "$1" ] && [[ ":$PATH:" != *":$1:"* ]]; then
    export PATH="$1:$PATH"
    return 0
  else
    return 1
  fi
}

updatePrePath() {
  if addPrePath "$1"; then
    hash -r
    return 0
  else
    return 1
  fi
}

addPrePathInProfile() {
  if updatePrePath "$1"; then
    appendToFileIfNotPresent "[ -d \"$1\" ] && export PATH=\"$1:\$PATH\"" "${HOME}/.profile"
  fi
  return $?
}

addPrePathInBashrc() {
  if updatePrePath "$1"; then
    appendToFileIfNotPresent "[ -d \"$1\" ] && export PATH=\"$1:\$PATH\"" "${HOME}/.bashrc"
  fi
  return $?
}

setVmParams() {
  # Docs: https://www.linuxbabe.com/linux-server/how-to-enable-etcrc-local-with-systemd
  # See here: https://unix.stackexchange.com/questions/30286/can-i-configure-my-linux-system-for-more-aggressive-file-system-caching#41831
  echo 15 >/proc/sys/vm/swappiness
  echo 10 >/proc/sys/vm/vfs_cache_pressure
  echo 99 >/proc/sys/vm/dirty_ratio
  echo 50 >/proc/sys/vm/dirty_background_ratio
  echo 360000 >/proc/sys/vm/dirty_expire_centisecs
  echo 360000 >/proc/sys/vm/dirty_writeback_centisecs
  swapoff --all
  swapon --all
  if [ ! -f "/etc/rc.local" ]; then
    echo "#!/bin/sh -e" >/etc/rc.local
    chmod +x /etc/rc.local
  fi
  sed -i '/exit 0/d' /etc/rc.local
  appendToFileIfNotPresent "echo 15 > /proc/sys/vm/swappiness" /etc/rc.local
  appendToFileIfNotPresent "echo 10 > /proc/sys/vm/vfs_cache_pressure" /etc/rc.local
  appendToFileIfNotPresent "echo 99 > /proc/sys/vm/dirty_ratio" /etc/rc.local
  appendToFileIfNotPresent "echo 50 > /proc/sys/vm/dirty_background_ratio" /etc/rc.local
  appendToFileIfNotPresent "echo 360000 > /proc/sys/vm/dirty_expire_centisecs" /etc/rc.local
  appendToFileIfNotPresent "echo 360000 > /proc/sys/vm/dirty_writeback_centisecs" /etc/rc.local
  appendToFileIfNotPresent "exit 0" /etc/rc.local
  systemctl enable rc-local
  systemctl restart rc-local.service
  systemctl status rc-local.service
  return $?
}

setVmParamsSudo() {
  sudo bash -c "$(declare -f setVmParams); $(declare -f appendToFileIfNotPresent); $(declare -f isPresentInFile); setVmParams"
}

getVmParams() {
  echo "swappiness                [$(cat /proc/sys/vm/swappiness)]"
  echo "vfs_cache_pressure        [$(cat /proc/sys/vm/vfs_cache_pressure)]"
  echo "dirty_ratio               [$(cat /proc/sys/vm/dirty_ratio)]"
  echo "dirty_background_ratio    [$(cat /proc/sys/vm/dirty_background_ratio)]"
  echo "dirty_expire_centisecs    [$(cat /proc/sys/vm/dirty_expire_centisecs)]"
  echo "dirty_writeback_centisecs [$(cat /proc/sys/vm/dirty_writeback_centisecs)]"
  return $?
}

setSSDParams() {
  echo cfq >/sys/block/sdb/queue/scheduler
  echo 1 >/sys/block/sdb/queue/iosched/back_seek_penalty
  echo 10000 >/sys/block/sdb/queue/iosched/fifo_expire_async
  echo 20 >/sys/block/sdb/queue/iosched/fifo_expire_sync
  echo 1 >/sys/block/sdb/queue/iosched/low_latency
  echo 6 >/sys/block/sdb/queue/iosched/quantum
  echo 2 >/sys/block/sdb/queue/iosched/slice_async
  echo 10 >/sys/block/sdb/queue/iosched/slice_async_rq
  echo 1 >/sys/block/sdb/queue/iosched/slice_idle
  echo 20 >/sys/block/sdb/queue/iosched/slice_sync
  if [ ! -f "/etc/rc.local" ]; then
    echo "#!/bin/sh -e" >/etc/rc.local
    chmod +x /etc/rc.local
  fi
  sed -i '/^exit 0$/d' /etc/rc.local
  appendToFileIfNotPresent "echo cfq > /sys/block/sdb/queue/scheduler" /etc/rc.local
  appendToFileIfNotPresent "echo 1 > /sys/block/sdb/queue/iosched/back_seek_penalty" /etc/rc.local
  appendToFileIfNotPresent "echo 10000 > /sys/block/sdb/queue/iosched/fifo_expire_async" /etc/rc.local
  appendToFileIfNotPresent "echo 20 > /sys/block/sdb/queue/iosched/fifo_expire_sync" /etc/rc.local
  appendToFileIfNotPresent "echo 1 > /sys/block/sdb/queue/iosched/low_latency" /etc/rc.local
  appendToFileIfNotPresent "echo 6 > /sys/block/sdb/queue/iosched/quantum" /etc/rc.local
  appendToFileIfNotPresent "echo 2 > /sys/block/sdb/queue/iosched/slice_async" /etc/rc.local
  appendToFileIfNotPresent "echo 10 > /sys/block/sdb/queue/iosched/slice_async_rq" /etc/rc.local
  appendToFileIfNotPresent "echo 1 > /sys/block/sdb/queue/iosched/slice_idle" /etc/rc.local
  appendToFileIfNotPresent "echo 20 > /sys/block/sdb/queue/iosched/slice_sync" /etc/rc.local
  appendToFileIfNotPresent "exit 0" /etc/rc.local
  systemctl enable rc-local
  systemctl restart rc-local.service
  return $?
}

setDiskParams() {
  modprobe bfq
  for d in /sys/block/sd?; do
    # HDD (tuned for Seagate SMR drive)
    echo bfq >"$d/queue/scheduler"
    echo 4 >"$d/queue/nr_requests"
    echo 32000 >"$d/queue/iosched/back_seek_max"
    echo 3 >"$d/queue/iosched/back_seek_penalty"
    echo 80 >"$d/queue/iosched/fifo_expire_sync"
    echo 1000 >"$d/queue/iosched/fifo_expire_async"
    echo 5300 >"$d/queue/iosched/slice_idle_us"
    echo 1 >"$d/queue/iosched/low_latency"
    echo 200 >"$d/queue/iosched/timeout_sync"
    echo 0 >"$d/queue/iosched/max_budget"
    echo 1 >"$d/queue/iosched/strict_guarantees"

    # additional tweaks for SSD (tuned for Samsung EVO 850):
    if test $(cat "$d/queue/rotational") = "0"; then
      echo 36 >"$d/queue/nr_requests"
      echo 1 >"$d/queue/iosched/back_seek_penalty"
      # slice_idle_us should be ~ 0.7/IOPS in µs
      echo 16 >"$d/queue/iosched/slice_idle_us"
      echo 10 >"$d/queue/iosched/fifo_expire_sync"
      echo 250 >"$d/queue/iosched/fifo_expire_async"
      echo 10 >"$d/queue/iosched/timeout_sync"
      echo 0 >"$d/queue/iosched/strict_guarantees"
    fi
  done
  return $?
}

# arrayToList() {
#   local -r lArray="${1}"
#   local -r lSeparator="${2:-,}"

#   # echo $( IFS=$'\n' ; echo "${lArray[*]}" )
#   local -r lCommand="printf -v var \"%s${lSeparator}\" \"${lArray[@]}\""
#   echo "$lCommand"
#   ${lCommand}
# }
