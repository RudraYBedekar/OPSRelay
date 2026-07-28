module.exports = {
  apps: [
    {
      name: 'opsrelay-api',
      script: 'npx',
      args: 'tsx server/index.ts',
      cwd: __dirname + '/..',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/home/ubuntu/.pm2/logs/opsrelay-api-error.log',
      out_file: '/home/ubuntu/.pm2/logs/opsrelay-api-out.log',
      time: true,
    },
  ],
};
