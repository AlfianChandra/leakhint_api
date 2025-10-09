import dotenv from "dotenv";
dotenv.config({ silent: true });
import express from "express";
import path from "path";
import { globalLimiter } from "./middlewares/ratelimit.middleware.js";
import corsOption from "./utils/corsOption.js";
import mongoConnectionBuilder from "./storage/mongodb.storage.js";
import v1route from "./routers/v1.route.js";

//MongoDB Connection
mongoConnectionBuilder().connect(process.env.MONGO_URL);

//App configuration
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(corsOption);
app.use(globalLimiter);

//V1 Endpoint
app.use(v1route);

//Statics
app.use(
  "usercontent",
  express.static(path.join(process.cwd(), "public/usercontent"))
);

export default app;
