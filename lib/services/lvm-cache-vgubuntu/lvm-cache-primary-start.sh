#!/usr/bin/env bash

HOST_MEMORY=$(free -k | grep 'Mem:' | awk '{print $2}')
echo "HOST_MEMORY ${HOST_MEMORY}"
# shellcheck disable=SC2017
RAMDISK_MEMORY=$((HOST_MEMORY / 6 / 4 / 1024 * 4 * 1024))
echo "RAMDISK_MEMORY ${RAMDISK_MEMORY}"
RAMDISK_MAX_MEMORY=$((1024 * 1024 * 2))
echo "RAMDISK_MAX_MEMORY ${RAMDISK_MAX_MEMORY}"
RAMDISK_MEMORY=$((RAMDISK_MEMORY > RAMDISK_MAX_MEMORY ? RAMDISK_MAX_MEMORY : RAMDISK_MEMORY))
echo "RAMDISK_MEMORY ${RAMDISK_MEMORY}"
CACHE_VOL_MEMORY=$((RAMDISK_MEMORY - 20 * 1024))
echo "CACHE_VOL_MEMORY ${CACHE_VOL_MEMORY}"
modprobe brd rd_nr=1 rd_size=${RAMDISK_MEMORY} max_part=0
pvcreate /dev/ram0
# Remember to change the group see with lvdisplay
VOLUME_GROUP="vgubuntu"
vgextend ${VOLUME_GROUP} /dev/ram0
lvcreate -L ${CACHE_VOL_MEMORY}K -n cache_vol ${VOLUME_GROUP} /dev/ram0
lvconvert --cache --cachepool ${VOLUME_GROUP}/cache_vol --cachemode=writeback ${VOLUME_GROUP}/root -y
