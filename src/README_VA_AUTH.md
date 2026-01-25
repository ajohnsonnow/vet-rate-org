# VA.gov OAuth 2.0 Integration

## 📁 File Structure

```
src/
├── config/
│   └── vaAuth.js                     # OAuth configuration & endpoints
├── utils/
│   └── pkce.js                       # PKCE utilities (code verifier/challenge)
├── contexts/
│   └── VaAuthContext.jsx             # Authentication state management
├── hooks/
│   └── useVaAuth.js                  # Main authentication hook
├── components/
│   ├── VaAuthCallback.jsx            # OAuth callback handler (with React Router)
│   ├── VaAuthCallbackNoRouter.jsx    # OAuth callback handler (no router)
│   └── VaLoginButton.jsx             # Pre-built login/logout button
├── examples/
│   └── VaAuthIntegrationExample.jsx  # Complete integration examples
└── docs/
    ├── VA_AUTH_QUICK_START.md        # Quick setup guide
    └── VA_AUTH_INTEGRATION.md        # Comprehensive documentation
```

## 🎯 What's Included

### Core Files

1. **[vaAuth.js](src/config/vaAuth.js)** - Configuration
   - Environment detection (sandbox vs production)
   - OAuth endpoints
   - Scopes configuration
   - Storage key constants
   - Configuration validation

2. **[pkce.js](src/utils/pkce.js)** - PKCE Implementation
   - `generateCodeVerifier()` - Creates secure random verifier
   - `generateCodeChallenge()` - SHA-256 hash of verifier
   - `generateState()` - CSRF protection token
   - `generatePKCEPair()` - Generates both at once
   - Uses native Web Crypto API (no dependencies!)

3. **[VaAuthContext.jsx](src/contexts/VaAuthContext.jsx)** - State Management
   - `VaAuthProvider` - Context provider component
   - `useVaAuthContext()` - Context hook
   - Token storage & retrieval
   - Authentication state
   - Token expiration checking

4. **[useVaAuth.js](src/hooks/useVaAuth.js)** - Main Hook
   - `login()` - Initiates OAuth flow
   - `logout()` - Revokes token and clears state
   - `handleCallback()` - Processes OAuth redirect
   - `refreshAccessToken()` - Refreshes expired tokens
   - `fetchVaApi()` - Makes authenticated API requests

### UI Components

5. **[VaAuthCallback.jsx](src/components/VaAuthCallback.jsx)**
   - Requires React Router
   - Shows loading/success/error states
   - Automatic redirect after success

6. **[VaAuthCallbackNoRouter.jsx](src/components/VaAuthCallbackNoRouter.jsx)**
   - No React Router required
   - Same functionality as above
   - Works with single-page apps

7. **[VaLoginButton.jsx](src/components/VaLoginButton.jsx)**
   - Pre-styled login/logout button
   - Shows user info when authenticated
   - Handles loading and error states
   - Fully customizable

### Documentation & Examples

8. **[VA_AUTH_QUICK_START.md](docs/VA_AUTH_QUICK_START.md)**
   - 5-minute setup guide
   - No React Router required
   - Step-by-step instructions
   - Common use cases

9. **[VA_AUTH_INTEGRATION.md](docs/VA_AUTH_INTEGRATION.md)**
   - Comprehensive documentation
   - Security best practices
   - API reference
   - Troubleshooting guide

10. **[VaAuthIntegrationExample.jsx](src/examples/VaAuthIntegrationExample.jsx)**
    - Complete code examples
    - Protected routes
    - API requests
    - Conditional rendering

## 🚀 Quick Start

### 1. Install Dependencies (if needed)

No additional dependencies required! Uses native browser APIs.

If you want React Router (optional):
```bash
npm install react-router-dom
```

### 2. Configure Environment

Add to `.env`:
```env
VITE_VA_CLIENT_ID=your_va_client_id
VITE_VA_REDIRECT_URL=http://localhost:5173
VITE_VA_API_ENV=sandbox
```

### 3. Wrap Your App

```jsx
// main.jsx
import { VaAuthProvider } from './contexts/VaAuthContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <VaAuthProvider>
      <App />
    </VaAuthProvider>
  </React.StrictMode>
);
```

### 4. Add Login Button

```jsx
import VaLoginButton from './components/VaLoginButton';

function Header() {
  return <VaLoginButton />;
}
```

### 5. Handle Callback

**Without React Router:**
```jsx
import VaAuthCallbackNoRouter from './components/VaAuthCallbackNoRouter';

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const isOAuthCallback = urlParams.has('code') && urlParams.has('state');

  if (isOAuthCallback) {
    return <VaAuthCallbackNoRouter />;
  }

  // Your normal app...
}
```

**With React Router:**
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import VaAuthCallback from './components/VaAuthCallback';

<Routes>
  <Route path="/callback" element={<VaAuthCallback />} />
  {/* Other routes */}
</Routes>
```

## 🔑 API Reference

### useVaAuth Hook

```jsx
const {
  // State
  isAuthenticated,  // boolean - Is user logged in?
  isLoading,        // boolean - Loading auth state?
  error,            // string|null - Current error message
  accessToken,      // string|null - OAuth access token
  userInfo,         // object|null - User profile data

  // Methods
  login,            // () => void - Start OAuth flow
  logout,           // () => void - Sign out and revoke token
  handleCallback,   // (code, state) => Promise - Process OAuth callback
  refreshAccessToken, // (refreshToken) => Promise - Refresh token
  fetchVaApi,       // (endpoint, options) => Promise - Authenticated fetch
} = useVaAuth();
```

### User Info Object

When authenticated, `userInfo` contains:

```javascript
{
  sub: "user_id",              // VA.gov user ID
  name: "John Doe",            // Full name
  given_name: "John",          // First name
  family_name: "Doe",          // Last name
  email: "john@example.com",   // Email address
  // Additional fields based on scopes
}
```

## 🛡️ Security Features

- ✅ **PKCE (RFC 7636)** - Authorization Code flow without client secret
- ✅ **State Parameter** - CSRF attack prevention
- ✅ **Token Expiration** - Automatic detection and refresh
- ✅ **Secure Storage** - sessionStorage (cleared on browser close)
- ✅ **Token Revocation** - Proper cleanup on logout
- ✅ **SHA-256 Hashing** - Secure code challenge generation
- ✅ **HTTPS Only** - Production requires secure connection

## 🎨 Customization

### Custom Login Button

```jsx
import { useVaAuth } from './hooks/useVaAuth';

function CustomButton() {
  const { login, logout, isAuthenticated, userInfo } = useVaAuth();

  return (
    <button onClick={isAuthenticated ? logout : login}>
      {isAuthenticated ? `Sign Out ${userInfo?.name}` : 'Sign In'}
    </button>
  );
}
```

### Custom OAuth Scopes

Edit [vaAuth.js](src/config/vaAuth.js):

```javascript
export const VA_SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'claim.read',
  // Add more scopes as needed
].join(' ');
```

### Custom Redirect URL

In production, update `.env`:

```env
VITE_VA_REDIRECT_URL=https://supply-locker.org/callback
```

## 📊 Available VA.gov Scopes

| Scope | Description |
|-------|-------------|
| `openid` | OpenID Connect (required) |
| `profile` | Basic user profile |
| `email` | User email address |
| `offline_access` | Refresh token |
| `claim.read` | Read VA claims data |
| `service_history.read` | Military service history |
| `disability_rating.read` | Disability rating |
| `veteran_status.read` | Veteran verification |

## 🧪 Testing

### Sandbox Environment

The integration uses VA's sandbox by default for testing:

```env
VITE_VA_API_ENV=sandbox
```

Sandbox URLs:
- Authorization: `https://sandbox-api.va.gov/oauth2/authorization`
- Token: `https://sandbox-api.va.gov/oauth2/token`
- User Info: `https://sandbox-api.va.gov/oauth2/userinfo`

### Test Accounts

Get test accounts from: https://developer.va.gov/explore/api/test-user-guide

### Production Environment

For production:

```env
VITE_VA_API_ENV=production
```

Production URLs:
- Authorization: `https://api.va.gov/oauth2/authorization`
- Token: `https://api.va.gov/oauth2/token`
- User Info: `https://api.va.gov/oauth2/userinfo`

## 📝 Example Use Cases

### 1. Conditional Feature Access

```jsx
function PremiumFeature() {
  const { isAuthenticated } = useVaAuth();

  return isAuthenticated ? (
    <YourFeature />
  ) : (
    <div>Sign in to access this feature</div>
  );
}
```

### 2. Fetch User's VA Claims

```jsx
function MyClaims() {
  const { fetchVaApi, isAuthenticated } = useVaAuth();
  const [claims, setClaims] = useState([]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchVaApi('https://sandbox-api.va.gov/services/claims/v1/claims')
        .then(data => setClaims(data))
        .catch(err => console.error(err));
    }
  }, [isAuthenticated, fetchVaApi]);

  return <div>{/* Render claims */}</div>;
}
```

### 3. Protected Route

```jsx
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useVaAuth();

  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/" />;
  return children;
}
```

## ⚠️ Common Issues

### Issue: "Invalid configuration"

**Solution:** Ensure environment variables are set:
```bash
# Check .env file exists and has:
VITE_VA_CLIENT_ID=...
VITE_VA_REDIRECT_URL=...
```

Restart dev server after creating `.env`.

### Issue: "State mismatch"

**Solution:** Don't reload page during OAuth flow. Clear sessionStorage:
```javascript
sessionStorage.clear();
```

### Issue: Redirect not working

**Solution:** 
1. Check `VITE_VA_REDIRECT_URL` matches your current URL
2. Verify URL is registered at https://developer.va.gov/
3. Include the port number for localhost

### Issue: Tokens not persisting

**Expected behavior!** Tokens are stored in `sessionStorage` and cleared when browser closes. This is intentional for security. The app will use refresh tokens automatically.

## 📚 Additional Resources

- [VA.gov Developer Portal](https://developer.va.gov/)
- [OAuth 2.0 Specification](https://tools.ietf.org/html/rfc6749)
- [PKCE Specification](https://tools.ietf.org/html/rfc7636)
- [VA API Documentation](https://developer.va.gov/explore)

## 🔧 Maintenance

### Updating Scopes

Edit [vaAuth.js](src/config/vaAuth.js):
```javascript
export const VA_SCOPES = [
  'openid',
  'profile',
  'new_scope_here',
].join(' ');
```

### Switching Environments

Development:
```env
VITE_VA_API_ENV=sandbox
```

Production:
```env
VITE_VA_API_ENV=production
```

### Updating Token Storage

Edit [VaAuthContext.jsx](src/contexts/VaAuthContext.jsx) to use localStorage instead of sessionStorage (if needed for persistent login).

## 🎖️ Built for Veterans, by a Veteran

This integration was built specifically for SupplyLocker.org to help veterans access their VA data securely and easily.

---

**Questions?**
- VA API Support: api@va.gov
- Developer Portal: https://developer.va.gov/support
