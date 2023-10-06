#!/usr/bin/env bash

# Tips: all the quotes  --> "'`
# Tips: other chars --> ~

trap ctrl_c INT

function ctrl_c() {
  echo "** Trapped CTRL-C"
  [[ -z "$(jobs -p)" ]] || kill "$(jobs -p)"
}

function getScriptDir() {
  local lScriptPath="$1"
  # Need this for relative symlinks.
  while [ -h "$lScriptPath" ]; do
    ls=$(ls -ld "$lScriptPath")
    link=$(expr "$ls" : '.*-> \(.*\)$')
    if expr "$link" : '/.*' >/dev/null; then
      lScriptPath="$link"
    else
      lScriptPath=$(dirname "$lScriptPath")"/$link"
    fi
  done
  readlink -f "${lScriptPath%/*}"
}

# readonly current_dir=${script_dir}
readonly script_path=$(readlink -f "${0}")
readonly script_dir=$(getScriptDir "${script_path}")
# readonly script_file=$(basename "${script_path}")
# readonly script_name=${script_file%\.*}
# readonly script_ext=$([[ ${script_file} == *.* ]] && echo ".${script_file##*.}" || echo '')

main() {
  sudo ${script_dir}/lvm-cache-primary-install.sh -u
  echo Starting IOPING service KO
  ioping -q -c 20 .
  ioping -q -c 20 . -C
  sudo ${script_dir}/lvm-cache-primary-install.sh -i
  echo Starting IOPING service OK
  ioping -q -c 20 .
  ioping -q -c 20 . -C
  sudo ${script_dir}/lvm-cache-primary-install.sh -u
}

main "$@"
