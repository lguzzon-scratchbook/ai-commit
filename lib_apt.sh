#!/usr/bin/env bash

# Tips: all the quotes  --> "'`
# Tips: other chars --> ~
# Tips: script path --> $(readlink -f "${0%/*}")

readonly uAptGet="DEBIAN_FRONTEND=noninteractive sudo apt-get -y -qq -o Dpkg::Options::=--force-all"
readonly uResetInstalls="sudo dpkg --configure -a ; ${uAptGet} -f install"
readonly uApt="${uAptGet}"
readonly aptInstall="${uApt} install --no-install-suggests --no-install-recommends"
readonly aptPurge="${uApt} purge"
readonly aptAutoremove="${uApt} autoremove"
readonly aptClean="${uApt} clean ; ${uApt} autoclean"
readonly aptUpdate="${aptAutoremove} ; ${uApt} --fix-missing update"
readonly aptUpgrade="${aptUpdate} ; ${uApt} full-upgrade"
readonly aptDistUpgrade="${aptUpgrade} ; ${uApt} dist-upgrade"

purgeAndRemoveApt() {
  echo "\
    ${aptPurge} $1 \
  ; ${uApt} autoremove --purge $1"
}

installReset() {
  eval "${uResetInstalls}"
}

installRepositoryIfNotPresent() {
  local -r lPPAName="$1"
  local lResult=1
  export lResult
  while IFS= read -r -d '' APT; do
    while read -r ENTRY; do
      if echo "${ENTRY}" | grep "${lPPAName}"; then
        lResult=$?
        break
      fi
    done < <(grep -o '^deb http://ppa.launchpad.net/[a-z0-9\-]\+/[a-z0-9\-]\+' "${APT}" || true)
    # https://superuser.com/questions/688882/how-to-test-if-a-variable-is-equal-to-a-number-in-shell
    if [[ ${lResult} -eq 0 ]]; then
      break
    fi
  done < <(find /etc/apt/ -name \*.list -print0)
  if [[ ${lResult} -eq 1 ]]; then
    eval "sudo -E add-apt-repository -y ppa:${lPPAName}" \
      && eval "${aptUpdate}"
    lResult=$?
  fi
  return ${lResult}
}

installIfNotPresent() {
  local -r lPackageName="$1"
  local -r lPreCommandToRun="${2:-true}"
  local -r lPostCommandToRun="${3:-true}"
  local lResult=0
  if [[ $(dpkg-query -W -f='${Status}' "${lPackageName}" 2>/dev/null | grep -c "ok installed") -eq 0 ]]; then
    eval "${lPreCommandToRun}" \
      && eval "${aptInstall} ${lPackageName}" \
      && eval "${lPostCommandToRun}"
    lResult=$?
  fi
  return ${lResult}
}

simpleInstallIfNotPresent() {
  local -r lCommand=${1}
  local -r lInstall=${2}
  local -r lForce=${3:-"0"}
  if [[ $lForce == "0" ]]; then
    eval "$lInstall"
  else
    if [[ -n $(which "${lCommand}") ]]; then
      true
    else
      eval "$lInstall"
    fi
  fi
  return $?
}

simpleUninstall() {
  local -r lApp="$1"
  local lResult=0
  if [[ -n $lApp ]]; then
    local -r lAppPath=$(which "${lApp}")
    if [[ -n $lAppPath ]]; then
      echo "Uninstall ${lApp} --> ${lAppPath}"
      sudo rm "$(which "${lApp}")"
      lResult=$?
      hash -r
      local -r lExist=$(which "${lApp}")
      # check uninstallation ...
      if [[ -n $lExist ]]; then
        echo "Warning: ${lApp} --> ${lExist}"
        lResult=1
      fi
    fi
  fi
  return $lResult
}
