#!/bin/bash

# set -x
set -e

## check nvm
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"

. /etc/profile

APPNAME=<%= name %>

echo "pm2 logs -f $APPNAME"
pm2 logs -f $APPNAME
