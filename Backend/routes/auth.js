const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { getFirestore, getAuth } = require("../config/firebase");

const router = express.Router();

// Register new user
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("name").notEmpty().trim(),
    body("phone").optional().isMobilePhone(),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { email, password, name, phone, role = "user" } = req.body;
      const db = getFirestore();

      // Check if user already exists
      const userRef = db.collection("users");
      const snapshot = await userRef.where("email", "==", email).get();

      if (!snapshot.empty) {
        return res.status(400).json({
          error: "User already exists",
          message: "A user with this email already exists",
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user document
      const userData = {
        email,
        password: hashedPassword,
        name,
        phone,
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        preferences: {
          notifications: true,
          fallDetectionEnabled: true,
          alertRadius: 1000, // meters
        },
      };

      const docRef = await userRef.add(userData);
      const userId = docRef.id;

      // Generate JWT token
      const token = jwt.sign(
        {
          uid: userId,
          email,
          role,
          name,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );

      // Remove password from response
      delete userData.password;

      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: userId,
          ...userData,
        },
        token,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        error: "Registration failed",
        message: "Internal server error",
      });
    }
  }
);

// Login user
router.post(
  "/login",
  [body("email").isEmail().normalizeEmail(), body("password").notEmpty()],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { email, password } = req.body;
      const db = getFirestore();

      // Find user by email
      const userRef = db.collection("users");
      const snapshot = await userRef.where("email", "==", email).get();

      if (snapshot.empty) {
        return res.status(401).json({
          error: "Invalid credentials",
          message: "Email or password is incorrect",
        });
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      // Check if user is active
      if (!userData.isActive) {
        return res.status(401).json({
          error: "Account disabled",
          message: "Your account has been disabled",
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, userData.password);
      if (!isValidPassword) {
        return res.status(401).json({
          error: "Invalid credentials",
          message: "Email or password is incorrect",
        });
      }

      // Update last login
      await userDoc.ref.update({
        lastLogin: new Date(),
        updatedAt: new Date(),
      });

      // Generate JWT token
      const token = jwt.sign(
        {
          uid: userDoc.id,
          email: userData.email,
          role: userData.role,
          name: userData.name,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );

      // Remove password from response
      delete userData.password;

      res.json({
        message: "Login successful",
        user: {
          id: userDoc.id,
          ...userData,
        },
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        error: "Login failed",
        message: "Internal server error",
      });
    }
  }
);

// Get current user profile
router.get("/profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        error: "No token provided",
        message: "Authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getFirestore();

    const userDoc = await db.collection("users").doc(decoded.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User not found",
        message: "User profile not found",
      });
    }

    const userData = userDoc.data();
    delete userData.password;

    res.json({
      user: {
        id: userDoc.id,
        ...userData,
      },
    });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({
      error: "Failed to get profile",
      message: "Internal server error",
    });
  }
});

// Refresh token
router.post("/refresh", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: "Token required",
        message: "Please provide a token to refresh",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Generate new token
    const newToken = jwt.sign(
      {
        uid: decoded.uid,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
    );

    res.json({
      message: "Token refreshed successfully",
      token: newToken,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(401).json({
      error: "Invalid token",
      message: "Token refresh failed",
    });
  }
});

module.exports = router;
