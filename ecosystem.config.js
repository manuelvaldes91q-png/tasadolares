module.exports = {
  apps : [{
    name   : "tasadolares",
    script : "./dist/server.cjs",
    env: {
      NODE_ENV: "production",
      PORT: 5050
    }
  }]
}
