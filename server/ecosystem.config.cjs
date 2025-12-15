module.exports = {
  apps: [
    {
      name: 'express-template',
      script: 'dist/index.js',
      instances: process.env.WORKER_COUNT || 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      listen_timeout: 10000,
      kill_timeout: 10000,
      max_restarts: 10,
      time: true,
    },
  ],
};
