import mongoose from "mongoose";
export const mongoConnectionBuilder = () => {
  const connect = (connectionString) => {
    return new Promise((res, rej) => {
      try {
        mongoose
          .connect(connectionString)
          .then(() => {
            logger.info("MongoDB: Connected to the database successfully");
            res("db:connected");
          })
          .catch((err) => {
            throw new Error(err);
          });
      } catch (err) {
        logger.error("MongoDB: Error connecting to the database: " + err);
        rej(err);
      }
    });
  };

  return {
    connect,
  };
};

export default mongoConnectionBuilder;
