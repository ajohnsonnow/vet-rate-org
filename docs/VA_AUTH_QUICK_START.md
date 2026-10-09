# VA.gov OAuth Integration - Quick Start Guide

## 🚀 Quick Setup (No React Router Required!)

Your app currently doesn't use React Router, so I've created a simpler integration that works with your existing single-page setup.

### Step 1: Add Environment Variables

Add to your `.env` file (create it if it doesn't exist):

```env
VITE_VA_AUTH_ID=your_client_id_from_va_developer_portal
VITE_VA_REDIRECT_URL=http://localhost:5173
VITE_VA_API_ENV=sandbox
```

**Important:** The redirect URL should point to your home page, NOT a `/callback` route.

### Step 2: Wrap Your App with VaAuthProvider

Update your [main.jsx](src/main.jsx):

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { VaAuthProvider } from './contexts/VaAuthContext';
import './index.css';

// Add console.error filter (if not already present)
const originalError = console.error;
console.error = (...args) => {
  const errorMessage = args[0]?.toString() || '';
  if (
    errorMessage.includes('message channel closed') ||
    errorMessage.includes('Extension context invalidated') ||
    errorMessage.includes('asynchronous response')
  ) {
    return;
  }
  originalError.apply(console, args);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <VaAuthProvider>
      <App />
    </VaAuthProvider>
  </React.StrictMode>
);
```

### Step 3: Handle OAuth Callback in App.jsx

At the **top** of your [App.jsx](src/App.jsx) component, add this check:

```jsx
import VaAuthCallbackNoRouter from './components/VaAuthCallbackNoRouter';

function App() {
  // Check if we're handling an OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const isOAuthCallback = urlParams.has('code') && urlParams.has('state');

  // If OAuth callback, show the callback handler
  if (isOAuthCallback) {
    return <VaAuthCallbackNoRouter />;
  }

  // Rest of your existing App code...
  const [searchTerm, setSearchTerm] = useState('');
  // ... etc
}
```

### Step 4: Add Login Button to Your Header

Update your [Header.jsx](src/components/Header.jsx) to include the VA login button.

Option A - Import the pre-built component:

```jsx
import VaLoginButton from './VaLoginButton';

// In your header JSX:
<VaLoginButton />
```

Option B - Use the hook directly for custom UI:

```jsx
import { useVaAuth } from '../hooks/useVaAuth';

function Header() {
  const { isAuthenticated, login, logout, userInfo } = useVaAuth();

  return (
    <header>
      {/* Your existing header content */}
      
      {isAuthenticated ? (
        <div className="flex items-center gap-2">
          <span>Welcome, {userInfo?.name || 'Veteran'}!</span>
          <button onClick={logout}>Sign Out</button>
        </div>
      ) : (
        <button onClick={login}>Sign In with VA.gov</button>
      )}
    </header>
  );
}
```

## 📝 That's It!

You're now ready to use VA authentication. The integration is fully functional without React Router.

### Basic Usage Examples

#### Check if user is authenticated:

```jsx
import { useVaAuth } from './hooks/useVaAuth';

function MyComponent() {
  const { isAuthenticated, userInfo } = useVaAuth();

  if (!isAuthenticated) {
    return <p>Sign in to access this feature</p>;
  }

  return <p>Welcome, {userInfo?.name}!</p>;
}
```

#### Fetch data from VA.gov API:

```jsx
import { useVaAuth } from './hooks/useVaAuth';
import { useState, useEffect } from 'react';

function VaClaimsViewer() {
  const { fetchVaApi, isAuthenticated } = useVaAuth();
  const [claims, setClaims] = useState([]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchVaApi('https://sandbox-api.va.gov/services/claims/v1/claims')
        .then(data => setClaims(data))
        .catch(err => console.error('Error fetching claims:', err));
    }
  }, [isAuthenticated, fetchVaApi]);

  return (
    <div>
      {claims.map(claim => (
        <div key={claim.id}>{claim.status}</div>
      ))}
    </div>
  );
}
```

## 🔧 Available Endpoints

Once authenticated, you can access these VA.gov endpoints:

- **Claims**: `https://sandbox-api.va.gov/services/claims/v1/claims`
- **Service History**: `https://sandbox-api.va.gov/services/veteran_verification/v1/service_history`
- **User Info**: `https://sandbox-api.va.gov/oauth2/userinfo`

For production, replace `sandbox-api.va.gov` with `api.va.gov`.

## 🧪 Testing

1. Start your dev server: `npm run dev`
2. Click "Sign In with VA.gov"
3. You'll be redirected to VA's authorization page
4. After authorizing, you'll be redirected back to your app
5. The callback handler will exchange the code for a token
6. You'll see "Sign In Successful!" and be redirected to your home page
7. Your app will now show you as authenticated

## 🔐 Security Notes

- ✅ Tokens stored in `sessionStorage` (cleared when browser closes)
- ✅ PKCE flow (no client secret needed)
- ✅ State parameter for CSRF protection
- ✅ Automatic token refresh
- ✅ Proper token revocation on logout

## 📚 Full Documentation

For advanced usage, see [VA_AUTH_INTEGRATION.md](docs/VA_AUTH_INTEGRATION.md)

## ⚠️ Production Checklist

Before deploying to production:

- [ ] Update `VITE_VA_REDIRECT_URL` to your production domain
- [ ] Change `VITE_VA_API_ENV` to `production`
- [ ] Register your production redirect URI at <https://developer.va.gov/>
- [ ] Test the full OAuth flow on production
- [ ] Ensure HTTPS is enabled

## 🆘 Troubleshooting

**"Invalid configuration" error?**

- Make sure your `.env` file has `VITE_VA_AUTH_ID` and `VITE_VA_REDIRECT_URL`
- Restart your dev server after creating/editing `.env`

**Redirect not working?**

- Check that `VITE_VA_REDIRECT_URL` matches your current URL (including port)
- Verify this URL is registered in VA developer portal

**"State mismatch" error?**

- Don't reload the page during OAuth flow
- Clear sessionStorage and try again

**Tokens not persisting?**

- This is expected! Tokens are stored in `sessionStorage` and cleared when you close the browser
- For persistent login, the app will use the refresh token automatically

---

**Need Help?**

- VA API Support: <api@va.gov>
- Developer Portal: <https://developer.va.gov/support>
