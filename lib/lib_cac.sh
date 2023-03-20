#!/usr/bin/env bash

# Tips: all the quotes  --> "'`
# Tips: other chars --> ~
# Tips: script path --> $(readlink -f "${0%/*}")

include "commons.sh"
include "lib_hosts.sh"

# https://github.com/oracle/linux-blog-sample-code/
# https://blog.delouw.ch/2020/01/29/using-lvm-cache-for-storage-tiering/
# https://github.com/standard-error/lvmcache-statistics/blob/master/lvmcache-statistics.sh

installService_cacLvmCachePrimary() {
  local -r lcacLvmCachePath="$(getScriptDir $BASH_SOURCE)/services/cac-lvm-cache"
  echoExecOk sshRootHost "${primaryHost}" 'mkdir -p "$HOME/cac/services" && (rm -Rf "$HOME/cac/services/cac-lvm-cache" || true)'
  echoExecOk scp -i "${HOME}/.ssh/id_rsa" -r "${lcacLvmCachePath}" "root@${primaryHost}:~/cac/services"
  echoExecOk sshRootHost "${primaryHost}" 'chmod +x "$HOME/cac/services/cac-lvm-cache/cac-lvm-cache-install.sh"'
  echoExecOk sshRootHost "${primaryHost}" '"$HOME/cac/services/cac-lvm-cache/cac-lvm-cache-install.sh" -r'
}

installService_cacLvmCache() {
  local -r lcacLvmCachePath="$(getScriptDir $BASH_SOURCE)/services/cac-lvm-cache"
  echoExecOk forEachHost 'mkdir -p "$HOME/cac/services" && (rm -Rf "$HOME/cac/services/cac-lvm-cache" || true)'
  for lServerIP in ${clusterHosts}; do
    (echoExecOk scp -i "${HOME}/.ssh/id_rsa" -r "${lcacLvmCachePath}" "root@${lServerIP}:~/cac/services" 2>&1 | teeNoColor "${script_log_dir}/${lServerIP}.log") &
  done
  wait
  echoExecOk forEachHost '\
    chmod +x "$HOME/cac/services/cac-lvm-cache/cac-lvm-cache-install.sh" && \
    "$HOME/cac/services/cac-lvm-cache/cac-lvm-cache-install.sh" -r \
  '
}

readonly ROOT='/'

cacRootMount() {
  local -r ROOT_MOUNT=$(df --output=source "$ROOT" | grep ^/dev)
  if [ -z "$ROOT_MOUNT" ]; then
    echo "Invalid root fs device configuration" >&2
    return 1
  fi
  echo "$ROOT_MOUNT"
  return 0
}

cacHostsLVMCachePool_i() {
  echoExecOk forEachHost "\
       export HOST_MEMORY=\$(free -k | grep 'Mem:' | awk '{print \$2}') \
    ;  echo \"HOST_MEMORY \${HOST_MEMORY}\" \
    ;  export RAMDISK_MEMORY=\$((\${HOST_MEMORY}*2/3)) \
    ;  echo \"RAMDISK_MEMORY \${RAMDISK_MEMORY}\" \
    ;  export RAMDISK_MAX_MEMORY=\$((1024*1024*5)) \
    ;  echo \"RAMDISK_MAX_MEMORY \${RAMDISK_MAX_MEMORY}\" \
    ;  RAMDISK_MEMORY=\$((RAMDISK_MEMORY>RAMDISK_MAX_MEMORY ? RAMDISK_MAX_MEMORY : RAMDISK_MEMORY)) \
    ;  echo \"RAMDISK_MEMORY \${RAMDISK_MEMORY}\" \
    ;  export CACHE_VOL_MEMORY=\$((RAMDISK_MEMORY*4/5)) \
    ;  echo \"CACHE_VOL_MEMORY \${CACHE_VOL_MEMORY}\" \
    ;  export CACHE_META_MEMORY=\$(( (RAMDISK_MEMORY-CACHE_VOL_MEMORY)*9/20 )) \
    ;  echo \"CACHE_META_MEMORY \${CACHE_META_MEMORY}\" \
    ;  modprobe brd rd_nr=1 rd_size=\${RAMDISK_MEMORY} max_part=0 \
    && pvcreate /dev/ram0 \
    && vgextend ubuntu-vg /dev/ram0 \
    && lvcreate -L \${CACHE_VOL_MEMORY}K -n cache_vol ubuntu-vg /dev/ram0 \
    && lvcreate -L \${CACHE_META_MEMORY}K -n cache_meta ubuntu-vg /dev/ram0 \
    && lvconvert --type cache-pool --poolmetadata ubuntu-vg/cache_meta ubuntu-vg/cache_vol -y \
    && lvconvert --type cache --cachepool ubuntu-vg/cache_vol --cachemode=writeback ubuntu-vg/root -y \
    "
  return $?
}

cacHostsLVMCachePool_u() {
  echoExecOk forEachHost "\
      lvremove ubuntu-vg/cache_meta -v -y \
    ; lvremove ubuntu-vg/cache_vol -v -y \
    ; vgreduce --removemissing ubuntu-vg -v \
    ; vgreduce ubuntu-vg /dev/ram0 -v \
    ; pvremove /dev/ram0 -v \
    ; rmmod brd \
    ; true \
    "
  return $?
}

cacHostsLVMCachePool_r() {
  echoExecOk cacHostsLVMCachePool_u \
    && echoExecOk cacHostsLVMCachePool_i
  return $?
}

cacHostsLVMCacheNoPool_i() {
  echoExecOk forEachHost "\
       export HOST_MEMORY=\$(free -k | grep 'Mem:' | awk '{print \$2}') \
    ;  echo \"HOST_MEMORY \${HOST_MEMORY}\" \
    ;  export RAMDISK_MEMORY=\$((HOST_MEMORY/6/4/1024*4*1024)) \
    ;  echo \"RAMDISK_MEMORY \${RAMDISK_MEMORY}\" \
    ;  export RAMDISK_MAX_MEMORY=\$((1024*1024*5)) \
    ;  echo \"RAMDISK_MAX_MEMORY \${RAMDISK_MAX_MEMORY}\" \
    ;  RAMDISK_MEMORY=\$((RAMDISK_MEMORY>RAMDISK_MAX_MEMORY ? RAMDISK_MAX_MEMORY : RAMDISK_MEMORY)) \
    ;  echo \"RAMDISK_MEMORY \${RAMDISK_MEMORY}\" \
    ;  export CACHE_VOL_MEMORY=\$((RAMDISK_MEMORY-20*1024)) \
    ;  echo \"CACHE_VOL_MEMORY \${CACHE_VOL_MEMORY}\" \
    ;  modprobe brd rd_nr=1 rd_size=\${RAMDISK_MEMORY} max_part=0 \
    && pvcreate /dev/ram0 \
    && vgextend ubuntu-vg /dev/ram0 \
    && lvcreate -L \${CACHE_VOL_MEMORY}K -n cache_vol ubuntu-vg /dev/ram0 \
    && lvconvert --cache --cachepool ubuntu-vg/cache_vol --cachemode=writeback ubuntu-vg/root -y \
    "
  return $?
}

cacHostsLVMCacheNoPool_u() {
  echoExecOk forEachHost "\
      lvremove ubuntu-vg/cache_vol -v -y \
    ; lvremove ubuntu-vg/lvol0 -v -y \
    ; vgreduce --removemissing ubuntu-vg -v \
    ; vgreduce ubuntu-vg /dev/ram0 -v \
    ; pvremove /dev/ram0 -v \
    ; rmmod brd \
    ; true
    "
  return $?
}

cacHostsLVMCacheNoPool_r() {
  echoExecOk cacHostsLVMCacheNoPool_u \
    && echoExecOk cacHostsLVMCacheNoPool_i
  return $?
}

cacHostsLVMCache_i() {
  echoExecOk cacHostsLVMCacheNoPool_i
  return $?
}

cacHostsLVMCache_u() {
  echoExecOk cacHostsLVMCacheNoPool_u
  return $?
}

cacHostsLVMCache_r() {
  echoExecOk cacHostsLVMCache_u \
    && echoExecOk cacHostsLVMCache_i
  return $?
}

cacHostsLVMInfos() {
  echoExecOk forEachHost "lvs -a -o +devices,cache_total_blocks,cache_used_blocks,cache_dirty_blocks,cache_read_hits,cache_read_misses,cache_write_hits,cache_write_misses,segtype"
  return $?
}

localLVMCache() {
  true
  #   export HOST_MEMORY=$(free -k | grep 'Mem:' | awk '{print $2}') \
  # ;  echo "HOST_MEMORY ${HOST_MEMORY}" \
  # ;  export RAMDISK_MEMORY=$((${HOST_MEMORY}*2/3)) \
  # ;  echo "RAMDISK_MEMORY ${RAMDISK_MEMORY}" \
  # ;  export RAMDISK_MAX_MEMORY=$((1024*1024*5)) \
  # ;  echo "RAMDISK_MAX_MEMORY ${RAMDISK_MAX_MEMORY}" \
  # ;  RAMDISK_MEMORY=$((RAMDISK_MEMORY>RAMDISK_MAX_MEMORY ? RAMDISK_MAX_MEMORY : RAMDISK_MEMORY)) \
  # ;  echo "RAMDISK_MEMORY ${RAMDISK_MEMORY}" \
  # ;  export CACHE_VOL_MEMORY=$((RAMDISK_MEMORY*4/5)) \
  # ;  echo "CACHE_VOL_MEMORY ${CACHE_VOL_MEMORY}" \
  # ;  export CACHE_META_MEMORY=$(( (RAMDISK_MEMORY-CACHE_VOL_MEMORY)*9/20 )) \
  # ;  echo "CACHE_META_MEMORY ${CACHE_META_MEMORY}" \
  # ;  modprobe brd rd_nr=1 rd_size=${RAMDISK_MEMORY} max_part=0 \
  # && pvcreate /dev/ram0 \
  # && vgextend vgubuntu /dev/ram0 \
  # && lvcreate -L ${CACHE_VOL_MEMORY}K -n cache_vol vgubuntu /dev/ram0 \
  # && lvcreate -L ${CACHE_META_MEMORY}K -n cache_meta vgubuntu /dev/ram0 \
  # && lvconvert --type cache-pool --poolmetadata vgubuntu/cache_meta vgubuntu/cache_vol -y \
  # && lvconvert --type cache --cachepool vgubuntu/cache_vol --cachemode=writeback vgubuntu/root -y
}

cacHostsReboot_Before() {
  echoExecOk waitSSHs
  return $?
}

cacHostsReboot_After() {
  echoExecOk waitSSHs \
    && echoExecOk forEachHost "swapoff -a" \
    && echoExecOk hostsSetVmParams
  return $?
}

cacHostsReboot() {
  echoExecOk cacHostsReboot_Before \
    && echoExecOk hostsReboot \
    && echoExecOk cacHostsReboot_After
  return $?
}

cacUpdateGrub2() {
  echoExecOk forEachHost "update-grub2"
  return $?
}

cacHostsResetToMinimalAndReboot() {
  echoExecOk cacHostsReboot
  echoExecOk installService_cacLvmCache
  echoExecOk forEachHost "${uResetInstalls}"
  echoExecOk forEachHost "${aptUpdate}"
  echoExecOk forEachHost "${aptInstall} aptitude ubuntu-minimal"
  echoExecOk forEachHost "aptitude -y markauto '~i!~nubuntu-minimal' \
    && ${aptInstall} apt aptitude dpkg update-manager-core htop unattended-upgrades xz-utils linux-image-generic ssh cloud-guest-utils cloud-initramfs-copymods cloud-initramfs-dyn-netconf lvm2 snapd"
  echoExecOk forEachHost "dpkg-reconfigure -f noninteractive tzdata"
  echoExecOk forEachHost "usermod --expiredate 1 user ; exit 0"
  echoExecOk forEachHost "deluser --remove-home --remove-all-files user ; exit 0"
  echoExecOk forEachHost "service ssh --full-restart"
  echoExecOk cacHostsReboot
  echoExecOk forEachHost "${uResetInstalls}"
  echoExecOk forEachHost "${aptUpdate}"
  echoExecOk forEachHost "sed -i -e 's/^COMPRESS=.*$/COMPRESS=xz/g' \"/etc/initramfs-tools/initramfs.conf\""
  echoExecOk forEachHost "sed -i -e 's/MODULES=most/MODULES=dep/g' \"/etc/initramfs-tools/initramfs.conf\""
  echoExecOk forEachHost "aptitude -y purge ~ilinux-image-\[0-9\]\(\!\$(uname -r)\)"
  echoExecOk forEachHost "${aptUpgrade}"
  echoExecOk forEachHost "update-initramfs -u -k all"
  echoExecOk forEachHost "update-grub2"
  echoExecOk forEachHost "service ssh --full-restart"
  echoExecOk cacHostsReboot
  return $?
}

cacHostsUpgradeOs() {
  echoExecOk forEachHost "${uResetInstalls} ; ${aptDistUpgrade} ; ${aptClean} ; exit 0" \
    && echoExecOk cacUpdateGrub2 \
    && echoExecOk cacHostsReboot
  return $?
}
