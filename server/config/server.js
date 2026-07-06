const express = require("express");
const http = require("http");
const cors = require("cors");
const settingsRoutes = require("../routes/settingsRoutes");

function createApp() {

  const app = express();

  /**
   * Security
   */

  app.disable("x-powered-by");

  /**
   * CORS
   */

  app.use(

    cors({

      origin: process.env.CLIENT_URL || "https://louis-yuna.onrender.com",

      methods: ["GET", "POST"],

      credentials: true

    })

  );

  app.use(

    "/api/settings",

    settingsRoutes

  );

  /**
   * Body Parser
   */

  app.use(

    express.json({

      limit: "5mb"

    })

  );

  app.use(

    express.urlencoded({

      extended: true,

      limit: "5mb"

    })

  );

  /**
   * Basic Request Logger
   */

  app.use((req, res, next) => {

    console.log(

      `${new Date().toISOString()} | ${req.method} ${req.originalUrl}`

    );

    next();

  });

  /**
   * Health Check
   */

  app.get("/api/health", (req, res) => {

    res.status(200).json({

      success: true,

      service: "Yuna AI Server",

      version: "1.0.0",

      uptime: process.uptime(),

      environment: process.env.NODE_ENV || "development",

      timestamp: new Date().toISOString()

    });

  });

  /**
   * Root
   */

  app.get("/", (req, res) => {

    res.json({

      success: true,

      message: "Yuna AI Backend Running"

    });

  });

  /**
   * 404 Handler
   */

  app.use((req, res) => {

    res.status(404).json({

      success: false,

      error: "Route not found",

      path: req.originalUrl

    });

  });

  /**
   * Global Error Handler
   */

  app.use((err, req, res, next) => {

    console.error(err);

    res.status(err.status || 500).json({

      success: false,

      message: err.message || "Internal Server Error"

    });

  });

  /**
   * HTTP Server
   */

  const server = http.createServer(app);

  return {

    app,

    server

  };

}

module.exports = {

  createApp

};