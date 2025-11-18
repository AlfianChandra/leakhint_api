import dotenv from "dotenv";
dotenv.config({ silent: true });
import jwt from "jsonwebtoken";
const routerExclusion = ["/socket.io"];
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:6625",
  "https://jamer.findingoillosses.com",
  "https://jamer.findingoillosses.com/",
  "PostmanRuntime",
  "https://meethint.rndkito.com/",
  "https://meethint.rndkito.com",
];

export const verifyRequest = (req, res, next) => {
  const clientIP =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  // const route = req.originalUrl;
  // //Skip JWT verification for excluded routes
  // if (routerExclusion.some((path) => route.startsWith(path))) {
  //   logger.info(`[REQVERIFY - ${clientIP}] Skipping auth procedure`);
  //   return next();
  // }

  // const userOrigin =
  //   req.headers["origin"] ||
  //   req.headers["referer"] ||
  //   req.headers["user-agent"];

  // if (!allowedOrigins.some((origin) => userOrigin?.includes(origin))) {
  //   logger.warn(
  //     `[REQVERIFY - ${clientIP}] Forbidden - Blocked user origin: ${userOrigin}`
  //   );
  //   return res
  //     .status(403)
  //     .json({ message: "forbidden", err_code: "ORIGIN_FORBIDDEN" });
  // }

  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    logger.warn(`[REQVERIFY - ${clientIP}] Unauthorized - No token provided`);
    return res
      .status(401)
      .json({ message: "unauthorized", err_code: "TOKEN_NOT_PROVIDED" });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        if (err.name === "TokenExpiredError") {
          logger.warn(`[REQVERIFY - ${clientIP}] Unauthorized - Token expired`);
          return res
            .status(401)
            .json({ message: "unauthorized", err_code: "TOKEN_EXPIRED" });
        } else if (err.name === "JsonWebTokenError") {
          logger.warn(`[REQVERIFY - ${clientIP}] Unauthorized - Invalid token`);
          return res
            .status(401)
            .json({ message: "unauthorized", err_code: "TOKEN_INVALID" });
        }
      }

      req.user = decoded;
      return next();
    });
  } catch (error) {
    logger.error(`[REQVERIFY - ${clientIP}] Unauthorized - Invalid token`);
    return res
      .status(401)
      .json({ message: "unauthorized", err_code: "TOKEN_INVALID" });
  }
};

export default verifyRequest;
