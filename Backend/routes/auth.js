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
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email address"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
    body("firstName")
      .notEmpty()
      .trim()
      .withMessage("First name is required"),
    body("lastName")
      .notEmpty()
      .trim()
      .withMessage("Last name is required"),
    body("phone")
      .optional()
      .isMobilePhone()
      .withMessage("Please provide a valid phone number"),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg);
        return res.status(400).json({
          error: "Validation failed",
          message: errorMessages.join(", "),
          details: errors.array(),
        });
      }

      const { email, password, firstName, lastName, phone, role = "user" } = req.body;
      const db = getFirestore();

      // Check if user already exists
      const userRef = db.collection("users");
      const snapshot = await userRef.where("email", "==", email).get();

      if (!snapshot.empty) {
        return res.status(409).json({
          error: "Account already exists",
          message: "An account with this email address already exists. Please try logging in instead.",
          code: "USER_ALREADY_EXISTS"
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user document
      const userData = {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`, // Keep for backward compatibility
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
      // Only include optional fields if provided
      if (phone !== undefined && phone !== null && phone !== "") {
        userData.phone = phone;
      }

      const docRef = await userRef.add(userData);
      const userId = docRef.id;

      // Generate JWT token
      const token = jwt.sign(
        {
          uid: userId,
          email,
          role,
          firstName,
          lastName,
          name: `${firstName} ${lastName}`,
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
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email address"),
    body("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg);
        return res.status(400).json({
          error: "Validation failed",
          message: errorMessages.join(", "),
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
          error: "Authentication failed",
          message: "No account found with this email address. Please check your email or create a new account.",
          code: "USER_NOT_FOUND"
        });
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      // Check if user is active
      if (!userData.isActive) {
        return res.status(401).json({
          error: "Account suspended",
          message: "Your account has been suspended. Please contact support for assistance.",
          code: "ACCOUNT_SUSPENDED"
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, userData.password);
      if (!isValidPassword) {
        return res.status(401).json({
          error: "Authentication failed",
          message: "Incorrect password. Please check your password and try again.",
          code: "INVALID_PASSWORD"
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
          firstName: userData.firstName || userData.name?.split(' ')[0] || '',
          lastName: userData.lastName || userData.name?.split(' ').slice(1).join(' ') || '',
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

    // Ensure firstName and lastName are present (for backward compatibility)
    if (!userData.firstName && userData.name) {
      const nameParts = userData.name.split(' ');
      userData.firstName = nameParts[0] || '';
      userData.lastName = nameParts.slice(1).join(' ') || '';
    }

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
