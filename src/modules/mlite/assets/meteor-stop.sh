#!/bin/bash

# set -x
set -e

## check nvm
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"

. /etc/profile

APPNAME=<%= name %>

sudo pm2 stop $APPNAME && exit 0
