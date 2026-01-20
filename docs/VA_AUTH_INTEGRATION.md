# VA.gov OAuth 2.0 Integration Guide

## Overview

This integration implements secure OAuth 2.0 authentication with PKCE (Proof Key for Code Exchange) for VA.gov API access. It's designed for **client-side only** applications with no backend server.

## 🔐 Security Features

- ✅ **PKCE Flow** - No client secret required or exposed
- ✅ **Native Web Crypto API** - Secure random generation and SHA-256 hashing
- ✅ **State Parameter** - CSRF protection
- ✅ **Session Storage** - Tokens stored per-session only (cleared on browser close)
- ✅ **Token Expiration Handling** - Automatic refresh when needed
- ✅ **Secure Token Revocation** - Proper cleanup on logout

## 📋 Prerequisites

1. **VA.gov API Access**: Register your application at https://developer.va.gov/
2. **Authorization Code Grant**: Request "Authorization Code Grant" access (not implicit grant)
3. **Redirect URI**: Configure your callback URL in VA developer portal
4. **Environment Variables**: Set up your `.env` file

## 🚀 Setup Instructions

### Step 1: Environment Configuration

Create a `.env` file in your project root:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` with your actual values:

```env
VITE_VA_CLIENT_ID=your_actual_client_id_from_va_developer_portal
VITE_VA_REDIRECT_URL=http://localhost:5173/callback
VITE_VA_API_ENV=sandbox
```

**For production**, change:
```env
VITE_VA_REDIRECT_URL=https://vet-rate.org/callback
VITE_VA_API_ENV=production
```

### Step 2: Wrap Your App with VaAuthProvider

In your `main.jsx` or `App.jsx`:

```jsx
import { VaAuthProvider } from './contexts/VaAuthContext';

function App() {
  return (
    <VaAuthProvider>
      {/* Your app components */}
    </VaAuthProvider>
  );
}
```

### Step 3: Add the Callback Route

In your React Router configuration:

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import VaAuthCallback from './components/VaAuthCallback';

function App() {
  return (
    <VaAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<YourHomePage />} />
          <Route path="/callback" element={<VaAuthCallback />} />
          {/* Other routes */}
        </Routes>
      </BrowserRouter>
    </VaAuthProvider>
  );
}
```

### Step 4: Add Login Button

Use the `VaLoginButton` component or create your own:

```jsx
import VaLoginButton from './components/VaLoginButton';

function Header() {
  return (
    <header>
      <VaLoginButton />
    </header>
  );
}
```

## 📖 Usage Examples

### Basic Authentication Check

```jsx
import { useVaAuth } from './hooks/useVaAuth';

function MyComponent() {
  const { isAuthenticated, userInfo } = useVaAuth();

  if (!isAuthenticated) {
    return <p>Please sign in to view your VA data</p>;
  }

  return <p>Welcome, {userInfo?.name}!</p>;
}
```

### Making API Requests

```jsx
import { useVaAuth } from './hooks/useVaAuth';

function ClaimsViewer() {
  const { fetchVaApi, isAuthenticated } = useVaAuth();
  const [claims, setClaims] = useState([]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchVaApi('https://sandbox-api.va.gov/services/claims/v1/claims')
        .then(data => setClaims(data))
        .catch(err => console.error('Failed to fetch claims:', err));
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

### Custom Login Flow

```jsx
import { useVaAuth } from './hooks/useVaAuth';

function CustomLoginButton() {
  const { login, logout, isAuthenticated, isLoading } = useVaAuth();

  return (
    <button 
      onClick={isAuthenticated ? logout : login}
      disabled={isLoading}
    >
      {isLoading ? 'Loading...' : (isAuthenticated ? 'Sign Out' : 'Sign In with VA.gov')}
    </button>
  );
}
```

### Protected Route Component

```jsx
import { Navigate } from 'react-router-dom';
import { useVaAuth } from './hooks/useVaAuth';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useVaAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Usage:
<Route path="/va-claims" element={
  <ProtectedRoute>
    <VaClaimsPage />
  </ProtectedRoute>
} />
```

## 🔑 Available OAuth Scopes

The integration requests these scopes by default:

- `openid` - OpenID Connect authentication
- `profile` - Basic profile information
- `offline_access` - Refresh token for long-term access
- `claim.read` - Read VA disability claims
- `service_history.read` - Read military service history

To modify scopes, edit `src/config/vaAuth.js`.

## 🛠 API Reference

### useVaAuth Hook

```typescript
const {
  // State
  isAuthenticated: boolean,
  isLoading: boolean,
  error: string | null,
  accessToken: string | null,
  userInfo: object | null,
  
  // Methods
  login: () => Promise<void>,
  logout: () => Promise<void>,
  handleCallback: (code: string, state: string) => Promise<{success: boolean, error?: string}>,
  refreshAccessToken: (refreshToken: string) => Promise<{success: boolean}>,
  fetchVaApi: (endpoint: string, options?: object) => Promise<any>
} = useVaAuth();
```

### VaAuthContext

```typescript
const {
  // State
  isAuthenticated: boolean,
  accessToken: string | null,
  refreshToken: string | null,
  tokenExpiry: number | null,
  userInfo: object | null,
  isLoading: boolean,
  error: string | null,
  
  // Methods
  setAuth: (tokens: object, user?: object) => void,
  clearAuth: () => void,
  isTokenExpired: () => boolean,
  setError: (message: string) => void
} = useVaAuthContext();
```

## 🧪 Testing

### Test with VA Sandbox

1. Set `VITE_VA_API_ENV=sandbox` in your `.env`
2. Use VA's test accounts from their developer portal
3. Test the full OAuth flow locally

### Test PKCE Generation

```javascript
import { generatePKCEPair, validateCodeVerifier } from './utils/pkce';

const { verifier, challenge } = await generatePKCEPair();
console.log('Verifier:', verifier);
console.log('Challenge:', challenge);
console.log('Valid:', validateCodeVerifier(verifier));
```

## 🐛 Troubleshooting

### "Invalid VA.gov OAuth configuration"
- Check that `VITE_VA_CLIENT_ID` and `VITE_VA_REDIRECT_URL` are set in `.env`
- Ensure environment variables start with `VITE_` prefix
- Restart dev server after changing `.env`

### "State mismatch - possible CSRF attack"
- This can happen if you reload during the OAuth flow
- Clear sessionStorage and try again
- Ensure cookies are enabled

### "Code verifier not found"
- Session expired between login and callback
- Don't close the browser tab during OAuth flow
- Check if sessionStorage is being cleared by extensions

### Tokens not persisting
- Check browser's sessionStorage (not localStorage)
- Ensure third-party cookies are not blocking sessionStorage
- Verify no browser extensions are clearing storage

## 🔄 Token Refresh Flow

The integration automatically handles token refresh:

1. Before each API request, checks if token is expired
2. If expired, uses refresh token to get new access token
3. If refresh fails, clears auth and requires re-login

## 🔒 Security Best Practices

✅ **DO:**
- Store tokens in sessionStorage (cleared on browser close)
- Use HTTPS in production
- Validate state parameter on callback
- Check token expiration before API calls
- Revoke tokens on logout

❌ **DON'T:**
- Store tokens in localStorage (persists indefinitely)
- Commit `.env` to version control
- Share access tokens between tabs (use same session)
- Use implicit grant flow (use authorization code with PKCE)

## 📚 Additional Resources

- [VA.gov Developer Portal](https://developer.va.gov/)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [VA API Documentation](https://developer.va.gov/explore)

## 🆘 Support

For VA.gov API issues:
- Email: api@va.gov
- Developer Portal: https://developer.va.gov/support

For integration issues:
- Check the browser console for detailed error messages
- Review the callback URL configuration in VA developer portal
- Verify environment variables are correctly set

---

**Built for Vet-Rate.org** 🎖️
