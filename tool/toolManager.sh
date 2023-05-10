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

include "lib_apt.sh"
include "lib_docker.sh"

gDEBUG=1

dbgMSG() {
  if test $gDEBUG -eq 0; then
    echo "DEBUG [$@]"
  fi
}

dos2Unix() {
  mustBeHere dos2unix
  echoExecOk find . -type f -exec dos2unix {} \;
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
        echo "Warning: ${lApp} --> $lExist"
        lResult=1
      fi
    fi
  fi
  return $lResult
}

architectureOs() {
  uname -m
}

# shellcheck disable=SC2120
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

bpytop_i() {
  mustBeHere pip3 python3-pip \
    && sudo pip3 install bpytop --upgrade
  return $?
}

bpytop_u() {
  mustBeHere pip3 python3-pip \
    && sudo pip3 uninstall bpytop --verbose
  return $?
}

docker_earthly_i() {
  simpleInstallIfNotPresent "docker" "docker_Install_Local" "noForce" \
    && docker_NoRootUser_Install \
    && mustBeHere wget \
    && sudo /bin/sh -c 'wget https://github.com/earthly/earthly/releases/latest/download/earthly-linux-amd64 -O /usr/local/bin/earthly \
      && chmod +x /usr/local/bin/earthly \
      && /usr/local/bin/earthly bootstrap --with-autocomplete' \
    && earthly "github.com/earthly/hello-world+hello"
  return $?
}

docker_earthly_u() {
  echoExecOk docker_NoRootUser_Uninstall
  if [ -f /usr/local/bin/earthly ]; then
    sudo rm /usr/local/bin/earthly
  else
    true
  fi
  return $?
}

ffsend_i() {
  local -r lGitHubUser="timvisee"
  local -r lGitHubRepo="ffsend"
  local -r lGitHubApp="ffsend"
  local -r lGitHubAppPath="${script_dir}/${lGitHubApp}"
  local -r lGitHubUserRepo="${lGitHubUser}/${lGitHubRepo}"
  local -r lGitHubAppLatestRelease=$(curl -fsSL -H 'Accept: application/json' "https://github.com/${lGitHubUserRepo}/releases/latest")
  # shellcheck disable=2001
  local -r lGitHubAppLatestReleaseVersion=$(sed -e 's/.*"tag_name":"\([^"]*\)".*/\1/' <<<"${lGitHubAppLatestRelease}")
  local -r lBin="/usr/local/bin/"
  mustBeHere curl \
    && curl -o "${lGitHubAppPath}" -fsSL "https://github.com/${lGitHubUserRepo}/releases/download/${lGitHubAppLatestReleaseVersion}/${lGitHubApp}-${lGitHubAppLatestReleaseVersion}-linux-x64" \
    && chmod +x "${lGitHubAppPath}" \
    && mustBeHere install \
    && sudo install "${lGitHubAppPath}" "${lBin}" \
    && rm "${lGitHubAppPath}" \
    && which ${lGitHubApp} \
    && ${lGitHubApp} --version
  return $?
}

mobileDev_i() {
  set -x
  set -u #exit when your script tries to use undeclared variables
  set -e # exit when a command fails

  # Start  Base
  DEBIAN_FRONTEND=noninteractive
  uAptGet="apt-get -y -qq -o Dpkg::Options::=--force-all"
  uApt="${uAptGet}"
  aptInstall="${uApt} --no-install-recommends install"
  aptPurge="${uApt} purge"
  aptAutoremove="${uApt} autoremove"
  aptClean="${uApt} clean && ${uApt} autoclean"
  aptUpdate="${aptAutoremove} && ${uApt} --fix-missing update"
  nullEnd=" >/dev/null 2>&1"
  TERM=xterm
  # Finish Base

  # Start  Android
  ANDROID_HOME="/opt/android"
  ANDROID_SDK_URL="https://dl.google.com/android/repository/sdk-tools-linux-4333796.zip"
  PATH=${PATH}:${ANDROID_HOME}/tools:${ANDROID_HOME}/tools/bin:${ANDROID_HOME}/platform-tools
  # Finish Android

  # Start  NodeJS
  PATH=$PATH:/opt/node/bin
  # Finish NodeJS

  # Start Cordova
  CORDOVA_VERSION=latest
  PHONEGAP_VERSION=latest
  IONIC_VERSION=latest
  FRAMEWORK_SEVEN_VERSION=latest
  TABRIS_VERSION=latest
  NATIVESCRIPT_VERSION=latest
  YARN_VERSION=latest
  PNPM_VERSION=latest
  # Finish Cordova

  # Use this to truncate long RUN s
  # # \/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/
  #     && true
  # RUN    set -x \
  #     && source "$HOME/.sdkman/bin/sdkman-init.sh" \
  # # /\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\

  # ------------------------------------------------------
  # PRE-REQUISITES
  # RUN    rm /bin/sh && ln -s /bin/bash /bin/sh
  # RUN    set -x \
  # RUN    true \
  eval "dpkg --add-architecture i386 ${nullEnd}"
  eval "${aptUpdate}"
  # ------------------------------------------------------
  # SDKMAN
  eval "${aptInstall} curl wget unzip zip ca-certificates ${nullEnd}"
  curl -s "https://get.sdkman.io" | bash
  source "$HOME/.sdkman/bin/sdkman-init.sh"
  sdk version
  # ------------------------------------------------------
  # NODEJS
  eval "${aptInstall} curl git ca-certificates ${nullEnd}"
  mkdir -p /opt/node
  (
    cd /opt/node
    curl -sSL https://nodejs.org/dist/latest-erbium/ | grep "node-v" | head -1 | sed -e 's/^[^-]*-\([^-]*\)-.*/\1/' >/tmp/nodejsVersion
    curl -sSL https://nodejs.org/dist/$(cat /tmp/nodejsVersion)/node-$(cat /tmp/nodejsVersion)-linux-x64.tar.gz | tar xz --strip-components=1
  )
  echo "node version"
  node --version
  echo "npm version"
  npm --version
  pushd /tmp
  npm i -g --unsafe-perm=true --allow-root "pnpm@${PNPM_VERSION}"
  echo "pnpm version"
  pnpm --version
  npm i -g --unsafe-perm=true --allow-root "yarn@${YARN_VERSION}"
  echo "yarn version"
  yarn --version
  popd
  # ------------------------------------------------------
  # JAVA
  sdk install java $(sdk ls java | grep "\-open" | grep -v "\.ea\." | sed -e 's/^.*| \([^-]*\)-.*$/\1/' | grep "^8" | head -1)-open
  eval "echo \"JAVA_HOME=${JAVA_HOME}\""
  java -version
  # ------------------------------------------------------
  # ANT
  sdk install ant
  ant -version
  # ------------------------------------------------------
  # MAVEN
  sdk install maven
  mvn -version
  # ------------------------------------------------------
  # GRADLE
  sdk install gradle
  gradle --version
  sdk install gradle 4.10.3
  gradle --version
  # ------------------------------------------------------
  # ANDROID
  eval "${aptInstall} curl libc6:i386 libgcc1:i386 libncurses5:i386 libstdc++6:i386 libz1:i386 net-tools zlib1g:i386 wget unzip zipalign ${nullEnd}"
  mkdir -p /opt
  wget -q "${ANDROID_SDK_URL}" -O android-sdk-tools.zip
  eval "unzip -q android-sdk-tools.zip -d ${ANDROID_HOME} ${nullEnd}"
  rm android-sdk-tools.zip
  eval "(yes | sdkmanager --licenses) ${nullEnd}"
  touch /root/.android/repositories.cfg
  eval "sdkmanager emulator tools platform-tools ${nullEnd}"
  eval "(yes | sdkmanager --update --channel=3)  ${nullEnd}"
  yes | sdkmanager "platforms;android-29" "platforms;android-28" "build-tools;29.0.3" "extras;android;m2repository" "extras;google;m2repository" >/dev/null 2>&1
  #"system-images;android-29;google_apis;x86" \
  #"system-images;android-28;google_apis;x86" \
  #"system-images;android-26;google_apis;x86" \
  #"system-images;android-25;google_apis;armeabi-v7a" \
  #"system-images;android-24;default;armeabi-v7a" \
  #"system-images;android-22;default;armeabi-v7a" \
  #"system-images;android-19;default;armeabi-v7a" \
  #"extras;google;google_play_services" \
  #"extras;m2repository;com;android;support;constraint;constraint-layout;1.0.2" \
  #"extras;m2repository;com;android;support;constraint;constraint-layout;1.0.1" \
  #"add-ons;addon-google_apis-google-23" \
  #"add-ons;addon-google_apis-google-22" \
  #"add-ons;addon-google_apis-google-21" \
  # ------------------------------------------------------
  # CORDOVA PHONEGAP IONIC FRAMEWORK7 Tabris Nativescript cordova-check-plugins
  pushd /tmp
  pnpm i -g --unsafe-perm=true "cordova@${CORDOVA_VERSION}"
  echo "Cordova version"
  cordova --version
  cordova telemetry off
  pnpm i -g --unsafe-perm=true "phonegap@${PHONEGAP_VERSION}"
  echo "Phonegap version"
  phonegap --version
  phonegap analytics off
  pnpm i -g --unsafe-perm=true "@ionic/cli@${IONIC_VERSION}"
  echo "Ionic version"
  ionic --version
  pnpm i -g --unsafe-perm=true "framework7-cli@${FRAMEWORK_SEVEN_VERSION}"
  echo "Framework7 version"
  framework7 --version
  pnpm i -g --unsafe-perm=true "tabris-cli@${TABRIS_VERSION}"
  echo "Tabris version"
  tabris --version
  pnpm i -g --unsafe-perm=true "nativescript@${NATIVESCRIPT_VERSION}"
  echo "Nativescript version"
  tns --version
  pnpm i -g --unsafe-perm=true "cordova-check-plugins"
  echo "cordova-check-plugins version"
  cordova-check-plugins --version
  popd
  # ------------------------------------------------------
  # CLEAN-UP
  eval "${aptAutoremove}"
  eval "${aptClean}"
  rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
  # ------------------------------------------------------
  # LAST LINE ...
  # && true

  set +e # exit when a command fails
  set +u #exit when your script tries to use undeclared variables
  set +x
}

nvm_i() {
  local -r lGitHubUser="nvm-sh"
  local -r lGitHubRepo="nvm"
  local -r lGitHubUserRepo="${lGitHubUser}/${lGitHubRepo}"
  local -r lGitHubAppLatestRelease=$(curl -fsSL -H 'Accept: application/json' "https://github.com/${lGitHubUserRepo}/releases/latest")
  # shellcheck disable=2001
  local -r lGitHubAppLatestReleaseVersion=$(echo "${lGitHubAppLatestRelease}" | sed -e 's/.*"tag_name":"\([^"]*\)".*/\1/')
  local -r lGitHubInstallURL="https://raw.githubusercontent.com/${lGitHubUserRepo}/${lGitHubAppLatestReleaseVersion}/install.sh"
  mustBeHere curl \
    && mustBeHere git \
    && curl -o- "${lGitHubInstallURL}" | bash \
    && export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")" \
    && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  return $?
}

nvm_u() {
  local lResult=1
  if ! (isEmpty "$NVM_DIR"); then
    rm -rf "$NVM_DIR" "${HOME}/.npm" "${HOME}/.bower" || true
    removeLinesFromFileContaining "NVM_DIR" "${HOME}/.bashrc" \
      || removeLinesFromFileContaining "NVM_DIR" "${HOME}/.profile"
    lResult=0
  fi
  return $lResult
}

restic_i() {
  local -r lGitHubUser="restic"
  local -r lGitHubRepo="restic"
  local -r lGitHubApp="restic"
  local -r lGitHubAppPath="${script_dir}/${lGitHubApp}"
  local -r lGitHubUserRepo="${lGitHubUser}/${lGitHubRepo}"
  local -r lGitHubAppLatestRelease=$(curl -fsSL -H 'Accept: application/json' "https://github.com/${lGitHubUserRepo}/releases/latest")
  # shellcheck disable=SC2001
  local -r lGitHubAppLatestReleaseVersion=$(echo "${lGitHubAppLatestRelease}" | sed -e 's/.*"tag_name":"\([^"]*\)".*/\1/')
  local -r lBin="/usr/local/bin/"
  mustBeHere curl \
    && curl -o "${lGitHubAppPath}.bz2" -L "https://github.com/${lGitHubUserRepo}/releases/download/${lGitHubAppLatestReleaseVersion}/${lGitHubApp}_${lGitHubAppLatestReleaseVersion:1}_linux_amd64.bz2" \
    && mustBeHere bzip2 \
    && mustBeHere install \
    && (rm "${lGitHubAppPath}" 2>/dev/null || true) \
    && bzip2 -d "${lGitHubAppPath}.bz2" \
    && chmod +x "${lGitHubAppPath}" \
    && (rm "${lGitHubAppPath}.bz2" 2>/dev/null || true) \
    && mustBeHere install \
    && sudo install "${lGitHubAppPath}" "${lBin}" \
    && rm "${lGitHubAppPath}" \
    && which ${lGitHubApp} \
    && ${lGitHubApp} version
  return $?
}

ripgrep_i() {
  local -r RIPGREP_VERSION=$(curl -s "https://api.github.com/repos/BurntSushi/ripgrep/releases/latest" | grep -Po '"tag_name": "\K[0-9.]+')
  curl -Lo /tmp/ripgrep.deb "https://github.com/BurntSushi/ripgrep/releases/latest/download/ripgrep_${RIPGREP_VERSION}_amd64.deb"
  sudo apt install -y /tmp/ripgrep.deb
  rm -rf /tmp/ripgrep.deb
  rg --version
  return $?
}

ripgrep_u() {
  sudo apt purge --autoremove -y ripgrep
  return $?
}

rclone_i() {
  mustBeHere curl \
    && (curl https://rclone.org/install.sh | sudo bash -s "${1-}")
  return $?
}

rcloneb_i() {
  echoExecOk rclone_i beta
  return $?
}

shellCheck_i() {
  local -r lGitHubUser="koalaman"
  local -r lGitHubRepo="shellcheck"
  local -r lGitHubApp="shellcheck"
  local -r lGitHubAppPath="${script_dir}/${lGitHubApp}"
  local -r lGitHubAppArchivePath="${script_dir}/${lGitHubApp}.tar.xz"
  local -r lGitHubUserRepo="${lGitHubUser}/${lGitHubRepo}"
  local -r lGitHubAppLatestRelease=$(curl -fsSL -H 'Accept: application/json' "https://github.com/${lGitHubUserRepo}/releases/latest")
  # shellcheck disable=2001
  local -r lGitHubAppLatestReleaseVersion=$(echo "${lGitHubAppLatestRelease}" | sed -e 's/.*"tag_name":"\([^"]*\)".*/\1/')
  local -r lBin="/usr/local/bin/"
  mustBeHere curl \
    && curl -o "${lGitHubAppArchivePath}" -fsSL "https://github.com/${lGitHubUserRepo}/releases/download/${lGitHubAppLatestReleaseVersion}/${lGitHubApp}-${lGitHubAppLatestReleaseVersion}.linux.x86_64.tar.xz" \
    && mustBeHere tar \
    && mustBeHere xz xz-utils \
    && tar -C "${script_dir}" -xvf "${lGitHubAppArchivePath}" --strip-components=1 "shellcheck-${lGitHubAppLatestReleaseVersion}/${lGitHubApp}" >/dev/null 2>&1 \
    && (rm "${lGitHubAppArchivePath}" 2>/dev/null || true) \
    && chmod +x "${lGitHubAppPath}" \
    && mustBeHere install \
    && sudo install "${lGitHubAppPath}" "${lBin}" \
    && rm "${lGitHubAppPath}" \
    && which ${lGitHubApp} \
    && ${lGitHubApp} --version
  return $?
}

yq_i() {
  local -r lLinuxArchitecture=$(uname -m)
  echo "Linux Architecture: ${lLinuxArchitecture}"
  local lArchitecture=${lLinuxArchitecture}
  case ${lLinuxArchitecture} in
    aarch64*)
      lArchitecture="arm64"
      ;;
    x86_64*)
      lArchitecture="amd64"
      ;;
  esac
  echo "Tool  Architecture: ${lArchitecture}"

  local -r lGitHubUser="mikefarah"
  local -r lGitHubRepo="yq"
  local -r lGitHubApp="yq"
  local -r lGitHubAppPath="${script_dir}/${lGitHubApp}"
  local -r lGitHubAppArchivePath="${script_dir}/${lGitHubApp}.tar.xz"
  local -r lGitHubUserRepo="${lGitHubUser}/${lGitHubRepo}"
  local -r lGitHubAppLatestRelease=$(curl -fsSL -H 'Accept: application/json' "https://github.com/${lGitHubUserRepo}/releases/latest")
  # shellcheck disable=2001
  local -r lGitHubAppLatestReleaseVersion=$(echo "${lGitHubAppLatestRelease}" | sed -e 's/.*"tag_name":"\([^"]*\)".*/\1/')
  local -r lBin="/usr/local/bin/"
  mustBeHere curl \
    && curl -o "${lGitHubAppPath}" -fsSL "https://github.com/${lGitHubUserRepo}/releases/download/${lGitHubAppLatestReleaseVersion}/${lGitHubApp}_linux_${lArchitecture}" \
    && chmod +x "${lGitHubAppPath}" \
    && mustBeHere install \
    && sudo install "${lGitHubAppPath}" "${lBin}" \
    && rm "${lGitHubAppPath}" \
    && which ${lGitHubApp} \
    && ${lGitHubApp} --version
  return $?
}

shfmt_i() {
  local -r lLinuxArchitecture=$(uname -m)
  echo "Linux Architecture: ${lLinuxArchitecture}"
  local lArchitecture=${lLinuxArchitecture}
  case ${lLinuxArchitecture} in
    aarch64*)
      lArchitecture="arm64"
      ;;
    armv7*)
      lArchitecture="arm"
      ;;
    x86_64*)
      lArchitecture="amd64"
      ;;
  esac
  echo "Tool  Architecture: ${lArchitecture}"

  local -r lGitHubUser="mvdan"
  local -r lGitHubRepo="sh"
  local -r lGitHubApp="shfmt"
  local -r lGitHubAppPath="${script_dir}/${lGitHubApp}"
  local -r lGitHubUserRepo="${lGitHubUser}/${lGitHubRepo}"
  local -r lGitHubAppLatestRelease=$(curl -fsSL -H 'Accept: application/json' "https://github.com/${lGitHubUserRepo}/releases/latest")
  # shellcheck disable=SC2001
  local -r lGitHubAppLatestReleaseVersion=$(echo "${lGitHubAppLatestRelease}" | sed -e 's/.*"tag_name":"\([^"]*\)".*/\1/')
  local -r lBin="/usr/local/bin/"
  mustBeHere curl \
    && curl -o "${lGitHubAppPath}" -fsSL "https://github.com/${lGitHubUserRepo}/releases/download/${lGitHubAppLatestReleaseVersion}/${lGitHubApp}_${lGitHubAppLatestReleaseVersion}_linux_${lArchitecture}" \
    && chmod +x "${lGitHubAppPath}" \
    && mustBeHere install \
    && sudo install "${lGitHubAppPath}" "${lBin}" \
    && rm "${lGitHubAppPath}" \
    && which ${lGitHubApp} \
    && ${lGitHubApp} -version
  return $?
}

git_i() {
  if [[ $UNAME_S == "Linux" ]]; then
    mustBeHere add-apt-repository software-properties-common \
      && sudo add-apt-repository --yes ppa:git-core/ppa \
      && sudo apt update \
      && sudo apt -y install git
  else
    echo "Could not install git in another os [$UNAME_S]"
  fi

}

haxe_i() {
  sAPPS_PATH
  local -r HAXELIB_PATH="${APPS_PATH}/haxelib"
  sudo add-apt-repository ppa:haxe/releases -y \
    && sudo apt-get update \
    && sudo apt-get install haxe -y \
    && ([ -d "${HAXELIB_PATH}" ] || mkdir "${HAXELIB_PATH}") \
    && haxelib setup "${HAXELIB_PATH}" \
    && haxelib --global update haxelib \
    && haxelib --global update
  return $?
}

redisCli_i() {
  echoExecOk installIfNotPresent redis-tools
  return $?
}

addUserToSudo() {
  local -r lUserName=${1:-"$USER"}
  sudo sh -c "usermod -aG sudo ${lUserName} && \
    ( sed -i '/${lUserName} ALL=(ALL:ALL) NOPASSWD: ALL/d' /etc/sudoers.d/${lUserName} \
    ; echo '${lUserName} ALL=(ALL:ALL) NOPASSWD: ALL' | tee /etc/sudoers.d/${lUserName} )"
  return $?
}

aptMirrorUpdater_i() {
  mustBeHere python3-pip \
    && sudo pip3 install apt-mirror-updater \
    && sudo apt-mirror-updater --auto-change-mirror
  return $?
}

upx_i() {
  local -r lLinuxArchitecture=$(architectureOs)
  local lArchitecture=${lLinuxArchitecture}
  case ${lLinuxArchitecture} in
    aarch64*)
      lArchitecture="arm64"
      ;;
    x86_64*)
      lArchitecture="amd64"
      ;;
  esac
  local -r lGitHubUser="upx"
  local -r lGitHubRepo="upx"
  local -r lGitHubApp="upx"
  local -r lGitHubUserRepo="${lGitHubUser}/${lGitHubRepo}"
  local -r lGitHubAppArchivePath="${script_dir}/${lGitHubApp}.tar.xz"
  sAPPS_PATH
  local -r APP_PATH="${APPS_PATH}/$lGitHubApp"
  local -r BASHRC_PATH="${HOME}/.bashrc"
  (hash curl 2>/dev/null || sudo apt -y install curl 2>/dev/null) \
    && (hash git 2>/dev/null || sudo apt -y install git 2>/dev/null) \
    && (hash xz 2>/dev/null || sudo apt -y install xz-utils 2>/dev/null)
  local -r lUPXVersion=$(git ls-remote --tags "https://github.com/upx/upx.git" \
    | awk '{print $2}' \
    | grep -v '{}' \
    | awk -F"/" '{print $3}' \
    | tail -1 \
    | sed "s/v//g")
  local -r lUpxUrl="https://github.com/upx/upx/releases/download/v${lUPXVersion}/upx-${lUPXVersion}-${lArchitecture}_linux.tar.xz"
  curl -o "${lGitHubAppArchivePath}" -fsSL "${lUpxUrl}" \
    && tar -xvf "${lGitHubAppArchivePath}" 1>/dev/null 2>&1 \
    && rm "${lGitHubAppArchivePath}" || true \
    && rm -rf "${APP_PATH}" || true \
    && mv "upx-${lUPXVersion}-${lArchitecture}_linux" "${APP_PATH}" \
    && export PATH="${APP_PATH}${PATH:+:$PATH}" \
    && sed "/### +++ ${lGitHubApp^^} +++ ###/,/### --- ${lGitHubApp^^} --- ###/d" -i "$BASHRC_PATH" \
    && {
      echo "### +++ ${lGitHubApp^^} +++ ###"
      echo "[ -d \"${APP_PATH}\" ] && export PATH=\"${APP_PATH}\${PATH:+:\$PATH}\""
      echo "### --- ${lGitHubApp^^} --- ###"
    } >>"$BASHRC_PATH" \
    && which ${lGitHubApp} \
    && ${lGitHubApp} --version
}

architectureNim() {
  local -r lLinuxArchitecture=$(architectureOs)
  local lArchitecture=${lLinuxArchitecture}
  case ${lLinuxArchitecture} in
    aarch64*)
      lArchitecture="arm64"
      ;;
    x86_64*)
      lArchitecture="x64"
      ;;
  esac
  echo "${lArchitecture}"
}

urlNimDevel() {
  local -r lArchitecture=$(architectureNim)
  curl -sSL https://api.github.com/repos/nim-lang/nightlies/releases | jq -r "[ .[]?.assets[] | select(.browser_download_url | test(\"latest-devel/linux_${lArchitecture}\")) | {updated_at, browser_download_url} ] | sort_by(.updated_at) | reverse | .[0].browser_download_url"
}

urlNimVersion() {
  local -r lArchitecture=$(architectureNim)
  curl -sSL https://api.github.com/repos/nim-lang/nightlies/releases | jq -r "[ .[]?.assets[] | select(.browser_download_url | test(\"latest-version-\")) | select(.browser_download_url | test(\"linux_$lArchitecture\")) | {updated_at, browser_download_url} ] | sort_by(.browser_download_url) | reverse | .[0].browser_download_url"
}

nim_i() {
  local -r TOOL_NAME="NIM"
  local -r TOOL_URL="${1:-$(urlNimDevel)}"
  sAPPS_PATH
  local -r APP_PATH="${APPS_PATH}/nim"
  local -r BASHRC_PATH="${HOME}/.bashrc"
  (hash curl 2>/dev/null || sudo apt -y install curl) \
    && (hash jq 2>/dev/null || sudo apt -y install jq) \
    && curl -o nim.tar.xz -sSL "${TOOL_URL}" \
    && (rm -rf "$(dirname "$(dirname "$(which nim)")")" 2>/dev/null \
      || rm -rf "${APP_PATH}" 2>/dev/null \
      || true) \
    && tar -xvf nim.tar.xz 1>/dev/null 2>&1 \
    && rm nim.tar.xz || true \
    && mv nim-* "${APP_PATH}" \
    && export PATH="${APP_PATH}/bin${PATH:+:$PATH}" \
    && sed "/### +++ ${TOOL_NAME^^} +++ ###/,/### --- ${TOOL_NAME^^} --- ###/d" -i "$BASHRC_PATH" \
    && {
      echo "### +++ ${TOOL_NAME^^} +++ ###"
      echo "[ -d \"${APP_PATH}/bin\" ] && export PATH=\"${APP_PATH}/bin\${PATH:+:\$PATH}\""
      echo "### --- ${TOOL_NAME^^} --- ###"
    } >>"$BASHRC_PATH" \
    && which nim \
    && nim --version
  return $?
}

zig_i() {
  sAPPS_PATH
  local -r TOOL_NAME="zig"
  local -r APP_PATH="${APPS_PATH}/${TOOL_NAME}"
  local -r BASHRC_PATH="${HOME}/.bashrc"
  local -r lLinuxArchitecture=$(architectureOs)
  local lArchitecture=${lLinuxArchitecture}
  (hash curl || sudo apt -y install curl) \
    && (hash jq || sudo apt -y install jq) \
    && curl -o zig.tar.xz -sSL "$(curl -slL "https://ziglang.org/download/index.json" \
      | jq -r ".master[\"${lArchitecture}-linux\"].tarball")" \
    && (rm -rf "$(dirname "$(which zig)")" 2>/dev/null \
      || rm -rf "${APP_PATH}" 2>/dev/null \
      || true) \
    && tar -xvf zig.tar.xz 1>/dev/null 2>&1 \
    && rm zig.tar.xz || true \
    && mv zig-linux-"${lArchitecture}"* "${APP_PATH}" \
    && export PATH="${APP_PATH}${PATH:+:$PATH}" \
    && sed "/### +++ ${TOOL_NAME^^} +++ ###/,/### --- ${TOOL_NAME^^} --- ###/d" -i "${BASHRC_PATH}" \
    && {
      echo "### +++ ${TOOL_NAME^^} +++ ###"
      echo "[ -d \"${APP_PATH}\" ] && export PATH=\"${APP_PATH}\${PATH:+:\$PATH}\""
      echo "### --- ${TOOL_NAME^^} --- ###"
    } >>"${BASHRC_PATH}" \
    && which ${TOOL_NAME} \
    && ${TOOL_NAME} version
}

v_i() {
  sAPPS_PATH
  local -r TOOL_NAME="v"
  local -r APP_PATH="${APPS_PATH}/${TOOL_NAME}"
  [ -d "${APP_PATH}/.git" ] || git clone https://github.com/vlang/v "${APP_PATH}"
  cd "${APP_PATH}"
  git pull
  make
  sudo ./v -v symlink
  v -v self -prod
  v version
}

nala_i() {
  sudo echo "deb http://deb.volian.org/volian/ scar main" | sudo tee /etc/apt/sources.list.d/volian-archive-scar-unstable.list
  sudo wget -qO - https://deb.volian.org/volian/scar.key | sudo tee /etc/apt/trusted.gpg.d/volian-archive-scar-unstable.gpg >/dev/null
  sudo apt update
  (sudo apt install nala-legacy) || (sudo apt install nala)
  sudo nala update && sudo nala upgrade && sudo nala autopurge && sudo nala autoremove && sudo nala clean
}

main() {
  local -r helpString=$(printf '%s\n%s' "Help, valid options are :" "$(tr "\n" ":" <"${script_path}" | grep -o '# Commands start here:.*# Commands finish here' | tr ":" "\n" | grep -o '^ *\-[^)]*)' | sed 's/.$//' | sed 's/^ *//' | sed 's/^\(.\)/    \1/' | sort)")
  if [[ $# -gt 0 ]]; then

    while [ "$#" -gt 0 ]; do
      case $1 in
        # Commands start here
        -addUserToSudo | --addUserToSudo) echoExecOk addUserToSudo ;;
        -aptMirrorUpdater_i | --aptMirrorUpdater_i) echoExecOk aptMirrorUpdater_i ;;
        -archNim | --architecture_Nim) architectureNim ;;
        -archOs | --architecture_Os) architectureOs ;;
        -bpytop_i | --bpytop_Install) echoExecOk bpytop_i ;;
        -bpytop_u | --bpytop_Uninstall) echoExecOk bpytop_u ;;
        -d2u | --dos2Unix) echoExecOk dos2Unix ;;
        -dbg | --debug) gDEBUG=0 ;;
        -docker_earthly_i | --docker_earthly_Install) echoExecOk docker_earthly_i ;;
        -docker_earthly_u | --docker_earthly_Uninstall) echoExecOk docker_earthly_u ;;
        -docker_i | --dockerInstall) (echoExecOk docker_Install_Local) ;;
        -docker_compose_i | --dockerComposeInstall) (echoExecOk dockerCompose_Install_Local) ;;
        -docker_norootuser_i | --docker_norootuser_Install) echoExecOk docker_NoRootUser_Install ;;
        -docker_r | --dockerReset) (echoExecOk docker_Reset_Local) ;;
        -docker_u | --dockerUninstall) (echoExecOk docker_Uninstall_Local) ;;
        -dskparams_i | --setDiskParams) echoExecOk setDiskParams ;;
        -ffsend_i | --ffsend_Install) echoExecOk ffsend_i ;;
        -ffsend_u | --ffsend_Uninstall) echoExecOk simpleUninstall ffsend ;;
        -git_i | --git_Install) echoExecOk git_i ;;
        -haxe_i | --haxe_Install) echoExecOk haxe_i ;;
        -javaJdk_i | --javaJDK_Install) echoExecOk sudo apt -y install default-jdk ;;
        -javaJdk_u | --javaJDK_uninstall) echoExecOk sudo apt -y purge default-jdk ;;
        -javaJre_i | --javaJRE_Install) echoExecOk sudo apt -y install default-jre ;;
        -javaJre_u | --javaJRE_Uninstall) echoExecOk sudo apt -y purge default-jre ;;
        -mobile_i | --mobileDev_i) echoExecOk mobileDev_i ;;
        -mobile_u | --cordovaAndroidBuildEnvironment_u) echoExecOk cordovaAndroidBuildEnvironment_u ;;
        -nala_i | --nala_i) echoExecOk nala_i ;;
        -nim_i | --nim_Install)
          if [ "${2-}" == "" ]; then
            echoExecOk nim_i
          else
            echoExecOk nim_i "$2"
            shift
          fi
          ;;
        -nvm_i | --nvm_Install) echoExecOk nvm_i ;;
        -nvm_u | --nvm_Uninstall) echoExecOk nvm_u ;;
        -rcloneb_i | --rcloneBeta_Install) echoExecOk rcloneb_i ;;
        -rclone_i | --rclone_Install) echoExecOk rclone_i ;;
        -rclone_u | --rclone_Uninstall) echoExecOk simpleUninstall rclone ;;
        -redis_i | --redis_cli_Install) echoExecOk redisCli_i ;;
        -restic_i | --restic_Install) echoExecOk restic_i ;;
        -restic_u | --restic_Uninstall) echoExecOk simpleUninstall restic ;;
        -ripgrep_i | --ripgrep_Install) echoExecOk ripgrep_i ;;
        -ripgrep_u | --ripgrep_Uninstall) echoExecOk ripgrep_u ;;
        -shellCheck_i | --shellCheck_Install) echoExecOk shellCheck_i ;;
        -shellCheck_u | --shellCheck_Uninstall) echoExecOk simpleUninstall shellcheck ;;
        -shfmt_i | --shfmt_Install) echoExecOk shfmt_i ;;
        -shfmt_u | --shfmt_Uninstall) echoExecOk simpleUninstall shfmt ;;
        -t | --test)
          echo "$@"
          break
          ;;
        -upx_i | --upx_Install) echoExecOk upx_i ;;
        -urlNimDevel | --url_NimDevel) urlNimDevel ;;
        -urlNimVersion | --url_NimVersion) urlNimVersion ;;
        -vmparams_i | --set_VmParams) echoExecOk setVmParamsSudo ;;
        -vmparams_s | --get_VmParams) echoExecOk getVmParams ;;
        -yq_i | --yd_Install) echoExecOk yq_i ;;
        -yq_u | --yd_Uninstall) echoExecOk simpleUninstall "$(sed 's|[-]*\(.*\)_[uU].*|\1|g' <<<"$1")" ;;
        -zig_i | --zig_Install) echoExecOk zig_i ;;
        -v_i | --v_Install) echoExecOk v_i ;;
        # Commands finish here
        *) echo "${helpString}" ;;
      esac
      shift
    done

  else
    echo "${helpString}"
  fi
  return $?
}

echoExecOk main "$@"
exit $?

# Script End
