// middlewares/corsOptions.js
import cors from "cors";

const whitelist = [
  "http://localhost:5173", // dev vite
  "https://folapp.rndkito.com", // production domain
  "http://folapp.rndkito.com",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      // allow requests without origin (misal curl / postman)
      return callback(null, true);
    }
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // penting kalau lo kirim cookie / Authorization header
};

export default cors(corsOptions);
