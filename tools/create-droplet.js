#!/usr/bin/env node
'use strict';

var provhost = require('provhost');
var nautical = require('nautical');
var argv = require('optimist')

  .alias('u', 'user-data')

  .alias('t', 'token')
  .default('token', process.env.DO_API_TOKEN)

  .alias('m', 'master')
  .default('master', false)

  .alias('r', 'region')
  .default('region', 'sfo1')

  .alias('k', 'ssh-keys')

  .alias('i', 'image')
  .default('image', 'coreos-alpha')

  .alias('s', 'size')
  .default('size', '512mb')

  .alias('n', 'namespace')
  .default('namespace', process.env.DO_NAMESPACE || 'coreos')

  .alias('h', 'hostname')

  .argv;

var api = nautical.getClient({
  token: argv.token
});

var hostname = null;
if (argv.hostname) {
  hostname = argv.hostname;
} else {
  var provhostOpts = {
    namespace: argv.namespace,
    groups: []
  };
  if (argv.master) {
    provhostOpts.groups.push('master');
  } else {
    provhostOpts.groups.push('node');
  }
  hostname = provhost.stringify(provhostOpts);
}

if (argv.k) {
  argv.k = ('' + argv.k).split(',').map(function(keyId) {
    return keyId.trim();
  });
}

var userdata = null;
if (argv.u) {
  userdata = require('fs').readFileSync(argv.u).toString();
}

api.droplets.create({
  name: hostname,
  region: argv.region,
  size: argv.size,
  image: argv.image,
  'private_networking': true,
  'ssh_keys': argv.k,
  'user_data': userdata
}, function(error, res) {
  if (error) {
    throw error;
  } else if (res.res.statusCode >= 400) {
    throw new Error(res.body.message);
  }

  var droplet = res.body.droplet;
  waitUntilStarted(droplet.id);
});

function waitUntilStarted(id) {
  function checkStatus() {
    api.droplets.fetch(id, gotStatus);
  }

  function gotStatus(error, res) {
    if (error) {
      throw error;
    } else if (res.res.statusCode >= 400) {
      throw new Error(res.body.message);
    }

    var droplet = res.body.droplet;

    if (droplet.status === 'active') {
      var networks = {};
      droplet.networks.v4.forEach(function(network) {
        networks[network.type] = network;
      });
      return process.stdout.write(JSON.stringify(networks, null, 2));
    }

    setTimeout(checkStatus, 5000);
  }

  setTimeout(checkStatus, 5000);
}
