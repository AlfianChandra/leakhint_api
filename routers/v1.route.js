import express from "express";
import userController from "../controllers/user.controller.js";
import pipeController from "../controllers/pipe.controller.js";
import { loginLimiter } from "../middlewares/ratelimit.middleware.js";
import { verifyRequest } from "../middlewares/jwtverifier.middleware.js";
const router = express.Router();

//V1 - Users
router.post("/api/v1/user/login", loginLimiter, userController().login);
router.get(
  "/api/v1/user",
  loginLimiter,
  verifyRequest,
  userController().getUser
);

//V1 - Pipes
router.get(
  "/api/v1/pipe/trunkline",
  verifyRequest,
  pipeController().getTrunklines
);

router.post(
  "/api/v1/pipe/spots",
  verifyRequest,
  pipeController().getSpotsByTrunkline
);

router.get("/api/v1/pipe/spots/all", verifyRequest, pipeController().getSpots);

router.post(
  "/api/v1/pipe/spot/update",
  verifyRequest,
  pipeController().updateSpot
);

router.post(
  "/api/v1/pipe/trunkline/update",
  verifyRequest,
  pipeController().updateTrunkline
);

router.post(
  "/api/v1/pipe/trunkline/line/list",
  verifyRequest,
  pipeController().getLines
);

router.post(
  "/api/v1/pipe/trunkline/line/create",
  verifyRequest,
  pipeController().createLine
);

router.post(
  "/api/v1/pipe/trunkline/line/uploadnode",
  verifyRequest,
  pipeController().uploadLineNode
);


//Pipe monitoring
router.post(
  "/api/v1/pipe/monitoring/spot/get",
  verifyRequest,
  pipeController().monitoringGetSpotData
);

//Analysis - Playback
router.post(
  "/api/v1/pipe/analysis/playback/data",
  verifyRequest,
  pipeController().playbackGetData
);

//Analysis - Model
router.post(
  "/api/v1/pipe/analysis/model/upload",
  verifyRequest,
  pipeController().modelUpload
);

router.post(
  "/api/v1/pipe/analysis/model/list",
  verifyRequest,
  pipeController().getModels
);

router.post(
  "/api/v1/pipe/analysis/prediction/validate",
  verifyRequest,
  pipeController().validatePrediction
)

router.post(
  "/api/v1/pipe/analysis/prediction/execute",
  verifyRequest,
  pipeController().executePrediction
);

export default router;
