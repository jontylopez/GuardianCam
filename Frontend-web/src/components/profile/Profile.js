import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Navbar from "../layout/Navbar";
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaSave,
  FaEdit,
  FaTimes,
} from "react-icons/fa";
import "./Profile.css";

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || user?.name?.split(' ')[0] || "",
    lastName: user?.lastName || user?.name?.split(' ').slice(1).join(' ') || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [errors, setErrors] = useState({});

  // Debug logging
  console.log("Profile component - user data:", user);
  console.log("Profile component - formData:", formData);

  // Update formData when user data changes
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || user.name?.split(' ')[0] || "",
        lastName: user.lastName || user.name?.split(' ').slice(1).join(' ') || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.phone) {
      newErrors.phone = "Phone number is required";
    } else {
      // Remove spaces, dashes, and parentheses
      const cleanPhone = formData.phone.replace(/[\s\-()]/g, "");
      // Check for Sri Lankan format: 0773351031 or +94773351031
      const sriLankanPhoneRegex = /^(?:\+94|0)?7\d{8}$/;
      if (!sriLankanPhoneRegex.test(cleanPhone)) {
        newErrors.phone =
          "Please enter a valid Sri Lankan phone number (e.g., 0773351031 or +94773351031)";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const success = await updateProfile(formData);
      if (success) {
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Profile update error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phone: user?.phone || "",
    });
    setErrors({});
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  return (
    <div className="profile-page">
      <Navbar />

      <div className="profile-container">
        <div className="profile-header">
          <h1>Profile Settings</h1>
          <p>Manage your account information and preferences</p>
        </div>

        <div className="profile-content">
          <div className="profile-card">
            <div className="card-header">
              <h2>Personal Information</h2>
              {!isEditing && (
                <button className="btn btn-secondary" onClick={handleEdit}>
                  <FaEdit />
                  Edit Profile
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="profile-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName" className="form-label">
                    <FaUser className="form-icon" />
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={`form-input ${errors.firstName ? "error" : ""}`}
                    disabled={!isEditing}
                  />
                  {errors.firstName && (
                    <span className="error-message">{errors.firstName}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="lastName" className="form-label">
                    <FaUser className="form-icon" />
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={`form-input ${errors.lastName ? "error" : ""}`}
                    disabled={!isEditing}
                  />
                  {errors.lastName && (
                    <span className="error-message">{errors.lastName}</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  <FaEnvelope className="form-icon" />
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`form-input ${errors.email ? "error" : ""}`}
                  disabled={!isEditing}
                />
                {errors.email && (
                  <span className="error-message">{errors.email}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="phone" className="form-label">
                  <FaPhone className="form-icon" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`form-input ${errors.phone ? "error" : ""}`}
                  disabled={!isEditing}
                />
                {errors.phone && (
                  <span className="error-message">{errors.phone}</span>
                )}
              </div>

              {isEditing && (
                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    <FaSave />
                    {loading ? "Saving..." : "Save Changes"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    <FaTimes />
                    Cancel
                  </button>
                </div>
              )}
            </form>
          </div>

          <div className="profile-card">
            <div className="card-header">
              <h2>Account Information</h2>
            </div>

            <div className="account-info">
              <div className="info-item">
                <strong>Account ID:</strong>
                <span>{user?.id || "N/A"}</span>
              </div>
              <div className="info-item">
                <strong>Member Since:</strong>
                <span>
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
              <div className="info-item">
                <strong>Last Updated:</strong>
                <span>
                  {user?.updatedAt
                    ? new Date(user.updatedAt).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
