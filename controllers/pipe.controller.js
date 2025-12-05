import pool from "../storage/mysql.storage.js";
import dayjs from "dayjs";
import { spawn } from "child_process";
import fs from "fs";
const pipeController = () => {
  const getTrunklines = async (req, res) => {
    try {
      const field_id = req.user.field_id;
      const q = "SELECT * FROM trunkline WHERE field_id = ?";
      const [rows] = await pool.execute(q, [field_id]);
      return res.status(200).json({ success: true, trunkline: rows });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  const getLines = async (req, res) => {
    try {
      const { tline_id } = req.body;
      const q =
        "SELECT * FROM trunkline_line WHERE tline_id = ? ORDER BY id ASC";
      const [rows] = await pool.execute(q, [tline_id]);

      for (const r of rows) {
        const lineId = r.line_id;
        const qNodes =
          "SELECT latitude, longitude FROM trunkline_linenodes WHERE line_id = ? ORDER BY id ASC";
        const [nodes] = await pool.execute(qNodes, [lineId]);
        r.nodes = nodes;
      }
      return res.status(200).json({ success: true, lines: rows });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };

  const createLine = async (req, res) => {
    try {
      const { tline_id, name } = req.body;
      const q =
        "INSERT INTO trunkline_line (name, tline_id, line_id, active) VALUES (?, ?, ?, ?)";
      const randomLineId = Math.random().toString(36).substring(2, 10);
      await pool.execute(q, [name, tline_id, randomLineId, 1]);
      return res
        .status(200)
        .json({ success: true, message: "Line created successfully" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };

  const getSpotsByTrunkline = async (req, res) => {
    try {
      const { tline_id } = req.body;
      const q = "SELECT * FROM spot WHERE tline_id = ? ORDER BY sort ASC";
      const [rows] = await pool.execute(q, [tline_id]);
      return res.status(200).json({ success: true, spots: rows });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  const updateSpot = async (req, res) => {
    try {
      const { spot_id, ...rest } = req.body;

      const keys = Object.keys(rest);
      const values = Object.values(rest);

      const setClause = keys.map((key) => `${key} = ?`).join(", ");

      const q = `UPDATE spot SET ${setClause} WHERE spot_id = ?`;

      const [result] = await pool.execute(q, [...values, spot_id]);

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Spot not found" });
      }

      return res
        .status(200)
        .json({ success: true, message: "Spot updated successfully" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };

  const updateTrunkline = async (req, res) => {
    try {
      const { tline_id, ...rest } = req.body;

      const keys = Object.keys(rest);
      const values = Object.values(rest);
      const setClause = keys.map((key) => `${key} = ?`).join(", ");
      const q = `UPDATE trunkline SET ${setClause} WHERE tline_id = ?`;
      const [result] = await pool.execute(q, [...values, tline_id]);
      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Trunkline not found" });
      }
      return res
        .status(200)
        .json({ success: true, message: "Trunkline updated successfully" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };

  const monitoringGetSpotData = async (req, res) => {
    try {
      const { spot_id, date_filter } = req.body;
      const startDate = date_filter;
      const endDate = dayjs(startDate)
        .endOf("day")
        .format("YYYY-MM-DD HH:mm:ss");

      if (!spot_id || !date_filter) {
        return res.status(400).json({
          success: false,
          message: "spot_id and date_filter are required",
        });
      }

      const table = req.user.data_table;
      const q = `SELECT * FROM ${table} WHERE spot_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp ASC`;
      const [rows] = await pool.execute(q, [spot_id, startDate, endDate]);
      let timestamps = [];
      let pressures = [];
      for (const r of rows) {
        timestamps.push(dayjs(r.timestamp).format("YYYY-MM-DD HH:mm:ss"));
        pressures.push(r.psi);
      }
      return res
        .status(200)
        .json({ success: true, chartData: { timestamps, pressures } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };

  const getSpots = async (req, res) => {
    try {
      const q = "SELECT * FROM spot ORDER BY sort ASC";
      const [rows] = await pool.execute(q);
      return res.status(200).json({ success: true, spots: rows });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };

  const playbackGetData = async (req, res) => {
    try {
      const { dates, timeRange, spots } = req.body;
      if (!dates || !Array.isArray(dates) || dates.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Dates harus berupa array dan tidak boleh kosong",
        });
      }

      if (!timeRange || timeRange <= 0) {
        return res.status(400).json({
          success: false,
          message: "timeRange harus lebih dari 0",
        });
      }

      if (!spots || !Array.isArray(spots) || spots.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Spots harus berupa array dan tidak boleh kosong",
        });
      }

      const results = [];
      const table = req.user.data_table;

      // Buat placeholders untuk IN clause
      const spotPlaceholders = spots.map(() => "?").join(",");

      for (const date of dates) {
        const dateOnly = date.split(" ")[0];

        const query = `
        SELECT 
          spot_id AS idSpot,
          AVG(psi) AS avgPsiValues,
          time_bucket
        FROM (
          SELECT 
            spot_id,
            psi,
            FLOOR((HOUR(timestamp) * 60 + MINUTE(timestamp)) / ?) AS time_bucket
          FROM 
            ${pool.escapeId(table)}
          WHERE 
            DATE(timestamp) = ?
            AND spot_id IN (${spotPlaceholders})
        ) AS bucketed_data
        GROUP BY 
          spot_id,
          time_bucket
        ORDER BY 
          time_bucket,
          spot_id
      `;

        const queryParams = [timeRange, dateOnly, ...spots];

        const [rows] = await pool.execute(query, queryParams);

        // Group by time_bucket dulu, baru per spot
        const timeGroups = {};

        rows.forEach((row) => {
          const bucket = row.time_bucket;

          // Hitung start dan end time dari bucket
          const startMinutes = bucket * timeRange;
          const endMinutes = startMinutes + timeRange;

          const startHour = String(Math.floor(startMinutes / 60)).padStart(
            2,
            "0"
          );
          const startMin = String(startMinutes % 60).padStart(2, "0");
          const endHour = String(Math.floor(endMinutes / 60)).padStart(2, "0");
          const endMin = String(endMinutes % 60).padStart(2, "0");

          const timeRangeStr = `${startHour}:${startMin} - ${endHour}:${endMin}`;

          if (!timeGroups[bucket]) {
            timeGroups[bucket] = {
              timeRange: timeRangeStr,
              dateFilter: dateOnly,
              data: {},
            };
          }

          timeGroups[bucket].data[row.idSpot] = parseFloat(row.avgPsiValues);
        });

        // Convert ke array dan push ke results, pastiin semua spot ada
        Object.keys(timeGroups)
          .sort((a, b) => Number(a) - Number(b))
          .forEach((bucket) => {
            const dataArray = spots.map((spot) => ({
              idSpot: spot,
              avgPsiValues: timeGroups[bucket].data[spot] || 0,
            }));

            results.push({
              timeRange: timeGroups[bucket].timeRange + " | " + dateOnly,
              dateFilter: dateOnly,
              data: dataArray,
            });
          });
      }

      let categories = results.map((r) => r.timeRange);
      let series = spots.map((spot) => {
        return {
          idSpot: spot,
          data: results.map((r) => {
            const spotData = r.data.find((d) => d.idSpot === spot);
            return spotData ? spotData.avgPsiValues : 0;
          }),
        };
      });

      return res.status(200).json({
        success: true,
        data: results,
        chartData: { categories, series },
      });
    } catch (err) {
      console.error("Error:", err);
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

  const modelUpload = async (req, res) => {
    try {
      const { model_name, tline, model, parameters, infix, training_feature } =
        req.body;
      const modelBuffer = Buffer.from(model.model_data, "base64");
      const modelExt = model.model_ext;
      const modelOutput = model.model_output;
      const modelFilename = `${model_name.replace(
        /\s+/g,
        "_"
      )}_${Date.now()}${modelExt}`;
      const modelPath = `./models/${modelFilename}`;
      fs.writeFileSync(modelPath, modelBuffer);
      //Number and char random id
      const randomId = () => {
        const chars =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let result = "";
        for (let i = 0; i < 8; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };
      const q =
        "INSERT INTO models (id_model, id_tline, model_name, parameters, model_filename, output, infix, training_feature) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
      await pool.execute(q, [
        randomId(),
        tline,
        model_name,
        parameters,
        modelFilename,
        modelOutput,
        infix,
        training_feature || null,
      ]);

      return res
        .status(200)
        .json({ success: true, message: "Model uploaded successfully" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };

  const getModels = async (req, res) => {
    try {
      const { tline_id } = req.body;
      const q = "SELECT * FROM models WHERE id_tline = ?";
      const [rows] = await pool.execute(q, [tline_id]);
      return res.status(200).json({ success: true, models: rows });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };

  const uploadLineNode = async (req, res) => {
    try {
      const { nodes, line_id } = req.body;

      // Hapus nodes lama
      const deleteQ = "DELETE FROM trunkline_linenodes WHERE line_id = ?";
      await pool.execute(deleteQ, [line_id]);

      for (const n of nodes) {
        const lat = n[1];
        const lng = n[0];
        const q =
          "INSERT INTO trunkline_linenodes (line_id, latitude, longitude) VALUES (?, ?, ?)";
        await pool.execute(q, [line_id, lat, lng]);
      }

      return res
        .status(200)
        .json({ success: true, message: "Nodes uploaded!" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };

  const validatePrediction = async (req, res) => {
    try {
      const { id_tline, model, delta } = req.body;
      //Get model info from db
      const q = "SELECT * FROM models WHERE id_model = ? AND id_tline = ?";
      const [rows] = await pool.execute(q, [model, id_tline]);
      const mModel = rows[0];
      const modelParameters = mModel.parameters;
      const deltaLength = delta.length;
      // if (deltaLength != modelParameters) {
      //   return res.status(400).json({
      //     success: false,
      //     message: `Delta length (${deltaLength}) does not match model parameters (${modelParameters})`,
      //   });
      // }
      const token = generateToken();
      const iduser = req.user.id;
      //Generate token with format xxxxy-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const insertQuery =
        "INSERT INTO prediction_result (id_tline, id_model, token, id_user) VALUES (?, ?, ?, ?)";
      await pool.execute(insertQuery, [id_tline, model, token, iduser]);
      return res.status(200).json({
        success: true,
        message: "Prediction request submitted",
        token: token,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };

  const executePrediction = async (req, res) => {
    try {
      const { token, delta, tline_length } = req.body;
      //Cek token valid
      const q = "SELECT * FROM prediction_result WHERE token = ?";
      const [rows] = await pool.execute(q, [token]);
      if (rows.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid token" });
      }

      const data = rows[0];
      const idModel = data.id_model;
      //get model
      const qModel = "SELECT * FROM models WHERE id_model = ?";
      const [modelRows] = await pool.execute(qModel, [idModel]);
      if (modelRows.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Model not found for this token" });
      }

      const model = modelRows[0];
      const modelFilename = model.model_filename;
      const modelParameters = model.parameters;
      const modelOutput = model.output;
      const trainingFeature = model.training_feature;
      const infix = model.infix;
      let inputData = {};
      let n = 1;
      for (const i of delta) {
        const paramInfix = infix.replace("{x}", n);
        inputData[paramInfix] = i;
        n++;
      }
      console.log(inputData);
      const result = await runModel(
        modelParameters,
        modelFilename,
        inputData,
        tline_length,
        model.infix,
        modelOutput,
        trainingFeature || ""
      );
      const resultParsed = JSON.parse(result.trim());
      const leakSpot = resultParsed.result.lokasi;
      const leakStatus = resultParsed.result.status === "kebocoran" ? 1 : 0;

      const leakspotFloat = leakSpot
        ? parseFloat(leakSpot.split(" ")[1])
        : null;
      console.log(resultParsed);
      const updateDate = dayjs().format("YYYY-MM-DD HH:mm:ss");
      const updateQ =
        "UPDATE prediction_result SET timestamp = ? WHERE token = ?";
      await pool.execute(updateQ, [updateDate, token]);

      return res.status(200).json({
        success: true,
        message: "Prediction executed",
        result: resultParsed.result,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };

  const runModel = (
    parameters,
    path,
    inputData,
    tlineLength,
    infix,
    output,
    trainingFeature
  ) => {
    return new Promise((resolve, reject) => {
      const model = spawn("python3", [
        "models/prediction.py",
        parameters,
        path,
        tlineLength,
        infix,
        output,
        trainingFeature,
      ]);
      let stdout = "";
      let stderr = "";

      model.stdout.on("data", (data) => {
        const text = data.toString();
        stdout += text;
        // const result = JSON.parse(text.trim());
      });

      model.stderr.on("data", (data) => {
        const text = data.toString();
        stderr += text;
        console.error(`Model stderr: ${text.trim()}`);
      });

      model.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(
            new Error(`Model process exited with code ${code}: ${stderr}`)
          );
        }
      });

      // Kirim input JSON ke Python stdin
      model.stdin.write(JSON.stringify(inputData));
      model.stdin.end();
    });
  };

  const generateToken = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        token += "-";
      } else if (i === 14) {
        token += "4";
      } else if (i === 19) {
        const randomChar = chars.charAt(Math.floor(Math.random() * 16));
        const yChar = (parseInt(randomChar, 16) & 0x3) | 0x8;
        token += yChar.toString(16);
      } else {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return token;
  };

  //Proxy functions can be added here if needed
  const jmrProxy = (req, res) => {
    const inputData = req.body;
    console.log("Received JMR proxy request with data:", inputData);
    const modelPath = "models/jmr_proxy_model.sav";

    try {
      // Validate input
      if (
        !inputData.sensor_locations ||
        !inputData.normal_pressure ||
        !inputData.drop_pressure
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Missing required input fields: sensor_locations, normal_pressure, drop_pressure",
        });
      }

      if (
        inputData.sensor_locations.length !==
          inputData.normal_pressure.length ||
        inputData.sensor_locations.length !== inputData.drop_pressure.length
      ) {
        return res.status(400).json({
          success: false,
          error: "All sensor data arrays must have the same length",
        });
      }

      // Spawn Python process
      const model = spawn("python3", ["models/jmr_proxy_model.py", modelPath]);

      let stdout = "";
      let stderr = "";

      // Collect stdout data
      model.stdout.on("data", (data) => {
        const text = data.toString();
        stdout += text;
      });

      // Collect stderr data
      model.stderr.on("data", (data) => {
        const text = data.toString();
        stderr += text;
        console.error(`Model stderr: ${text.trim()}`);
      });

      // Handle process close
      model.on("close", (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);

            if (result.success) {
              return res.status(200).json({
                success: true,
                result,
              });
            } else {
              return res.status(500).json({
                success: false,
                error: result.error || "Model execution failed",
              });
            }
          } catch (e) {
            return res.status(500).json({
              success: false,
              error: `Failed to parse model output: ${e.message}`,
              raw_output: stdout,
            });
          }
        } else {
          return res.status(500).json({
            success: false,
            error: `Model process exited with code ${code}`,
            stderr: stderr,
          });
        }
      });

      // Handle process error
      model.on("error", (err) => {
        return res.status(500).json({
          success: false,
          error: `Failed to start model process: ${err.message}`,
        });
      });

      // Send input JSON to Python stdin
      model.stdin.write(JSON.stringify(inputData));
      model.stdin.end();
    } catch (err) {
      console.error("Unexpected error:", err);
      return res.status(500).json({
        success: false,
        error: `Unexpected error: ${err.message}`,
      });
    }
  };

  return {
    getTrunklines,
    getSpotsByTrunkline,
    updateSpot,
    monitoringGetSpotData,
    getSpots,
    playbackGetData,
    modelUpload,
    getModels,
    updateTrunkline,
    getLines,
    createLine,
    uploadLineNode,
    validatePrediction,
    executePrediction,
    jmrProxy,
  };
};
export default pipeController;
