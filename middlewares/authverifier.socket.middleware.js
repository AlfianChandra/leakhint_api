import dotenv from "dotenv";
dotenv.config({
  silent: true,
});
import jwt from "jsonwebtoken";
export const useSocketAuth = (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Unauthorized"));
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        console.error("Token expired:", err);
        return next(new Error("Token expired"));
      } else if (err.name === "JsonWebTokenError") {
        console.error("Invalid token:", err);
        return next(new Error("Invalid token"));
      }
      console.error("JWT verification error:", err);
      return next(new Error("Unauthorized"));
    }

    socket.user = user;
    next();
  });
};
