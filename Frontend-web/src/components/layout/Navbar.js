import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { FaUser, FaSignOutAlt, FaCog, FaBars, FaTimes } from "react-icons/fa";
import "./Navbar.css";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleProfileClick = () => {
    setIsProfileDropdownOpen(!isProfileDropdownOpen);
    setIsMenuOpen(false);
  };

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
    setIsProfileDropdownOpen(false);
  };

  const handleNavLinkClick = () => {
    setIsMenuOpen(false);
    setIsProfileDropdownOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link
            to="/dashboard"
            className="brand-link"
            onClick={handleNavLinkClick}
          >
            <div className="brand-logo">
              <span className="logo-icon">🛡️</span>
              <span className="logo-text">GuardianCam</span>
            </div>
          </Link>
        </div>

        <div className={`navbar-menu ${isMenuOpen ? "active" : ""}`}>
          <div className="navbar-nav">
            <Link
              to="/dashboard"
              className="nav-link"
              onClick={handleNavLinkClick}
            >
              Dashboard
            </Link>
          </div>

          <div className="navbar-profile">
            <div className="profile-dropdown">
              <button
                className="profile-button"
                onClick={handleProfileClick}
                aria-expanded={isProfileDropdownOpen}
              >
                <div className="profile-avatar">
                  <FaUser />
                </div>
                <span className="profile-name">
                  {user?.firstName || "User"}
                </span>
                <span className="dropdown-arrow">▼</span>
              </button>

              {isProfileDropdownOpen && (
                <div className="profile-dropdown-menu">
                  <div className="dropdown-header">
                    <div className="user-info">
                      <div className="user-avatar">
                        <FaUser />
                      </div>
                      <div className="user-details">
                        <div className="user-name">
                          {user?.firstName} {user?.lastName}
                        </div>
                        <div className="user-email">{user?.email}</div>
                      </div>
                    </div>
                  </div>

                  <div className="dropdown-divider"></div>

                  <Link
                    to="/profile"
                    className="dropdown-item"
                    onClick={handleNavLinkClick}
                  >
                    <FaCog />
                    <span>Profile Settings</span>
                  </Link>

                  <button
                    className="dropdown-item logout-item"
                    onClick={handleLogout}
                  >
                    <FaSignOutAlt />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          className="navbar-toggle"
          onClick={handleMenuToggle}
          aria-label="Toggle navigation"
        >
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {isMenuOpen && (
        <div className="mobile-menu-overlay" onClick={handleMenuToggle}></div>
      )}
    </nav>
  );
};

export default Navbar;
