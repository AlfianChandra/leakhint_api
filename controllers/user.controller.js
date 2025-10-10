import pool from "../storage/mysql.storage.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
const userController = () => {
  const login = async (req, res) => {
    try {
      const { email, password, field } = req.body;
      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Username and password are required" });
      }

      // Example query - adjust according to your database schema
      const query = "SELECT * FROM user WHERE email = ? OR user_id = ?";
      const [user] = await pool.query(query, [email, email]);
      if (user[0] == undefined) {
        return res.status(401).json({
          message:
            "Invalid credentials, user not found: " + email + " | " + user,
        });
      }

      const validUser = user[0];
      const userPassword = validUser.password;
      //verify bcrypt password
      const verifyPassword = await bcrypt.compare(password, userPassword);
      if (!verifyPassword) {
        return res
          .status(401)
          .json({ message: "Invalid credentials, password mismatch" });
      }

      let targetField = "";
      if (validUser.role === "admin") {
        if (field === validUser.field_id) {
          targetField = validUser.field_id;
        } else {
          return res
            .status(401)
            .json({ message: "Invalid credentials, field mismatch" });
        }
      } else if (validUser.role === "superadmin") {
        targetField = field;
      }

      let dataTable = "";
      if (targetField === "jbi") {
        dataTable = "pressure_jbi";
      } else if (targetField === "rtu") {
        dataTable = "pressure_rtu";
      }

      // Generate JWT token
      const tokenPayload = {
        id: validUser.id,
        email: validUser.email,
        name: validUser.username,
        role: "admin",
        field_id: targetField,
        data_table: dataTable,
      };
      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRATION || "7d",
        issuer: process.env.JWT_ISSUER || "yourapp",
        audience: process.env.JWT_AUDIENCE || "yourappusers",
      });

      validUser.token = token;
      validUser.field_id = targetField;
      delete validUser.password; // Remove password from response
      res.status(200).json({ message: "Login successful", user: validUser });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };

  const getUser = async (req, res) => {
    try {
      const userId = req.user.id;
      const q = "SELECT * FROM user WHERE id = ?";
      const [user] = await pool.query(q, [userId]);
      if (user[0] == undefined) {
        return res.status(404).json({ message: "User not found" });
      }

      const validUser = user[0];
      delete validUser.password;
      res.status(200).json({ user: validUser });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };

  return {
    login,
    getUser,
  };
};

export default userController;
