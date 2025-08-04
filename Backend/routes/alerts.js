const express = require("express");
const { body, validationResult } = require("express-validator");
const { getFirestore } = require("../config/firebase");

const router = express.Router();

// Get user's alerts
router.get("/", async (req, res) => {
  try {
    const userId = req.user.uid;
    const { status, type, limit = 50, page = 1 } = req.query;
    const db = getFirestore();

    let query = db.collection("alerts").where("userId", "==", userId);

    // Apply filters
    if (status) {
      query = query.where("status", "==", status);
    }
    if (type) {
      query = query.where("type", "==", type);
    }

    // Apply pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.orderBy("createdAt", "desc").limit(parseInt(limit));

    const snapshot = await query.get();

    const alerts = [];
    snapshot.forEach((doc) => {
      alerts.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    res.json({
      alerts,
      count: alerts.length,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error("Get alerts error:", error);
    res.status(500).json({
      error: "Failed to get alerts",
      message: "Internal server error",
    });
  }
});

// Get specific alert
router.get("/:alertId", async (req, res) => {
  try {
    const { alertId } = req.params;
    const userId = req.user.uid;
    const db = getFirestore();

    const alertDoc = await db.collection("alerts").doc(alertId).get();

    if (!alertDoc.exists) {
      return res.status(404).json({
        error: "Alert not found",
        message: "Alert record not found",
      });
    }

    const alertData = alertDoc.data();

    // Check if user owns this alert
    if (alertData.userId !== userId) {
      return res.status(403).json({
        error: "Access denied",
        message: "You can only view your own alerts",
      });
    }

    res.json({
      alert: {
        id: alertId,
        ...alertData,
      },
    });
  } catch (error) {
    console.error("Get alert error:", error);
    res.status(500).json({
      error: "Failed to get alert",
      message: "Internal server error",
    });
  }
});

// Update alert status
router.patch(
  "/:alertId",
  [
    body("status").isIn([
      "active",
      "acknowledged",
      "resolved",
      "false_positive",
    ]),
    body("notes").optional().isString(),
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

      const { alertId } = req.params;
      const { status, notes } = req.body;
      const userId = req.user.uid;
      const db = getFirestore();

      const alertRef = db.collection("alerts").doc(alertId);
      const alertDoc = await alertRef.get();

      if (!alertDoc.exists) {
        return res.status(404).json({
          error: "Alert not found",
          message: "Alert record not found",
        });
      }

      const alertData = alertDoc.data();

      // Check if user owns this alert
      if (alertData.userId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only update your own alerts",
        });
      }

      // Update alert
      const updateData = {
        status,
        updatedAt: new Date(),
      };

      if (notes) {
        updateData.notes = notes;
      }

      await alertRef.update(updateData);

      res.json({
        message: "Alert updated successfully",
        alertId,
      });
    } catch (error) {
      console.error("Update alert error:", error);
      res.status(500).json({
        error: "Failed to update alert",
        message: "Internal server error",
      });
    }
  }
);

// Create manual alert
router.post(
  "/manual",
  [
    body("type").isIn([
      "fall_detected",
      "medical_emergency",
      "security_breach",
      "other",
    ]),
    body("severity").isIn(["low", "medium", "high", "critical"]),
    body("message").notEmpty().trim(),
    body("location").optional().isString(),
    body("description").optional().isString(),
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

      const { type, severity, message, location, description } = req.body;
      const userId = req.user.uid;
      const db = getFirestore();

      const alertData = {
        userId,
        type,
        severity,
        message,
        location,
        description,
        source: "manual",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const alertRef = await db.collection("alerts").add(alertData);
      const alertId = alertRef.id;

      res.status(201).json({
        message: "Manual alert created successfully",
        alert: {
          id: alertId,
          ...alertData,
        },
      });
    } catch (error) {
      console.error("Create manual alert error:", error);
      res.status(500).json({
        error: "Failed to create alert",
        message: "Internal server error",
      });
    }
  }
);

// Get alert statistics
router.get("/stats/summary", async (req, res) => {
  try {
    const userId = req.user.uid;
    const { days = 30 } = req.query;
    const db = getFirestore();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get alerts in date range
    const alertsRef = db.collection("alerts");
    const snapshot = await alertsRef
      .where("userId", "==", userId)
      .where("createdAt", ">=", startDate)
      .get();

    const alerts = [];
    snapshot.forEach((doc) => {
      alerts.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Calculate statistics
    const stats = {
      total: alerts.length,
      byStatus: {},
      byType: {},
      bySeverity: {},
      recentAlerts: alerts.slice(0, 5), // Last 5 alerts
    };

    alerts.forEach((alert) => {
      // Count by status
      stats.byStatus[alert.status] = (stats.byStatus[alert.status] || 0) + 1;

      // Count by type
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;

      // Count by severity
      stats.bySeverity[alert.severity] =
        (stats.bySeverity[alert.severity] || 0) + 1;
    });

    res.json({
      stats,
      period: `${days} days`,
    });
  } catch (error) {
    console.error("Get alert stats error:", error);
    res.status(500).json({
      error: "Failed to get alert statistics",
      message: "Internal server error",
    });
  }
});

// Mark multiple alerts as resolved
router.post(
  "/bulk-resolve",
  [
    body("alertIds").isArray({ min: 1 }),
    body("status").isIn(["resolved", "false_positive"]),
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

      const { alertIds, status } = req.body;
      const userId = req.user.uid;
      const db = getFirestore();

      // Verify all alerts belong to user
      const alertsRef = db.collection("alerts");
      const snapshot = await alertsRef.where("userId", "==", userId).get();

      const userAlertIds = new Set();
      snapshot.forEach((doc) => {
        userAlertIds.add(doc.id);
      });

      const validAlertIds = alertIds.filter((id) => userAlertIds.has(id));

      if (validAlertIds.length === 0) {
        return res.status(400).json({
          error: "No valid alerts found",
          message: "No alerts found that belong to you",
        });
      }

      // Update all valid alerts
      const batch = db.batch();
      validAlertIds.forEach((alertId) => {
        const alertRef = alertsRef.doc(alertId);
        batch.update(alertRef, {
          status,
          updatedAt: new Date(),
        });
      });

      await batch.commit();

      res.json({
        message: `${validAlertIds.length} alerts updated successfully`,
        updatedCount: validAlertIds.length,
        status,
      });
    } catch (error) {
      console.error("Bulk resolve alerts error:", error);
      res.status(500).json({
        error: "Failed to update alerts",
        message: "Internal server error",
      });
    }
  }
);

// Get unread alerts count
router.get("/unread/count", async (req, res) => {
  try {
    const userId = req.user.uid;
    const db = getFirestore();

    const alertsRef = db.collection("alerts");
    const snapshot = await alertsRef
      .where("userId", "==", userId)
      .where("status", "==", "active")
      .get();

    const unreadCount = snapshot.size;

    res.json({
      unreadCount,
      hasUnread: unreadCount > 0,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      error: "Failed to get unread count",
      message: "Internal server error",
    });
  }
});

module.exports = router;
