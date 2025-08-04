const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const { getFirestore } = require("../config/firebase");

const router = express.Router();

// Get user profile
router.get("/profile", async (req, res) => {
  try {
    const userId = req.user.uid;
    const db = getFirestore();

    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User not found",
        message: "User profile not found",
      });
    }

    const userData = userDoc.data();
    delete userData.password; // Don't send password

    // Ensure firstName and lastName are present (for backward compatibility)
    if (!userData.firstName && userData.name) {
      const nameParts = userData.name.split(' ');
      userData.firstName = nameParts[0] || '';
      userData.lastName = nameParts.slice(1).join(' ') || '';
    }

    res.json({
      user: {
        id: userId,
        ...userData,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      error: "Failed to get profile",
      message: "Internal server error",
    });
  }
});

// Update user profile
router.put(
  "/profile",
  [
    body("firstName").optional().notEmpty().trim(),
    body("lastName").optional().notEmpty().trim(),
    body("phone").optional().isMobilePhone(),
    body("email").optional().isEmail().normalizeEmail(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { firstName, lastName, phone, email } = req.body;
      const userId = req.user.uid;
      const db = getFirestore();

      // Check if email is being changed and if it's already taken
      if (email) {
        const userRef = db.collection("users");
        const snapshot = await userRef
          .where("email", "==", email)
          .where("__name__", "!=", userId)
          .get();

        if (!snapshot.empty) {
          return res.status(400).json({
            error: "Email already exists",
            message: "A user with this email already exists",
          });
        }
      }

      const updateData = {
        updatedAt: new Date(),
      };

      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (phone) updateData.phone = phone;
      if (email) updateData.email = email;

      // Update the combined name field for backward compatibility
      if (firstName || lastName) {
        const userDoc = await db.collection("users").doc(userId).get();
        const currentData = userDoc.data();
        const newFirstName = firstName || currentData.firstName || '';
        const newLastName = lastName || currentData.lastName || '';
        updateData.name = `${newFirstName} ${newLastName}`.trim();
      }

      await db.collection("users").doc(userId).update(updateData);

      // Get updated user data
      const updatedDoc = await db.collection("users").doc(userId).get();
      const updatedUserData = updatedDoc.data();
      delete updatedUserData.password;

      res.json({
        message: "Profile updated successfully",
        user: {
          id: userId,
          ...updatedUserData,
        },
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({
        error: "Failed to update profile",
        message: "Internal server error",
      });
    }
  }
);

// Change password
router.put(
  "/change-password",
  [
    body("currentPassword").notEmpty(),
    body("newPassword").isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.user.uid;
      const db = getFirestore();

      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        return res.status(404).json({
          error: "User not found",
          message: "User profile not found",
        });
      }

      const userData = userDoc.data();

      // Verify current password
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        userData.password
      );
      if (!isValidPassword) {
        return res.status(400).json({
          error: "Invalid current password",
          message: "Current password is incorrect",
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await db.collection("users").doc(userId).update({
        password: hashedNewPassword,
        updatedAt: new Date(),
      });

      res.json({
        message: "Password changed successfully",
      });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({
        error: "Failed to change password",
        message: "Internal server error",
      });
    }
  }
);

// Get user preferences
router.get("/preferences", async (req, res) => {
  try {
    const userId = req.user.uid;
    const db = getFirestore();

    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User not found",
        message: "User profile not found",
      });
    }

    const userData = userDoc.data();
    const preferences = userData.preferences || {
      notifications: true,
      fallDetectionEnabled: false,
      alertRadius: 1000,
    };

    res.json({
      preferences,
    });
  } catch (error) {
    console.error("Get preferences error:", error);
    res.status(500).json({
      error: "Failed to get preferences",
      message: "Internal server error",
    });
  }
});

// Update user preferences
router.put(
  "/preferences",
  [
    body("notifications").optional().isBoolean(),
    body("fallDetectionEnabled").optional().isBoolean(),
    body("alertRadius").optional().isInt({ min: 100, max: 10000 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { notifications, fallDetectionEnabled, alertRadius } = req.body;
      const userId = req.user.uid;
      const db = getFirestore();

      const updateData = {
        updatedAt: new Date(),
      };

      // Update preferences
      if (notifications !== undefined) {
        updateData["preferences.notifications"] = notifications;
      }
      if (fallDetectionEnabled !== undefined) {
        updateData["preferences.fallDetectionEnabled"] = fallDetectionEnabled;
      }
      if (alertRadius !== undefined) {
        updateData["preferences.alertRadius"] = alertRadius;
      }

      await db.collection("users").doc(userId).update(updateData);

      res.json({
        message: "Preferences updated successfully",
      });
    } catch (error) {
      console.error("Update preferences error:", error);
      res.status(500).json({
        error: "Failed to update preferences",
        message: "Internal server error",
      });
    }
  }
);

// Get user statistics
router.get("/stats", async (req, res) => {
  try {
    const userId = req.user.uid;
    const { days = 30 } = req.query;
    const db = getFirestore();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get user's alerts
    const alertsRef = db.collection("alerts");
    const alertsSnapshot = await alertsRef
      .where("userId", "==", userId)
      .where("createdAt", ">=", startDate)
      .get();

    // Get user's analyses
    const analysesRef = db.collection("fall_analyses");
    const analysesSnapshot = await analysesRef
      .where("userId", "==", userId)
      .where("createdAt", ">=", startDate)
      .get();

    // Get monitoring sessions
    const sessionsRef = db.collection("monitoring_sessions");
    const sessionsSnapshot = await sessionsRef
      .where("userId", "==", userId)
      .where("createdAt", ">=", startDate)
      .get();

    const stats = {
      alerts: alertsSnapshot.size,
      analyses: analysesSnapshot.size,
      monitoringSessions: sessionsSnapshot.size,
      period: `${days} days`,
    };

    res.json({
      stats,
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({
      error: "Failed to get user statistics",
      message: "Internal server error",
    });
  }
});

// Delete user account
router.delete("/account", [body("password").notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      });
    }

    const { password } = req.body;
    const userId = req.user.uid;
    const db = getFirestore();

    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User not found",
        message: "User profile not found",
      });
    }

    const userData = userDoc.data();

    // Verify password
    const isValidPassword = await bcrypt.compare(password, userData.password);
    if (!isValidPassword) {
      return res.status(400).json({
        error: "Invalid password",
        message: "Password is incorrect",
      });
    }

    // Delete user data (in production, you might want to anonymize instead)
    const batch = db.batch();

    // Delete user's alerts
    const alertsSnapshot = await db
      .collection("alerts")
      .where("userId", "==", userId)
      .get();
    alertsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete user's analyses
    const analysesSnapshot = await db
      .collection("fall_analyses")
      .where("userId", "==", userId)
      .get();
    analysesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete user's monitoring sessions
    const sessionsSnapshot = await db
      .collection("monitoring_sessions")
      .where("userId", "==", userId)
      .get();
    sessionsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete user account
    batch.delete(db.collection("users").doc(userId));

    await batch.commit();

    res.json({
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      error: "Failed to delete account",
      message: "Internal server error",
    });
  }
});

module.exports = router;
