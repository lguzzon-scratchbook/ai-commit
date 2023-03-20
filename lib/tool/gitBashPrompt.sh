#!/usr/bin/env bash
set -e
set -o pipefail
set -o xtrace

# https://github.com/lguzzon/sexy-bash-prompt
(cd /tmp \
  && touch ~/.bash_profile \
  && touch ~/.bashrc \
  && (rm -Rf sexy-bash-prompt || true) \
  && git clone --depth 1 --config core.autocrlf=false https://github.com/twolfson/sexy-bash-prompt \
  && cd sexy-bash-prompt \
  && (hash make &>/dev/null || sudo apt -y install build-essential || (sudo apt update && sudo apt -y install build-essential)) \
  && make install \
  && cd .. \
  && rm -Rf sexy-bash-prompt) \
  && echo Restart shell to see new promt
