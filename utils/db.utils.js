import mongoose from "mongoose";
import event from "./eventBus.js";
export const connectionBuilder = () => {
  const connect = (connectionString) => {
    return new Promise((res, rej) => {
      try {
        mongoose
          .connect(connectionString)
          .then(() => {
            logger.info("[DB] Connected to the database successfully");
            res("db:connected");
          })
          .catch((err) => {
            throw new Error(err);
          });
      } catch (err) {
        logger.error("[DB] Error connecting to the database: " + err);
        rej(err);
      }
    });
  };

  return {
    connect,
  };
};

export default connectionBuilder;
