import dotenv from "dotenv";
dotenv.config({ silent: true });
import app from "./app.js";
import http from "http";
import OpenAI from "openai";
import { Server } from "socket.io";
import registry from "./utils/serviceregistry.utils.js";
import loadListeners from "./listeners/index.js";
import emitter from "./utils/eventBus.js";
import logger from "./utils/logger.utils.js";

//Server data
const serverPort = process.env.SERVER_PORT || 3000;

//Register logger
global.logger = logger;

//Init OpenAI Lib
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function bootstrap() {
  console.clear();
  logger.info("Bootstrap: Starting services...");
  const server = http.createServer(app);
  const io = new Server(server, {
    maxHttpBufferSize: 1e8,
    pingTimeout: 60000,
    cors: {
      origin: ["https://folapp.rndkito.com", "http://localhost:5173"],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  //Register instances
  registry.register("openai", openai);
  registry.register("socket.io", io);
  registry.register("http.server", server);

  //Register socket namespaces
  registry.register("wsns:chat", io.of("/chat"));
  logger.info("Bootstrap: Loading listeners...");
  await loadListeners();
  logger.info("Bootstrap: All services ready.");
  return { server, io };
}

function setupGracefulShutdown({ server, io }) {
  const shutdown = async (signal) => {
    try {
      logger.warn(`Shutdown: Received ${signal}, closing services...`);
      if (io && io.close) {
        await new Promise((res) => io.close(res));
        logger.info("Shutdown: socket.io closed.");
      }
      if (server && server.close) {
        await new Promise((res) => server.close(res));
        logger.info("Shutdown: HTTP server closed.");
      }

      emitter.emit("server:stopped");
      process.exit(0);
    } catch (err) {
      logger.error(`Shutdown: Error: ${err.message}`);
      process.exit(1);
    }
  };

  ["SIGINT", "SIGTERM"].forEach((sig) => process.on(sig, () => shutdown(sig)));
}

const { server, io } = await (async () => {
  const { server, io } = await bootstrap();
  server.listen(serverPort, () => {
    logger.info(`Bootstrap: Server listening on port ${serverPort}`);
  });

  setupGracefulShutdown({ server, io });
  return { server, io };
})();
