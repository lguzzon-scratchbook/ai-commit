#!/usr/bin/env bash

# Tips: all the quotes  --> "'`
# Tips: other chars --> ~
# Tips: script path --> $(readlink -f "${0%/*}")

include "commons.sh"
include "lib_apt.sh"
include "lib_ssh.sh"

readonly hosts="${script_dir}/hosts.txt"
readonly clusterHosts=$([ -f "${hosts}" ] && sed 's/^[ \t]\+//g;s/[ \t]\+.*$//g' "${hosts}" | sort -t "." -u -n -nk1,1 -nk2,2 -nk3,3 -nk4,4 | sed 's/^[ \t*]\+//g;s/[ \t]\+.*$//g')
readonly clusterHostsCount=$( ([ -z "$clusterHosts" ] && echo "0") || echo "${clusterHosts}" | wc -l)
readonly primaryHost=$(echo "${clusterHosts}" | head -n 1)
readonly secondaryHostsCount=$( ([ -z "$clusterHosts" ] && echo "0") || (("$clusterHostsCount" - 1)))
readonly secondaryHosts=$(echo "${clusterHosts}" | tail -n "${secondaryHostsCount}")

clusterHostsAsSeparatorList() {
  local lSeparator="${1:-,}"
  local lResult=""

  if (notEmpty "${primaryHost}"); then
    lResult=${primaryHost}
    for lServerIP in ${secondaryHosts}; do
      lResult="${lResult}${lSeparator}${lServerIP}"
    done
  fi
  echo "${lResult}"
}

readonly clusterHostsCommaSeparated=$(clusterHostsAsSeparatorList)

clusterHostsAsNameSeparatorList() {
  local -r lPrefix="${1}"
  local -r lSeparator="${2:-,}"
  local lResult

  local i=0
  if (notEmpty "${primaryHost}"); then
    lResult=$(printf "${lPrefix}%02d" "${i}")
    i=$(("$i" + 1))
    for lServerIP in ${secondaryHosts}; do
      lResult="${lResult}${lSeparator}$(printf "${lPrefix}%02d" "${i}")"
      i=$(("$i" + 1))
    done
  fi
  echo "${lResult}"
}

forEachHost() {
  for lServerIP in ${clusterHosts}; do
    ( (echoExecOk safeSSH root "${lServerIP}" "$@" || (sleep 5 && echo "2 Try" && echoExecOk safeSSH root "${lServerIP}" "$@") || (sleep 10 && echo "3 Try" && echoExecOk safeSSH root "${lServerIP}" "$@")) 2>&1 | teeNoColor "${script_log_dir}/${lServerIP}.log") &
  done
  wait
}

forEachHostSeq() {
  for lServerIP in ${clusterHosts}; do
    ( (echoExecOk safeSSH root "${lServerIP}" "$@" || (sleep 5 && echo "2 Try" && echoExecOk safeSSH root "${lServerIP}" "$@") || (sleep 10 && echo "3 Try" && echoExecOk safeSSH root "${lServerIP}" "$@")) 2>&1 | teeNoColor "${script_log_dir}/${lServerIP}.log")
  done
}

forPrimaryHost() {
  local -r lServerIP=${primaryHost}
  ( (echoExecOk safeSSH root "${lServerIP}" "$@" || (sleep 5 && echo "2 Try" && echoExecOk safeSSH root "${lServerIP}" "$@") || (sleep 10 && echo "3 Try" && echoExecOk safeSSH root "${lServerIP}" "$@")) 2>&1 | teeNoColor "${script_log_dir}/${lServerIP}.log")
  return $?
}

forEachSecondaryHost() {
  for lServerIP in ${secondaryHosts}; do
    ( (echoExecOk safeSSH root "${lServerIP}" "$@" || (sleep 5 && echo "2 Try" && echoExecOk safeSSH root "${lServerIP}" "$@") || (sleep 10 && echo "3 Try" && echoExecOk safeSSH root "${lServerIP}" "$@")) 2>&1 | teeNoColor "${script_log_dir}/${lServerIP}.log") &
  done
  wait
}

forEachSecondaryHostSeq() {
  for lServerIP in ${secondaryHosts}; do
    ( (echoExecOk safeSSH root "${lServerIP}" "$@" || (sleep 5 && echo "2 Try" && echoExecOk safeSSH root "${lServerIP}" "$@") || (sleep 10 && echo "3 Try" && echoExecOk safeSSH root "${lServerIP}" "$@")) 2>&1 | teeNoColor "${script_log_dir}/${lServerIP}.log")
  done
}

cmdForEachHost() {
  for lServerIP in ${clusterHosts}; do
    ($* ${lServerIP}) &
  done
  wait
  return $?
}

hostsAddSSHKey() {
  local -r lClusterHosts=${1:-${clusterHosts}}
  local -r lUser=${2:-root}
  mkdir -p "${HOME}/.ssh"
  chmod 700 "${HOME}/.ssh"
  [[ -f "${HOME}/.ssh/id_rsa.pub" ]] || (sudo apt -y install openssh-client && ssh-keygen -t rsa -f "${HOME}/.ssh/id_rsa" -P "")
  for lServerIP in ${lClusterHosts}; do
    echoExecOk ssh-copy-id -i "${HOME}/.ssh/id_rsa.pub" $lUser@"${lServerIP}" 2>&1 | teeNoColor "${script_log_dir}/${lServerIP}.log"
    if [[ ${PIPESTATUS[0]} -ne 0 ]]; then
      exit 1
    fi
  done
}

hostsRemoveSSHKey() {
  local -r lClusterHosts=${1:-${clusterHosts}}
  local -r lUser=${2:-root}
  mkdir -p "${HOME}/.ssh"
  chmod 700 "${HOME}/.ssh"
  for lServerIP in ${lClusterHosts}; do
    echoExecOk ssh-keygen -f "${HOME}/.ssh/known_hosts" -R "${lServerIP}" 2>&1 | teeNoColor "${script_log_dir}/${lServerIP}.log"
    if [[ ${PIPESTATUS[0]} -ne 0 ]]; then
      exit 1
    fi
  done
  return $?
}

hostsAddSudoUser() {
  local -r lUserPassword=${1:-$(getRandomString 37)}
  local -r lUserName=${2:-"suser"}
  local -r lHost=${3-}
  local -r lCommand="\
       sudo killall -u ${lUserName} \
    ;  userdel -fr ${lUserName} \
    ;  adduser --gecos '' --disabled-password ${lUserName} \
    && echo \"${lUserName}:${lUserPassword}\" | chpasswd \
    && sudo usermod -aG sudo ${lUserName} \
    && ( sudo sed -i '/${lUserName} ALL=(ALL:ALL) NOPASSWD: ALL/d' /etc/sudoers.d/${lUserName} \
       ; echo '${lUserName} ALL=(ALL:ALL) NOPASSWD: ALL' | sudo tee /etc/sudoers.d/${lUserName} ) \
    && mkdir -p /home/${lUserName}/.ssh \
    && touch /home/${lUserName}/.ssh/authorized_keys \
    && sudo chown -R ${lUserName}:${lUserName} /home/${lUserName}/.ssh \
    && sudo chmod 0700 /home/${lUserName}/.ssh \
    && sudo chmod 0600 /home/${lUserName}/.ssh/authorized_keys \
    && sudo groupadd docker \
    && sudo usermod -aG docker ${lUserName}
    "
  echo "User -> name[${lUserName}] password[${lUserPassword}]"
  if isEmpty "${lHost}"; then
    echoExecOk forEachHost "${lCommand}"
  else
    echoExecOk sshRootHost "${lHost}" "${lCommand}"
  fi
}

hostsSyncTime() {
  # See here: https://www.digitalocean.com/community/tutorials/how-to-set-up-time-synchronization-on-ubuntu-16-04
  echoExecOk forEachHost "\
     sudo timedatectl \
  && sudo timedatectl set-ntp on \
  && sudo timedatectl"
}

hostsBench() {
  # See here: https://github.com/n-st/nench
  echoExecOk forEachHost "curl -s wget.racing/nench.sh | bash"
}

hostsRemoveOldKernel() {
  echoExecOk forEachHost "${aptInstall} aptitude"
  echoExecOk forEachHost "aptitude -y purge ~ilinux-image-\[0-9\]\(\!\$(uname -r)\) && update-grub2"
}

hostsResetToMinimalAndReboot() {
  echoExecOk hostsSetVmParams
  echoExecOk forEachHost "${uResetInstalls}"
  echoExecOk forEachHost "${aptUpdate}"
  echoExecOk forEachHost "${aptInstall} aptitude ubuntu-minimal"
  echoExecOk forEachHost "\
     aptitude -y markauto '~i!~nubuntu-minimal' \
  && ${aptInstall} apt aptitude dpkg update-manager-core htop unattended-upgrades xz-utils linux-image-generic ssh cloud-guest-utils cloud-initramfs-copymods cloud-initramfs-dyn-netconf lvm2 snapd"
  echoExecOk forEachHost "dpkg-reconfigure -f noninteractive tzdata"
  echoExecOk forEachHost "usermod --expiredate 1 user ; exit 0"
  echoExecOk forEachHost "deluser --remove-home --remove-all-files user ; exit 0"
  echoExecOk forEachHost "service ssh --full-restart"
  echoExecOk hostsReboot
  echoExecOk waitSSHs
  echoExecOk hostsSetVmParams
  echoExecOk forEachHost "${uResetInstalls}"
  echoExecOk forEachHost "${aptUpdate}"
  echoExecOk forEachHost "sed -i -e 's/^COMPRESS=.*$/COMPRESS=xz/g' \"/etc/initramfs-tools/initramfs.conf\""
  echoExecOk forEachHost "sed -i -e 's/MODULES=most/MODULES=dep/g' \"/etc/initramfs-tools/initramfs.conf\""
  echoExecOk forEachHost "aptitude -y purge ~ilinux-image-\[0-9\]\(\!\$(uname -r)\)"
  echoExecOk forEachHost "${aptUpgrade}"
  echoExecOk forEachHost "update-initramfs -u -k all"
  echoExecOk forEachHost "update-grub2"
  echoExecOk forEachHost "service ssh --full-restart"
  echoExecOk hostsReboot
  echoExecOk waitSSHs
  echoExecOk hostsSetVmParams
}

hostsReboot() {
  local -r lHost=${1-}
  local -r lCommand="\
     for dmrc in /dev/mapper/rc-*; do dmsetup message \"\${dmrc}\" 0 flush; dmsetup suspend \"\${dmrc}\"; dmsetup resume \"\${dmrc}\"; true; done \
  && ( nohup shutdown -r now & ) ; exit 0"
  if isEmpty "${lHost}"; then
    echoExecOk forEachHost "${lCommand}"
  else
    echoExecOk sshRootHost "${lHost}" "${lCommand}"
  fi
  return $?
}

hostsSetVmParams() {
  # See here: https://unix.stackexchange.com/questions/30286/can-i-configure-my-linux-system-for-more-aggressive-file-system-caching#41831
  # echoExecOk forEachHost "\
  #    echo 15 > /proc/sys/vm/swappiness \
  # && echo 10 > /proc/sys/vm/vfs_cache_pressure \
  # && echo 99 > /proc/sys/vm/dirty_ratio \
  # && echo 50 > /proc/sys/vm/dirty_background_ratio \
  # && echo 360000 > /proc/sys/vm/dirty_expire_centisecs \
  # && echo 360000 > /proc/sys/vm/dirty_writeback_centisecs"

  # Originals
  # echoExecOk forEachHost "\
  #    echo 60 > /proc/sys/vm/swappiness \
  # && echo 100 > /proc/sys/vm/vfs_cache_pressure \
  # && echo 20 > /proc/sys/vm/dirty_ratio \
  # && echo 10 > /proc/sys/vm/dirty_background_ratio \
  # && echo 3000 > /proc/sys/vm/dirty_expire_centisecs \
  # && echo 500 > /proc/sys/vm/dirty_writeback_centisecs"

  # Show values ...
  # echoExecOk forEachHost "\
  #   cat /proc/sys/vm/swappiness \
  # && cat /proc/sys/vm/vfs_cache_pressure \
  # && cat /proc/sys/vm/dirty_ratio \
  # && cat /proc/sys/vm/dirty_background_ratio \
  # && cat /proc/sys/vm/dirty_expire_centisecs \
  # && cat /proc/sys/vm/dirty_writeback_centisecs"

  # Set values
  local -r lHost=${1-}
  local -r lCommand="\
     echo 15 > /proc/sys/vm/swappiness \
  && echo 100 > /proc/sys/vm/vfs_cache_pressure \
  && echo 20 > /proc/sys/vm/dirty_ratio \
  && echo 10 > /proc/sys/vm/dirty_background_ratio \
  && echo 360000 > /proc/sys/vm/dirty_expire_centisecs \
  && echo 360000 > /proc/sys/vm/dirty_writeback_centisecs"
  if isEmpty "${lHost}"; then
    echoExecOk forEachHost "${lCommand}"
  else
    echoExecOk sshRootHost "${lHost}" "${lCommand}"
  fi
  return $?
}

hostsGetVmParams() {
  # See here: https://unix.stackexchange.com/questions/30286/can-i-configure-my-linux-system-for-more-aggressive-file-system-caching#41831
  # Get values
  local -r lHost=${1-}
  local -r lCommand="\
     echo \"swappiness                [\$(cat /proc/sys/vm/swappiness)]\" \
  && echo \"vfs_cache_pressure        [\$(cat /proc/sys/vm/vfs_cache_pressure)]\" \
  && echo \"dirty_ratio               [\$(cat /proc/sys/vm/dirty_ratio)]\" \
  && echo \"dirty_background_ratio    [\$(cat /proc/sys/vm/dirty_background_ratio)]\" \
  && echo \"dirty_expire_centisecs    [\$(cat /proc/sys/vm/dirty_expire_centisecs)]\" \
  && echo \"dirty_writeback_centisecs [\$(cat /proc/sys/vm/dirty_writeback_centisecs)]\" \
  "
  if isEmpty "${lHost}"; then
    echoExecOk forEachHost "${lCommand}"
  else
    echoExecOk sshRootHost "${lHost}" "${lCommand}"
  fi
}

hostCheckPackageInstalled() {
  local -r lPackageName="${1}"
  local -r lHost="${2}"
  local -r lCommand="dpkg-query -W -f='\${Status}' \"${lPackageName}\" 2>/dev/null | grep -c \"ok installed\""
  local -r lInstalled=$(sshRootHost "${lHost}" "${lCommand}")
  if [[ $lInstalled -eq 0 ]]; then
    echoExecOk sshRootHost "${lHost}" "apt -y install ${lPackageName}"
    echoExecOk hostsReboot "${lHost}"
    echoExecOk waitSSH "${lHost}"
    echoExecOk hostsSetVmParams "${lHost}"
  fi
  return $?
}

hostsInstallAndReboot() {
  cmdForEachHost "hostCheckPackageInstalled" "$1"
  return $?
}
