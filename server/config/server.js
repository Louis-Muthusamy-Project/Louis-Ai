const express = require("express");
const http = require("http");
const cors = require("cors");

function createApp() {
  const app = express();

  app.disable("x-powered-by");

  app.use(
    cors({
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    })
  );

  app.use(
    express.json({
      limit: "5mb",
    })
  );

  app.use(
    express.urlencoded({
      extended: true,
    })
  );

  app.get("/api/health", (req, res) => {
    res.status(200).json({
      success: true,
      service: "Yuna AI Server",
      version: "1.0.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/", (req, res) => {
    res.json({
      message: "Yuna AI Backend Running",
    });
  });

  const server = http.createServer(app);

  return {
    app,
    server,
  };
}

module.exports = {
  createApp,
};