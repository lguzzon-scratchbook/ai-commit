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

readonly gcServiceName="lvm-cache-primary"
readonly gcServiceNameStart="${gcServiceName}-start"
readonly gcServiceFilenameStart="${gcServiceNameStart}.sh"
readonly gcLocalFilePathStart="${script_dir}/${gcServiceFilenameStart}"
readonly gcBinInstallPath="/usr/sbin"
readonly gcSystemDFilePathStart="${gcBinInstallPath}/${gcServiceFilenameStart}"
readonly gcServiceNameStop="${gcServiceName}-stop"
readonly gcServiceFilenameStop="${gcServiceNameStop}.sh"
readonly gcLocalFilePathStop="${script_dir}/${gcServiceFilenameStop}"
readonly gcSystemDFilePathStop="${gcBinInstallPath}/${gcServiceFilenameStop}"
readonly gcServiceFilename="${gcServiceName}.service"
readonly gcLocalFilePath="${script_dir}/${gcServiceFilename}"
readonly gcSystemDFilePath="/etc/systemd/system/${gcServiceFilename}"

installService() {
  sudo cp "${gcLocalFilePathStart}" "${gcSystemDFilePathStart}"
  chmod 555 "${gcSystemDFilePathStart}"

  sudo cp "${gcLocalFilePathStop}" "${gcSystemDFilePathStop}"
  chmod 555 "${gcSystemDFilePathStop}"

  sudo cp "${gcLocalFilePath}" "${gcSystemDFilePath}"
  chmod 555 "${gcSystemDFilePath}"

  sudo systemctl enable "${gcServiceName}"
  sudo systemctl start "${gcServiceName}"
  sudo systemctl status "${gcServiceName}"
}

uninstallService() {
  sudo systemctl stop "${gcServiceName}"
  sudo systemctl disable "${gcServiceName}"
  sudo systemctl status "${gcServiceName}"
  sudo rm "${gcSystemDFilePathStart}"
  sudo rm "${gcSystemDFilePathStop}"
  sudo rm "${gcSystemDFilePath}"
}

resetService() {
  uninstallService
  installService
}

main() {
  local -r helpString=$(printf '%s\n%s' "Help, valid options are :" "$(tr "\n" ":" <"${script_path}" | grep -o '# Commands start here:.*# Commands finish here' | tr ":" "\n" | grep -o '^ *\-[^)]*)' | sed 's/.$//' | sed 's/^ *//' | sed 's/^\(.\)/    \1/' | sort)")

  if [[ $# -gt 0 ]]; then

    while [ "$#" -gt 0 ]; do
      case $1 in
        # Commands start here
        -i | --installService) (installService) ;;
        -u | --uninstallService) (uninstallService) ;;
        -r | --resetService) (resetService) ;;
        # Commands finish here
        *) echo "${helpString}" ;;
      esac
      shift
    done

  else
    echo "${helpString}"
  fi
}

main "$@"
