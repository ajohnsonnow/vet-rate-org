/**
 * Integration Example for VA.gov OAuth 2.0
 * 
 * This file shows how to integrate the VA authentication into your existing App.jsx
 */

// ============================================================================
// STEP 1: Wrap your App with VaAuthProvider in main.jsx
// ============================================================================

// main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { VaAuthProvider } from './contexts/VaAuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <VaAuthProvider>
      <App />
    </VaAuthProvider>
  </React.StrictMode>
);

// ============================================================================
// STEP 2: Add the callback route to your Router
// ============================================================================

// App.jsx or wherever you define routes
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import VaAuthCallback from './components/VaAuthCallback';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Your existing routes */}
        <Route path="/" element={<HomePage />} />
        
        {/* Add the VA callback route */}
        <Route path="/callback" element={<VaAuthCallback />} />
        
        {/* More existing routes */}
      </Routes>
    </BrowserRouter>
  );
}

// ============================================================================
// STEP 3: Add login button to your header/navbar
// ============================================================================

// Header.jsx or Navigation.jsx
import VaLoginButton from './components/VaLoginButton';

function Header() {
  return (
    <header className="flex justify-between items-center p-4">
      <div>Your Logo</div>
      
      {/* Add the VA login button */}
      <VaLoginButton />
    </header>
  );
}

// ============================================================================
// STEP 4: Protect routes that require authentication
// ============================================================================

// Create a ProtectedRoute component
import { Navigate } from 'react-router-dom';
import { useVaAuth } from './hooks/useVaAuth';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useVaAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-va-blue"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Use it in your routes
<Route 
  path="/my-va-claims" 
  element={
    <ProtectedRoute>
      <VaClaimsPage />
    </ProtectedRoute>
  } 
/>

// ============================================================================
// STEP 5: Fetch VA data in your components
// ============================================================================

// VaClaimsPage.jsx (example)
import { useState, useEffect } from 'react';
import { useVaAuth } from './hooks/useVaAuth';

function VaClaimsPage() {
  const { fetchVaApi, isAuthenticated } = useVaAuth();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadClaims() {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Replace with actual VA endpoint
        const data = await fetchVaApi(
          'https://sandbox-api.va.gov/services/claims/v1/claims'
        );
        setClaims(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadClaims();
  }, [isAuthenticated, fetchVaApi]);

  if (loading) {
    return <div>Loading claims...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1>My VA Claims</h1>
      {claims.map(claim => (
        <div key={claim.id}>
          <h2>{claim.type}</h2>
          <p>Status: {claim.status}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// STEP 6: Display user info anywhere in your app
// ============================================================================

// UserProfile.jsx (example)
import { useVaAuth } from './hooks/useVaAuth';

function UserProfile() {
  const { userInfo, isAuthenticated } = useVaAuth();

  if (!isAuthenticated) {
    return <p>Please sign in to view your profile</p>;
  }

  return (
    <div className="user-profile">
      <h2>Welcome, {userInfo?.name || 'Veteran'}!</h2>
      {userInfo?.email && <p>Email: {userInfo.email}</p>}
      {userInfo?.given_name && <p>First Name: {userInfo.given_name}</p>}
      {userInfo?.family_name && <p>Last Name: {userInfo.family_name}</p>}
    </div>
  );
}

// ============================================================================
// STEP 7: Conditionally show features based on auth status
// ============================================================================

// AnyComponent.jsx
import { useVaAuth } from './hooks/useVaAuth';

function FeatureComponent() {
  const { isAuthenticated } = useVaAuth();

  return (
    <div>
      {/* Always visible content */}
      <h1>Disability Calculator</h1>
      
      {/* Only show to authenticated users */}
      {isAuthenticated && (
        <div className="premium-features">
          <h2>Your VA Data</h2>
          <p>View your personalized claims information</p>
        </div>
      )}
      
      {/* Only show to non-authenticated users */}
      {!isAuthenticated && (
        <div className="cta">
          <p>Sign in with VA.gov to access personalized features</p>
          <VaLoginButton />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPLETE EXAMPLE: Minimal App.jsx with VA Auth
// ============================================================================

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useVaAuth } from './hooks/useVaAuth';
import VaAuthCallback from './components/VaAuthCallback';
import VaLoginButton from './components/VaLoginButton';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        {/* Header with login button */}
        <header className="app-header">
          <h1>SupplyLocker.org</h1>
          <VaLoginButton />
        </header>

        {/* Routes */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/callback" element={<VaAuthCallback />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function HomePage() {
  const { isAuthenticated, userInfo } = useVaAuth();

  return (
    <div className="home">
      <h1>Welcome to SupplyLocker.org</h1>
      
      {isAuthenticated ? (
        <div>
          <p>Hello, {userInfo?.name}! 🎖️</p>
          <p>You're connected to VA.gov</p>
        </div>
      ) : (
        <div>
          <p>Sign in with VA.gov to access your claims data</p>
        </div>
      )}
    </div>
  );
}

export default App;
