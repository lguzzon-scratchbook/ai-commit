#!/usr/bin/env bash

# Remember to change the group see with lvdisplay
VOLUME_GROUP="usvr-vg"
lvremove ${VOLUME_GROUP}/cache_vol -v -y
lvremove ${VOLUME_GROUP}/lvol0 -v -y
vgreduce --removemissing ${VOLUME_GROUP} -v
vgreduce ${VOLUME_GROUP} /dev/ram0 -v
pvremove /dev/ram0 -v
rmmod brd
