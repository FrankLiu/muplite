#!/bin/bash

sudo mkdir -p /opt/<%= name %>/
sudo mkdir -p /opt/<%= name %>/config
sudo mkdir -p /opt/<%= name %>/tmp
sudo chown ${USER} /opt/<%= name %> -R

#sudo mkdir -p /opt/mongodb
#sudo chown ${USER} /opt/mongodb -R
