#!/usr/bin/env bash

# Tips: all the quotes  --> "'`
# Tips: other chars --> ~
# Tips: script path --> $(readlink -f "${0%/*}")

include "commons.sh"
include "lib_apt.sh"
include "lib_hosts.sh"

docker_Install_CMD() {
  cat <<EOF
    ${uResetInstalls}
    ${aptPurge} docker docker-engine docker.io containerd runc
    ${aptUpdate}
    ${aptInstall} dpkg-dev apt-transport-https ca-certificates curl software-properties-common gnupg lsb-release
    sudo bash -c "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -"
    sudo add-apt-repository "deb [arch=\$(dpkg --print-architecture)] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable"
    ${aptUpdate}
    ${aptInstall} docker-ce docker-ce-cli containerd.io
    sudo docker run hello-world
    sudo docker-compose --version
EOF
  return $?
}

docker_Uninstall_CMD() {
  cat <<EOF
    ${uResetInstalls}
    ${aptPurge} docker docker-engine docker.io containerd runc \
                docker-ce docker-ce-cli containerd.io docker-compose
    sudo rm -rf /var/lib/docker
    sudo rm -Rf /etc/docker
    sudo rm -rf /var/lib/containerd
EOF
  return $?
}

docker_Install() {
  echoExecOk forEachHost "$(docker_Install_CMD)" \
    && echoExecOk dockerCompose_Install
  return $?
}

docker_Uninstall() {
  echoExecOk swarm_Teardown \
    && echoExecOk dockerCompose_Uninstall \
    && echoExecOk forEachHost "$(docker_Uninstall_CMD)"
  return $?
}

docker_Reset() {
  echoExecOk docker_Uninstall \
    && echoExecOk docker_Install
  return $?
}

docker_Install_Local() {
  echoExecOk eval "$(docker_Install_CMD)" \
    && echoExecOk dockerCompose_Install_Local
  return $?
}

docker_Uninstall_Local() {
  echoExecOk swarm_Teardown_Local \
    && echoExecOk dockerCompose_Uninstall_Local \
    && echoExecOk eval "$(docker_Uninstall_CMD)"
  return $?
}

docker_Reset_Local() {
  echoExecOk docker_Uninstall_Local \
    && echoExecOk docker_Install_Local
  return $?
}

docker_NoRootUser_Install_CMD() {
  local -r lUser=${1:-$USER}
  cat <<EOF
  sudo groupadd docker || true
  sudo usermod -aG docker "${lUser}"
  sudo chown "${lUser}":"${lUser}" "/home/${lUser}/.docker" -R || true
  sudo chmod g+rwx "/home/${lUser}/.docker" -R || true
EOF
  # newgrp docker
  return $?
}

docker_NoRootUser_Install() {
  local -r lUser=${1:-$USER}
  echoExecOk eval "$(docker_NoRootUser_Install_CMD ${lUser})"
  return $?
}

dockerCompose_Install_CMD() {
  # https://docs.docker.com/compose/install/
  cat <<EOF
  ${aptPurge} docker-compose
  readonly lLatestRelease=\$(curl -L -s -H 'Accept: application/json' "https://github.com/docker/compose/releases/latest")
  readonly lLatestReleaseVersion=\$(echo \${lLatestRelease} | sed -e 's/.*"tag_name":"\([^"]*\)".*/\1/')
  echo \$lLatestReleaseVersion
  sudo curl -L "https://github.com/docker/compose/releases/download/\${lLatestReleaseVersion}/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  docker-compose --version
EOF
  return $?
}

dockerCompose_Uninstall_CMD() {
  # https://docs.docker.com/compose/install/
  cat <<EOF
  docker-compose --version
  ${aptPurge} docker-compose
  [ -f /usr/local/bin/docker-compose ] && sudo rm /usr/local/bin/docker-compose
  docker-compose --version || true
EOF
  return $?
}

dockerCompose_Install() {
  echoExecOk forEachHost "$(dockerCompose_Install_CMD)"
  return $?
}

dockerCompose_Uninstall() {
  echoExecOk forEachHost "$(dockerCompose_Uninstall_CMD)"
  return $?
}

dockerCompose_Reset() {
  echoExecOk dockerCompose_Uninstall \
    && echoExecOk dockerCompose_Install
  return $?
}

dockerCompose_Install_Local() {
  echoExecOk eval "$(dockerCompose_Install_CMD)"
  return $?
}

dockerCompose_Uninstall_Local() {
  echoExecOk eval "$(dockerCompose_Uninstall_CMD)"
  return $?
}

dockerCompose_Reset_Local() {
  echoExecOk dockerCompose_Uninstall_Local \
    && echoExecOk dockerCompose_Install_Local
}

swarm_Teardown_CMD() {
  cat <<EOF
  sudo docker swarm leave --force || true
EOF
  return $?
}

swarm_Teardown() {
  echoExecOk forEachHost "$(swarm_Teardown_CMD)"
  return $?
}

swarm_Teardown_Local() {
  echoExecOk eval "$(swarm_Teardown_CMD)"
  return $?
}

swarm_Setup() {
  echoExecOk sshRootHost "${primaryHost}" "docker swarm init"
  local lResult=$?
  if [ "$lResult" -eq "0" ]; then
    local -r lToken=$(sshRootHost "${primaryHost}" "docker swarm join-token manager -q")
    echoExecOk forEachSecondaryHost "docker swarm join --token ${lToken} ${primaryHost}:2377"
    lResult=$?
  fi
  reteurn $lResult
}

swarm_ReSetup() {
  (echoExecOk swarm_Teardown) \
    && (echoExecOk swarm_Setup)
  return $?
}

swarm_Uninstall() {
  echoExecOk docker_Uninstall
  return $?
}

swarm_Install() {
  (echoExecOk docker_Install) \
    && (echoExecOk swarm_Setup)
  return $?
}

swarm_Reset() {
  (echoExecOk swarm_Uninstall) \
    && (echoExecOk swarm_Install)
  return $?
}

# Command line shortcuts
#        -docker_i | --dockerInstall) (echoExecOk docker_Install) ;;
#        -docker_il | --dockerInstallLocal) (echoExecOk docker_Install_Local) ;;
#        -docker_r | --dockerReset) (echoExecOk docker_Reset) ;;
#        -docker_rl | --dockerResetLocal) (echoExecOk docker_Reset_Local) ;;
#        -docker_u | --dockerUninstall) (echoExecOk docker_Uninstall) ;;
#        -docker_ul | --dockerUninstallLocal) (echoExecOk docker_Uninstall_Local) ;;
#        -swarm_i | --swarmInstall) (echoExecOk swarm_Install) ;;
#        -swarm_r | --swarmReset) (echoExecOk swarm_Reset) ;;
#        -swarm_rs | --swarmReSetup) (echoExecOk swarm_ReSetup) ;;
#        -swarm_s | --swarmSetup) (echoExecOk swarm_Setup) ;;
#        -swarm_u | --swarmUninstall) (echoExecOk swarm_Uninstall) ;;
#        -swarm_t | --swarmTeardown) (echoExecOk swarm_Teardown) ;;
#
