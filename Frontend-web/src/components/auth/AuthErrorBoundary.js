import React, { Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaExclamationTriangle, FaSignInAlt, FaRedo } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import './AuthErrorBoundary.css';

class AuthErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      isAuthError: false 
    };
  }

  static getDerivedStateFromError(error) {
    // Check if this is an authentication error
    const isAuthError = error?.response?.status === 401 || 
                       error?.response?.status === 403 ||
                       error?.message?.includes('session') ||
                       error?.message?.includes('expired') ||
                       error?.message?.includes('unauthorized');
    
    return { 
      hasError: true, 
      error, 
      isAuthError 
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AuthErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  componentDidMount() {
    // Listen for authentication errors from the context
    if (this.props.authError) {
      this.setState({
        hasError: true,
        error: { message: this.props.authError },
        isAuthError: true
      });
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.authError !== this.props.authError && this.props.authError) {
      this.setState({
        hasError: true,
        error: { message: this.props.authError },
        isAuthError: true
      });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleSignIn = () => {
    this.props.forceLogout();
  };

  render() {
    if (this.state.hasError) {
      const isAuthError = this.state.isAuthError;
      
      return (
        <div className="auth-error-boundary">
          <div className="error-container">
            <div className="error-icon">
              <FaExclamationTriangle />
            </div>
            
            <h2 className="error-title">
              {isAuthError ? 'Authentication Error' : 'Something went wrong'}
            </h2>
            
            <p className="error-message">
              {isAuthError 
                ? 'Your session has expired or you are not authorized to access this resource.'
                : 'An unexpected error occurred. Please try again.'
              }
            </p>

            {this.state.error && (
              <details className="error-details">
                <summary>Error Details</summary>
                <pre>{this.state.error.message}</pre>
                {this.state.errorInfo && (
                  <pre>{this.state.errorInfo.componentStack}</pre>
                )}
              </details>
            )}

            <div className="error-actions">
              {isAuthError ? (
                <button 
                  className="btn btn-primary error-action-btn"
                  onClick={this.handleSignIn}
                >
                  <FaSignInAlt />
                  Sign In Again
                </button>
              ) : (
                <button 
                  className="btn btn-secondary error-action-btn"
                  onClick={this.handleRetry}
                >
                  <FaRedo />
                  Try Again
                </button>
              )}
            </div>

            <div className="error-help">
              <small>
                {isAuthError 
                  ? 'This usually happens when your login session expires. Please sign in again to continue.'
                  : 'If this problem persists, please contact support.'
                }
              </small>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component to provide auth context to the error boundary
const AuthErrorBoundaryWrapper = ({ children }) => {
  const { authError, forceLogout } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthErrorBoundary 
      authError={authError} 
      forceLogout={forceLogout}
      navigate={navigate}
    >
      {children}
    </AuthErrorBoundary>
  );
};

export default AuthErrorBoundaryWrapper;
