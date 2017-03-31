import * as _ from 'underscore';

import {getPm2Logs, resolvePath, runTaskList } from '../utils';

import buildApp from '../meteor/build.js';
import debug from 'debug';
import nodemiral from 'nodemiral';
import random from 'random-seed';
import uuid from 'uuid';
import os from 'os';

const log = debug('mup:module:mlite');

function tmpBuildPath(appPath) {
  let rand = random.create(appPath);
  let uuidNumbers = [];
  for (let i = 0; i < 16; i++) {
    uuidNumbers.push(rand(255));
  }
  return resolvePath(
    os.tmpdir(),
    `mup-meteor-${uuid.v4({ random: uuidNumbers })}`
  );
}

export function help() {
  log('exec => mup mlite help');
  console.log('mup mlite', Object.keys(this));
}

export function logs(api) {
  log('exec => mup mlite logs');
  const config = api.getConfig().meteor;
  if (!config) {
    console.error('error: no configs found for meteor');
    process.exit(1);
  }

  const sessions = api.getSessions(['meteor']);
  return getPm2Logs(config.name, sessions);
}

export function setup(api) {
  log('exec => mup meteor setup');
  const config = api.getConfig().meteor;
  if (!config) {
    console.error('error: no configs found for meteor');
    process.exit(1);
  }

  const list = nodemiral.taskList('Setup Meteor');

  list.executeScript('Setup Environment', {
    script: resolvePath(__dirname, 'assets/meteor-setup.sh'),
    vars: {
      name: config.name
    }
  });
  list.executeScript('Installing gcc++ and make', {
    script: resolvePath(__dirname, 'assets/install-init.sh')
  });
  list.executeScript('Installing NVM', {
    script: resolvePath(__dirname, 'assets/install-nvm.sh')
  });
  list.executeScript('Installing Nodejs', {
    script: resolvePath(__dirname, 'assets/install-nodejs.sh')
  });
  list.executeScript('Installing PM2', {
    script: resolvePath(__dirname, 'assets/install-pm2.sh')
  });
  if (config.setup.mongo) {
    list.executeScript('Installing MongoDB', {
      script: resolvePath(__dirname, 'assets/install-mongodb.sh')
    });
  }

  if (config.ssl && typeof config.ssl.autogenerate !== 'object') {
    const basePath = api.getBasePath();

    if (config.ssl.upload !== false) {
      list.copy('Copying SSL Certificate Bundle', {
        src: resolvePath(basePath, config.ssl.crt),
        dest: config.setup.path + config.name + '/config/bundle.crt'
      });

      list.copy('Copying SSL Private Key', {
        src: resolvePath(basePath, config.ssl.key),
        dest: config.setup.path + config.name + '/config/private.key'
      });
    }

    // not support ssl for the moment
    // list.executeScript('Verifying SSL Configurations', {
    //   script: resolvePath(__dirname, 'assets/verify-ssl-config.sh'),
    //   vars: {
    //     name: config.name
    //   }
    // });
  }

  const sessions = api.getSessions(['meteor']);
  return runTaskList(list, sessions);
}

export function push(api) {
  log('exec => mup meteor push');
  const config = api.getConfig().meteor;
  if (!config) {
    console.error('error: no configs found for meteor');
    process.exit(1);
  }

  const appPath = resolvePath(api.getBasePath(), config.path);

  let buildOptions = config.buildOptions || {};
  buildOptions.buildLocation = buildOptions.buildLocation ||
  tmpBuildPath(appPath);
  console.log('Building App Bundle Locally');

  var bundlePath = resolvePath(buildOptions.buildLocation, 'bundle.tar.gz');

  return buildApp(appPath, buildOptions).then(() => {
    const list = nodemiral.taskList('Pushing Meteor App');
    list.execute('Create Project Directory', {
      command: 'mkdir -p ' + config.setup.path + config.name + '/tmp/'
    });
    list.copy('Pushing Meteor App Bundle to The Server', {
      src: bundlePath,
      dest: config.setup.path + config.name + '/tmp/bundle.tar.gz',
      progressBar: config.enableUploadProgressBar
    });

    const sessions = api.getSessions(['meteor']);
    return runTaskList(list, sessions, { series: true });
  });
}

export function envconfig(api) {
  log('exec => mup meteor envconfig');

  const config = api.getConfig().meteor;
  if (!config) {
    console.error('error: no configs found for meteor');
    process.exit(1);
  }

  const list = nodemiral.taskList('Setup Meteor Env');
  list.copy('Uploading pm start script', {
    src: resolvePath(__dirname, 'assets/templates/app.json'),
    dest: config.setup.path + config.name + '/app.json',
    vars: {
      appName: config.name,
      env: config.env
    }
  });

  // settings.json
  list.copy('Uploading app settings.json', {
    src: resolvePath(api.getBasePath(), 'settings.json'),
    dest: config.setup.path + config.name + '/settings.json'
  });

  var env = _.clone(config.env);
  env.METEOR_SETTINGS = JSON.stringify(api.getSettings());

  list.copy('Sending Environment Variables', {
    src: resolvePath(__dirname, 'assets/templates/env.list'),
    dest: config.setup.path + config.name + '/config/env.list',
    vars: {
      env: env || {},
      appName: config.name
    }
  });

  const sessions = api.getSessions(['meteor']);
  return runTaskList(list, sessions, { series: true });
}

export function start(api) {
  log('exec => mup meteor start');
  const config = api.getConfig().meteor;
  if (!config) {
    console.error('error: no configs found for meteor');
    process.exit(1);
  }

  const list = nodemiral.taskList('Start Meteor');

  list.executeScript('Start Meteor', {
    script: resolvePath(__dirname, 'assets/meteor-start.sh'),
    vars: {
      rootPath: config.setup.path,
      rootPort: config.env.PORT,
      appName: config.name
    }
  });

  list.executeScript('Verifying Deployment', {
    script: resolvePath(__dirname, 'assets/meteor-deploy-check.sh'),
    vars: {
      deployCheckWaitTime: config.deployCheckWaitTime || 60,
      appName: config.name,
      deployCheckPort: config.deployCheckPort || config.env.PORT || 80
    }
  });

  const sessions = api.getSessions(['meteor']);
  return runTaskList(list, sessions, { series: true });
}

export function deploy(api) {
  log('exec => mup meteor deploy');

  // validate settings and config before starting
  api.getSettings();
  const config = api.getConfig().meteor;
  if (!config) {
    console.error('error: no configs found for meteor');
    process.exit(1);
  }

  return push(api).then(() => envconfig(api)).then(() => start(api));
}

export function stop(api) {
  log('exec => mup meteor stop');
  const config = api.getConfig().meteor;
  if (!config) {
    console.error('error: no configs found for meteor');
    process.exit(1);
  }

  const list = nodemiral.taskList('Stop Meteor');

  list.executeScript('Stop Meteor', {
    script: resolvePath(__dirname, 'assets/meteor-stop.sh'),
    vars: {
      appName: config.name
    }
  });

  const sessions = api.getSessions(['meteor']);
  return runTaskList(list, sessions);
}
