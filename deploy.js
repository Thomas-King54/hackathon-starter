const cmd = require('node-cmd');
const fs = require('fs');
const path = require('path');
const node_ssh = require('node-ssh');
ssh = new node_ssh.NodeSSH();

function main() {
  console.log('Deployment started.');
  sshConnect();
}

function removeProjectApp() {
  return ssh.execCommand('rm -rf hackathon-starter', {
    cwd: '/home/ubuntu'
  });
}

function createRemoteTempFolder() {
  return ssh.execCommand(
    'mkdir hackathon-starter-temp', {
      cwd: '/home/ubuntu'
    }
  );
}

function transferProjectToRemote(failed, successful) {
  return ssh.putDirectory(
    '../hackathon-starter',
    '/home/ubuntu/hackathon-starter-temp',
    {
      recursive: true,
      concurrency: 1,
      validate: function(itemPath) {
        const baseName = path.basename(itemPath);
        return ( baseName !== 'node_modules');
      },
      tick: function (localPath, remotePath, error) {
        if(error) {
          failed.push(localPath);
          console.log('failed.push: ' + localPath);
        } else {
          successful.push(localPath);
          console.log('successful.push: ' + localPath);
        }
      }
    }
  );
}

function stopRemoteServices() {
  return ssh.execCommand('pm2 stop all && sudo service mongod stop', {
    cwd: '/home/ubuntu'
  });
}

function updateRemoteApp() {
  return ssh.execCommand(
    'mkdir hackathon-starter && cp -r hackathon-starter-temp/. hackathon-starter/ && rm -rf hackathon-starter-temp',
    {
      cwd: '/home/ubuntu'
    }
  );
}

function installNodeModules() {
  return ssh.execCommand('npm install', {
    cwd: '/home/ubuntu/hackathon-starter'
  });
}

function restartRemoteServices() {
  return ssh.execCommand(
    'sudo service mongod start && pm2 start app.js',
    {
      cwd: '/home/ubuntu/hackathon-starter'
    }
  );
}

function sshConnect() {
  console.log('Connecting to the server...');
  ssh.connect({
    host: '3.92.176.210',
    username: 'ubuntu',
    privateKeyPath: 'labsuser.pem'
  }).then(() => {
    console.log('Removing  `hackathon-starter` folder.');
    return removeProjectApp();
  }).then(result => {
    console.log("STDOUT: " + result.stdout);
    console.log("STDERR: " + result.stderr);
    console.log('Creating `hackathon-starter-temp` folder');
    return createRemoteTempFolder();
  }).then(function(result) {
    console.log("STDOUT: " + result.stdout);
    console.log("STDERR: " + result.stderr);
    const failed = [];
    const successful = [];
    if(result.stdout) {
      console.log('Standard Output: ' + result.stdout);
    }
    if(result.stderr) {
      console.log('Standard Error: ' + result.stderr);
      return Promise.reject(result.stderr);
    }
    console.log('Transferring files to remote server...');
    return transferProjectToRemote(failed, successful);
  }).then(status => {
    if(status) {
      console.log('Stopping remote services.');
      return stopRemoteServices();
    } else {
      return Promise.reject(failed.join(', '));
    }
  }).then(status => {
    if(status) {
      console.log('Updating remote app.');
      return updateRemoteApp();
    } else {
      return Promise.reject(failed.join(', '));
    }
  }).then(result => {
    console.log("STDOUT: " + result.stdout);
    console.log("STDERR: " + result.stderr);
    console.log('Installing node modules.');
    return installNodeModules();
  }).then(result => {
    console.log("STDOUT: " + result.stdout);
    console.log("STDERR: " + result.stderr);
    console.log('Restarting remote services...');
    return restartRemoteServices();
  }).then(result => {
    console.log("STDOUT: " + result.stdout);
    console.log("STDERR: " + result.stderr);
    console.log('DEPLOYMENT COMPLETED!');
    process.exit(0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

main();