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
include "lib_apt.sh"

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

add_tool_path() {
  local tool_name="$1"
  local tool_path="$2"
  local bashrc_path="${HOME}/.bashrc"

  # Remove existing tool path from bashrc if it exists
  sed "/### +++ ${tool_name^^} +++ ###/,/### --- ${tool_name^^} --- ###/d" -i "${bashrc_path}"

  # Append tool path to bashrc
  cat <<EOF >>"${bashrc_path}"
### +++ ${tool_name^^} +++ ###
[ -d "${tool_path}" ] && export PATH="${tool_path}:\${PATH:+:\$PATH}"
### --- ${tool_name^^} --- ###
EOF

  # Refresh the shell's internal hash of commands
  hash -r
}

get_python_major_version() {
  printf '%s\n' "${1%%.*}"
}

install_python() {
  eval "${aptClean}"

  installRepositoryIfNotPresent "deadsnakes/ppa"

  local USE_PYTHON=${1-}
  if [ -z "$USE_PYTHON" ] && [ "${USE_PYTHON+xyz}" = "xyz" ]; then
    USE_PYTHON=$(apt-cache search "python" | grep "^python[0-9\.]*-.*$" | sed -n "s/^python\([0-9\.]*\)-.*$/\1/p" | sort -u -f -t '.' -k 2,2n -k 1,1n | tail -1)
  fi

  echo "USE_PYTHON = ${USE_PYTHON}"
  sudo apt -y purge "python$(get_python_major_version "${USE_PYTHON}")-apt"
  installIfNotPresent "python${USE_PYTHON}-full"
  installIfNotPresent "python${USE_PYTHON}-dev"
  installIfNotPresent "python${USE_PYTHON}-dbg"
  sudo apt -y install "python$(get_python_major_version "${USE_PYTHON}")-apt"

  sudo update-alternatives --remove-all python || true
  sudo update-alternatives --remove-all python3 || true
  sudo update-alternatives --install /usr/bin/python3 python3 "/usr/bin/python${USE_PYTHON}" 10
  sudo update-alternatives --install /usr/bin/python python "/usr/bin/python${USE_PYTHON}" 10

  eval "${aptClean}"
  eval "${aptAutoremove}"

  add_tool_path "Python" "$HOME/.local/bin"
}

install_pip() {
  local -r pip_install_script="get-pip.py"
  mustBeHere curl
  curl --fail --location --output "${pip_install_script}" "https://bootstrap.pypa.io/${pip_install_script}"

  if [ $? -ne 0 ]; then
    echo "Error: curl command not found. Please install curl before running this script."
    exit 1
  fi

  if ! command -v python &>/dev/null; then
    echo "Error: Python not found. Please install Python before running this script."
    exit 1
  fi

  python "${pip_install_script}"

  rm "${pip_install_script}"

  python -m pip install --user --upgrade pip

  pip --version

  echo "Pip installation complete!"
}

install_pipx() {
  echo "Installing pipx..."
  python -m pip install --user pipx
  echo "Ensuring pipx is in PATH..."
  python -m pipx ensurepath
  echo "pipx installation complete!"
}

install_uv() {
  echo Install uv
  curl -LsSf https://astral.sh/uv/install.sh | sh
  add_tool_path "Cargo" "$HOME/.cargo/bin"
}

main() {
  local python_version="${1-}"
  echoExecOk install_python "${python_version}"
  echoExecOk install_pip
  echoExecOk install_pipx
  echoExecOk install_uv

  echo "Versions:"
  echo " - Python:         $(python --version 2>&1)"
  echo " - Python 3:       $(python3 --version 2>&1)"
  echo " - pip:            $(pip --version 2>&1)"
  echo " - pipx:           $(pipx --version 2>&1)"
  echo " - uv:             $(uv --version 2>&1)"
}

echoExecOk main "${@-}"
# Script End
