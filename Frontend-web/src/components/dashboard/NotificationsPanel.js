import React from "react";
import {
  FaBell,
  FaExclamationTriangle,
  FaUser,
  FaUserClock,
  FaTimes,
  FaCheck,
} from "react-icons/fa";
import "./NotificationsPanel.css";

const NotificationsPanel = ({
  notifications,
  onNotificationRead,
  onNotificationDelete,
}) => {
  const getNotificationIcon = (type) => {
    switch (type) {
      case "fall-detected":
        return <FaExclamationTriangle className="notification-icon fall" />;
      case "human-detected":
        return <FaUser className="notification-icon human" />;
      case "human-not-moving":
        return <FaUserClock className="notification-icon warning" />;
      default:
        return <FaBell className="notification-icon default" />;
    }
  };

  const getNotificationClass = (type, read) => {
    let baseClass = "notification-item";
    if (!read) baseClass += " unread";

    switch (type) {
      case "fall-detected":
        return `${baseClass} fall-alert`;
      case "human-detected":
        return `${baseClass} human-alert`;
      case "human-not-moving":
        return `${baseClass} warning-alert`;
      default:
        return baseClass;
    }
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleRead = (notificationId) => {
    onNotificationRead(notificationId);
  };

  const handleDelete = (notificationId) => {
    onNotificationDelete(notificationId);
  };

  if (notifications.length === 0) {
    return (
      <div className="notifications-panel">
        <div className="empty-notifications">
          <FaBell className="empty-icon" />
          <h3>No Notifications</h3>
          <p>You're all caught up! No new alerts to display.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-panel">
      <div className="notifications-list">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={getNotificationClass(
              notification.type,
              notification.read
            )}
          >
            <div className="notification-content">
              <div className="notification-icon-wrapper">
                {getNotificationIcon(notification.type)}
              </div>

              <div className="notification-details">
                <div className="notification-message">
                  {notification.message}
                </div>
                <div className="notification-time">
                  {formatTimestamp(notification.timestamp)}
                </div>
              </div>
            </div>

            <div className="notification-actions">
              {!notification.read && (
                <button
                  className="action-btn read-btn"
                  onClick={() => handleRead(notification.id)}
                  title="Mark as read"
                >
                  <FaCheck />
                </button>
              )}

              <button
                className="action-btn delete-btn"
                onClick={() => handleDelete(notification.id)}
                title="Delete notification"
              >
                <FaTimes />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="notifications-footer">
        <button className="btn btn-secondary btn-sm">Mark All as Read</button>
        <button className="btn btn-secondary btn-sm">Clear All</button>
      </div>
    </div>
  );
};

export default NotificationsPanel;
