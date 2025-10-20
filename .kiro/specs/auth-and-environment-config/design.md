# Design Document: Authentication, Authorization, and Environment Configuration

## Overview

This design document outlines the architecture for implementing a comprehensive authentication and authorization system with environment-based configuration for the User Journey Analytics Agent application. The system will support three specific authorized users, role-based access control, and seamless switching between development (local mocks) and production (actual AWS/Firebase services) environments.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend Applications                        │
│  ┌──────────────────────┐      ┌──────────────────────────┐   │
│  │   User App (3000)    │      │ Analytics Dashboard      │   │
│  │                      │      │      (3001)              │   │
│  │  - Login Page        │      │  - Login Page            │   │
│  │  - Protected Routes  │      │  - Protected Routes      │   │
│  │  - Auth Context      │      │  - Auth Context          │   │
│  │  - Environment Config│      │  - Environment Config    │   │
│  └──────────┬───────────┘      └──────────┬───────────────┘   │
│             │                              │                    │
└─────────────┼──────────────────────────────┼────────────────────┘
              │                              │
              │  JWT Token in Headers        │
              │                              │
              ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Spring Boot)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Security Layer                               │  │
│  │  - JWT Authentication Filter                             │  │
│  │  - Role-Based Authorization                              │  │
│  │  - Rate Limiting                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Environment Configuration                       │  │
│  │  - Dev Profile (LocalStack, Firebase Emulator)           │  │
│  │  - Prod Profile (AWS Services, Firebase Auth)            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
              │                              │
              │ Dev Mode                     │ Prod Mode
              ▼                              ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│   Local Development      │    │   Production Services    │
│                          │    │                          │
│  - LocalStack (4566)     │    │  - AWS DynamoDB          │
│  - Firebase Emulator     │    │  - AWS Kinesis           │
│    (9099)                │    │  - AWS S3                │
│  - Mock Services         │    │  - AWS SQS               │
│                          │    │  - AWS Bedrock           │
│                          │    │  - Firebase Auth         │
└──────────────────────────┘    └──────────────────────────┘
```

## Components and Interfaces

### 1. Authentication Components

#### 1.1 Frontend Authentication Service

**Location**: `packages/shared/src/services/AuthService.ts`

```typescript
interface AuthService {
  // Authentication methods
  login(email: string, password: string): Promise<AuthResponse>;
  logout(): Promise<void>;
  refreshToken(): Promise<string>;
  getCurrentUser(): Promise<User | null>;
  
  // Token management
  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;
  isTokenValid(): boolean;
  
  // User state
  isAuthenticated(): boolean;
  getUserRole(): UserRole | null;
}

interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
  expiresIn: number;
}

interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
}

enum UserRole {
  ADMIN = 'admin',
  ANALYST = 'analyst',
  VIEWER = 'viewer'
}
```

#### 1.2 Backend Authentication Components

**JWT Service** - `backend/src/main/java/com/userjourney/analytics/service/JwtService.java`

```java
@Service
public class JwtService {
    String generateToken(String email, String role);
    String extractEmail(String token);
    String extractRole(String token);
    boolean validateToken(String token);
    boolean isTokenExpired(String token);
    String refreshToken(String token);
}
```

**Firebase Auth Service** - `backend/src/main/java/com/userjourney/analytics/service/FirebaseAuthService.java`

```java
@Service
public class FirebaseAuthService {
    FirebaseToken verifyIdToken(String idToken);
    UserRecord getUserByEmail(String email);
    String getUserRole(String uid);
    boolean isAuthorizedUser(String email);
}
```

**JWT Authentication Filter** - `backend/src/main/java/com/userjourney/analytics/security/JwtAuthenticationFilter.java`

```java
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException;
}
```

#### 1.3 Authorization Components

**Role-Based Access Control**

```java
@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    // Role hierarchy: ADMIN > ANALYST > VIEWER
    
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/health").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/analytics/**").hasAnyRole("ADMIN", "ANALYST")
                .requestMatchers("/api/events/**").hasAnyRole("ADMIN", "ANALYST", "VIEWER")
                .anyRequest().authenticated()
            );
    }
}
```

**User Role Configuration** - `backend/src/main/resources/authorized-users.yml`

```yaml
authorized:
  users:
    - email: admin@example.com
      role: ADMIN
      displayName: System Administrator
    - email: analyst@example.com
      role: ANALYST
      displayName: Data Analyst
    - email: viewer@example.com
      role: VIEWER
      displayName: Report Viewer
```

### 2. Environment Configuration Components

#### 2.1 Frontend Environment Configuration

**Environment Detection** - `packages/shared/src/config/environment.ts`

```typescript
enum Environment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production'
}

interface EnvironmentConfig {
  environment: Environment;
  apiBaseUrl: string;
  websocketUrl: string;
  firebaseConfig: FirebaseConfig;
  features: FeatureFlags;
}

class EnvironmentManager {
  static getEnvironment(): Environment;
  static getConfig(): EnvironmentConfig;
  static isDevelopment(): boolean;
  static isProduction(): boolean;
}
```

**Configuration Files**:
- `.env.development` - Development environment variables
- `.env.production` - Production environment variables
- `packages/user-app/src/config/config.ts` - User App configuration
- `packages/analytics-dashboard/src/config/config.ts` - Dashboard configuration

#### 2.2 Backend Environment Configuration

**Spring Profiles**:
- `application.yml` - Base configuration
- `application-dev.yml` - Development profile
- `application-prod.yml` - Production profile

**Development Profile** - `application-dev.yml`

```yaml
spring:
  profiles: dev

aws:
  mock:
    enabled: true
    endpoint: http://localhost:4566
  region: us-east-1
  
firebase:
  emulator:
    enabled: true
    host: localhost
    port: 9099
  credentials:
    path: ./firebase-service-account-dev.json

dynamodb:
  endpoint: http://localhost:4566
  
kinesis:
  endpoint: http://localhost:4566
  
s3:
  endpoint: http://localhost:4566
  
sqs:
  endpoint: http://localhost:4566
```

**Production Profile** - `application-prod.yml`

```yaml
spring:
  profiles: prod

aws:
  mock:
    enabled: false
  region: ${AWS_REGION:us-east-1}
  
firebase:
  emulator:
    enabled: false
  credentials:
    path: ${FIREBASE_CREDENTIALS_PATH:./firebase-service-account-prod.json}

# Use actual AWS service endpoints (default SDK behavior)
```

**AWS Configuration Service** - `backend/src/main/java/com/userjourney/analytics/config/AwsConfig.java`

```java
@Configuration
public class AwsConfig {
    @Value("${aws.mock.enabled:false}")
    private boolean mockEnabled;
    
    @Value("${aws.mock.endpoint:http://localhost:4566}")
    private String mockEndpoint;
    
    @Bean
    @Profile("dev")
    public DynamoDbClient devDynamoDbClient() {
        return DynamoDbClient.builder()
            .endpointOverride(URI.create(mockEndpoint))
            .region(Region.US_EAST_1)
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create("test", "test")
            ))
            .build();
    }
    
    @Bean
    @Profile("prod")
    public DynamoDbClient prodDynamoDbClient() {
        return DynamoDbClient.builder()
            .region(Region.of(awsRegion))
            .build();
    }
    
    // Similar beans for Kinesis, S3, SQS, Bedrock
}
```

### 3. Protected Routes and Navigation Guards

#### 3.1 Frontend Route Protection

**Auth Context Provider** - `packages/shared/src/contexts/AuthContext.tsx`

```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check authentication state on mount
    checkAuthState();
  }, []);
  
  // Implementation
};
```

**Protected Route Component** - `packages/shared/src/components/ProtectedRoute.tsx`

```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  redirectTo = '/login'
}) => {
  const { isAuthenticated, hasRole, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }
  
  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return <>{children}</>;
};
```

#### 3.2 Route Configuration

**User App Routes** - `packages/user-app/src/App.tsx`

```typescript
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } />
          
          <Route path="/calculator" element={
            <ProtectedRoute>
              <CalculatorPage />
            </ProtectedRoute>
          } />
          
          {/* Other protected routes */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

**Analytics Dashboard Routes** - `packages/analytics-dashboard/src/App.tsx`

```typescript
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          
          <Route path="/" element={
            <ProtectedRoute requiredRole={UserRole.ANALYST}>
              <DashboardPage />
            </ProtectedRoute>
          } />
          
          <Route path="/admin" element={
            <ProtectedRoute requiredRole={UserRole.ADMIN}>
              <AdminPage />
            </ProtectedRoute>
          } />
          
          {/* Other protected routes */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

### 4. Login and Logout Components

#### 4.1 Login Page

**Component** - `packages/shared/src/components/LoginPage.tsx`

```typescript
export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(email, password);
      
      // Redirect to originally requested page or home
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="login-container">
      <form onSubmit={handleSubmit}>
        <h2>Login</h2>
        {error && <div className="error">{error}</div>}
        
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};
```

#### 4.2 User Menu Component

**Component** - `packages/shared/src/components/UserMenu.tsx`

```typescript
export const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  
  if (!user) return null;
  
  return (
    <div className="user-menu">
      <div className="user-info">
        <span className="user-email">{user.email}</span>
        <span className="user-role">{user.role}</span>
      </div>
      <button onClick={handleLogout} className="logout-button">
        Logout
      </button>
    </div>
  );
};
```

### 5. Backend Authentication Endpoints

**Auth Controller** - `backend/src/main/java/com/userjourney/analytics/controller/AuthController.java`

```java
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        // Verify Firebase ID token
        // Check if user is authorized
        // Generate JWT token
        // Return token and user info
    }
    
    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refreshToken(
        @RequestHeader("Authorization") String token
    ) {
        // Validate current token
        // Generate new token
        // Return new token
    }
    
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
        @RequestHeader("Authorization") String token
    ) {
        // Invalidate token (add to blacklist if using Redis)
        // Return success
    }
    
    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser(
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        // Return current user info
    }
}
```

## Data Models

### User Model

```java
public class User {
    private String uid;
    private String email;
    private String displayName;
    private UserRole role;
    private Instant createdAt;
    private Instant lastLoginAt;
}

public enum UserRole {
    ADMIN,
    ANALYST,
    VIEWER
}
```

### JWT Token Structure

```json
{
  "sub": "user@example.com",
  "role": "ADMIN",
  "iat": 1634567890,
  "exp": 1634654290,
  "iss": "user-journey-analytics"
}
```

### Environment Configuration Model

```typescript
interface EnvironmentConfig {
  environment: 'development' | 'production';
  api: {
    baseUrl: string;
    websocketUrl: string;
    timeout: number;
  };
  firebase: {
    projectId: string;
    apiKey: string;
    authDomain: string;
    useEmulator: boolean;
    emulatorHost?: string;
    emulatorPort?: number;
  };
  aws: {
    region: string;
    useMock: boolean;
    mockEndpoint?: string;
  };
  features: {
    enableVideoLibrary: boolean;
    enableCalculator: boolean;
    enableDocumentUpload: boolean;
    enableAnalytics: boolean;
  };
}
```

## Error Handling

### Authentication Errors

1. **Invalid Credentials** (401)
   - Message: "Invalid email or password"
   - Action: Display error, allow retry

2. **Unauthorized User** (403)
   - Message: "You are not authorized to access this application"
   - Action: Display error, redirect to login

3. **Token Expired** (401)
   - Message: "Your session has expired"
   - Action: Attempt token refresh, or redirect to login

4. **Insufficient Permissions** (403)
   - Message: "You don't have permission to access this resource"
   - Action: Display error, redirect to appropriate page

### Environment Configuration Errors

1. **Missing Environment Variables**
   - Fail fast on application startup
   - Log detailed error message
   - Provide guidance on required variables

2. **Invalid Configuration**
   - Validate configuration on startup
   - Log validation errors
   - Prevent application from starting

3. **Service Connection Failures**
   - Retry with exponential backoff
   - Log connection attempts
   - Fallback to circuit breaker pattern

## Testing Strategy

### Unit Tests

1. **Authentication Service Tests**
   - Test login with valid credentials
   - Test login with invalid credentials
   - Test token generation and validation
   - Test token refresh
   - Test logout

2. **Authorization Tests**
   - Test role-based access control
   - Test permission checks
   - Test unauthorized access attempts

3. **Environment Configuration Tests**
   - Test environment detection
   - Test configuration loading
   - Test service endpoint resolution

### Integration Tests

1. **End-to-End Authentication Flow**
   - User logs in with valid credentials
   - Token is stored and used for API requests
   - User accesses protected routes
   - User logs out successfully

2. **Environment Switching Tests**
   - Application starts in dev mode
   - Application connects to LocalStack
   - Application starts in prod mode
   - Application connects to AWS services

3. **Role-Based Access Tests**
   - Admin user accesses admin endpoints
   - Analyst user accesses analytics endpoints
   - Viewer user cannot access admin endpoints

### Manual Testing Checklist

1. **Development Mode**
   - [ ] Start application with dev profile
   - [ ] Verify LocalStack connection
   - [ ] Verify Firebase emulator connection
   - [ ] Login with test user
   - [ ] Access protected routes
   - [ ] Verify mock data is used

2. **Production Mode**
   - [ ] Start application with prod profile
   - [ ] Verify AWS service connections
   - [ ] Verify Firebase Auth connection
   - [ ] Login with authorized user
   - [ ] Access protected routes
   - [ ] Verify real data is used

3. **Authorization**
   - [ ] Login as admin user
   - [ ] Verify access to admin features
   - [ ] Login as analyst user
   - [ ] Verify access to analytics features
   - [ ] Verify no access to admin features
   - [ ] Login as viewer user
   - [ ] Verify read-only access

## Security Considerations

### 1. Credential Storage

- Store JWT tokens in httpOnly cookies (preferred) or localStorage
- Never store passwords in frontend
- Use secure, encrypted storage for sensitive configuration

### 2. Token Security

- Use strong JWT secret (minimum 256 bits)
- Set appropriate token expiration (24 hours)
- Implement token refresh mechanism
- Consider token blacklisting for logout

### 3. HTTPS/TLS

- Enforce HTTPS in production
- Use TLS 1.2 or higher
- Implement HSTS headers

### 4. CORS Configuration

- Whitelist specific origins
- Don't use wildcard (*) in production
- Validate origin headers

### 5. Rate Limiting

- Implement rate limiting on auth endpoints
- Prevent brute force attacks
- Use exponential backoff for failed attempts

### 6. Environment Variables

- Never commit .env files to version control
- Use .env.template files for documentation
- Validate required variables on startup
- Use secrets management in production (AWS Secrets Manager)

## Deployment Considerations

### Development Environment Setup

1. Install LocalStack: `pip install localstack`
2. Start LocalStack: `localstack start`
3. Install Firebase CLI: `npm install -g firebase-tools`
4. Start Firebase emulators: `firebase emulators:start --only auth`
5. Set environment: `export SPRING_PROFILES_ACTIVE=dev`
6. Start backend: `./mvnw spring-boot:run`
7. Set environment: `export NODE_ENV=development`
8. Start frontends: `npm run start:dev`

### Production Environment Setup

1. Configure AWS credentials
2. Set up Firebase project
3. Create authorized users in Firebase
4. Configure environment variables
5. Set environment: `export SPRING_PROFILES_ACTIVE=prod`
6. Build backend: `./mvnw clean package`
7. Run backend: `java -jar target/analytics-backend.jar`
8. Build frontends: `npm run build:prod`
9. Deploy to hosting service

### Environment Variable Management

**Development** (`.env.development`):
```bash
NODE_ENV=development
REACT_APP_API_BASE_URL=http://localhost:8080
REACT_APP_FIREBASE_USE_EMULATOR=true
REACT_APP_FIREBASE_EMULATOR_HOST=localhost
REACT_APP_FIREBASE_EMULATOR_PORT=9099
```

**Production** (`.env.production`):
```bash
NODE_ENV=production
REACT_APP_API_BASE_URL=https://api.yourdomain.com
REACT_APP_FIREBASE_USE_EMULATOR=false
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_API_KEY=your-api-key
```

## Performance Considerations

1. **Token Caching**
   - Cache validated tokens to reduce Firebase API calls
   - Use Redis for distributed token cache
   - Set appropriate TTL

2. **Connection Pooling**
   - Configure connection pools for AWS services
   - Reuse HTTP clients
   - Implement connection timeout and retry logic

3. **Lazy Loading**
   - Load environment configuration on demand
   - Defer service initialization until needed
   - Use lazy beans in Spring

4. **Monitoring**
   - Log authentication attempts
   - Monitor token validation performance
   - Track environment-specific metrics
   - Alert on authentication failures

## Firebase Analytics Integration for Cost Optimization

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      User App (Frontend)                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Firebase Analytics SDK                          │    │
│  │  - Track all user events                               │    │
│  │  - Automatic screen tracking                           │    │
│  │  - Custom event parameters                             │    │
│  │  - User properties                                     │    │
│  └────────────────┬───────────────────────────────────────┘    │
│                   │                                              │
└───────────────────┼──────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Firebase Analytics                            │
│  - Event collection and processing                              │
│  - Real-time event monitoring (Debug View)                      │
│  - Automatic BigQuery export (daily)                            │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Google BigQuery                             │
│  - Historical event storage                                     │
│  - SQL-based analytics queries                                  │
│  - Cost-effective long-term storage                             │
│  - Integration with Analytics Dashboard                         │
└─────────────────────────────────────────────────────────────────┘
```

### Event Flow Strategy

**Real-Time Events (DynamoDB):**
- Struggle signals
- Exit risk predictions
- Intervention triggers
- Active session data
- Recent user profiles (last 7 days)

**Historical Events (Firebase Analytics → BigQuery):**
- All user interactions
- Page views and navigation
- Video engagement
- Calculator usage
- Document uploads
- Long-term trend analysis
- User behavior patterns

### Firebase Analytics Service

**Location**: `packages/user-app/src/services/FirebaseAnalyticsService.ts`

```typescript
class FirebaseAnalyticsService {
  private analytics: Analytics;
  
  constructor() {
    this.analytics = getAnalytics(firebaseApp);
    
    // Enable debug mode in development
    if (process.env.NODE_ENV === 'development') {
      setAnalyticsCollectionEnabled(this.analytics, true);
    }
  }
  
  // Track page views
  trackPageView(pageName: string, pageParams?: Record<string, any>): void {
    logEvent(this.analytics, 'page_view', {
      page_name: pageName,
      ...pageParams
    });
  }
  
  // Track user actions
  trackEvent(eventName: string, eventParams?: Record<string, any>): void {
    logEvent(this.analytics, eventName, eventParams);
  }
  
  // Track calculator usage
  trackCalculatorEvent(action: string, params: CalculatorParams): void {
    logEvent(this.analytics, 'calculator_interaction', {
      action,
      loan_amount: params.loanAmount,
      interest_rate: params.interestRate,
      term_years: params.termYears,
      result: params.monthlyPayment
    });
  }
  
  // Track video engagement
  trackVideoEvent(action: string, videoId: string, progress?: number): void {
    logEvent(this.analytics, 'video_engagement', {
      action,
      video_id: videoId,
      progress_percent: progress
    });
  }
  
  // Set user properties
  setUserProperties(properties: Record<string, any>): void {
    Object.entries(properties).forEach(([key, value]) => {
      setUserProperties(this.analytics, { [key]: value });
    });
  }
  
  // Set user ID
  setUserId(userId: string): void {
    setUserId(this.analytics, userId);
  }
}
```

### BigQuery Integration

**Schema Design**:

```sql
-- Firebase Analytics automatically creates these tables
-- events_YYYYMMDD (daily partitioned tables)
-- events_intraday_YYYYMMDD (real-time data)

-- Example query for user journey analysis
SELECT
  user_pseudo_id,
  event_name,
  event_timestamp,
  event_params,
  user_properties
FROM
  `project.analytics_XXXXX.events_*`
WHERE
  _TABLE_SUFFIX BETWEEN '20250101' AND '20251231'
  AND event_name IN ('page_view', 'calculator_interaction', 'video_engagement')
ORDER BY
  user_pseudo_id, event_timestamp;
```

**Backend BigQuery Service** - `backend/src/main/java/com/userjourney/analytics/service/BigQueryAnalyticsService.java`

```java
@Service
public class BigQueryAnalyticsService {
    private final BigQuery bigQuery;
    
    public List<UserJourneyEvent> getHistoricalEvents(
        String userId,
        LocalDate startDate,
        LocalDate endDate
    ) {
        String query = String.format("""
            SELECT
              event_name,
              event_timestamp,
              event_params,
              user_properties
            FROM
              `%s.analytics_%s.events_*`
            WHERE
              _TABLE_SUFFIX BETWEEN '%s' AND '%s'
              AND user_pseudo_id = @userId
            ORDER BY
              event_timestamp
            """,
            projectId,
            datasetId,
            startDate.format(DateTimeFormatter.BASIC_ISO_DATE),
            endDate.format(DateTimeFormatter.BASIC_ISO_DATE)
        );
        
        // Execute query and return results
    }
    
    public Map<String, Long> getEventCounts(LocalDate date) {
        // Query BigQuery for event counts by type
    }
    
    public List<UserBehaviorPattern> analyzeUserBehavior(
        LocalDate startDate,
        LocalDate endDate
    ) {
        // Complex analytics queries on BigQuery
    }
}
```

### Cost Comparison

**DynamoDB Only Approach:**
- Storage: $0.25 per GB/month
- Write requests: $1.25 per million
- Read requests: $0.25 per million
- Estimated monthly cost for 1M events: ~$150-200

**Firebase Analytics + BigQuery Approach:**
- Firebase Analytics: Free
- BigQuery storage: $0.02 per GB/month (long-term)
- BigQuery queries: $5 per TB processed
- DynamoDB (critical events only): ~$30-50
- Estimated monthly cost: ~$40-70

**Cost Savings: ~60-70%**

### Event Migration Strategy

1. **Dual Write Period** (Week 1-2)
   - Send events to both DynamoDB and Firebase Analytics
   - Validate data consistency
   - Monitor Firebase Analytics dashboard

2. **Gradual Transition** (Week 3-4)
   - Move historical queries to BigQuery
   - Keep real-time queries on DynamoDB
   - Update Analytics Dashboard to use BigQuery

3. **Full Migration** (Week 5+)
   - Stop writing non-critical events to DynamoDB
   - Use DynamoDB only for real-time critical events
   - Archive old DynamoDB data

4. **Cleanup** (Week 6+)
   - Remove unused DynamoDB tables
   - Optimize BigQuery queries
   - Document new architecture

## Migration Path

### Phase 1: Authentication Implementation
1. Implement JWT service
2. Create Firebase Auth integration
3. Build login/logout functionality
4. Add protected routes

### Phase 2: Authorization Implementation
1. Define user roles
2. Implement role-based access control
3. Create authorized users configuration
4. Add permission checks to endpoints

### Phase 3: Environment Configuration
1. Create environment-specific configuration files
2. Implement environment detection
3. Configure LocalStack for development
4. Set up Firebase emulator

### Phase 4: Firebase Analytics Integration
1. Move Firebase SDK from /frontend to /user-app
2. Implement FirebaseAnalyticsService
3. Configure BigQuery export
4. Create BigQueryAnalyticsService in backend
5. Update Analytics Dashboard to query BigQuery

### Phase 5: Testing and Validation
1. Write unit tests
2. Write integration tests
3. Perform manual testing
4. Security audit
5. Validate cost savings

### Phase 6: Documentation and Deployment
1. Update deployment documentation
2. Create user setup guide
3. Document BigQuery queries
4. Deploy to production
5. Monitor and iterate


## Production Hosting Architecture

### High-Level Production Architecture

```
                                    ┌─────────────────────────────────┐
                                    │      Route 53 (DNS)             │
                                    │  - journey-analytics.io         │
                                    │  - journey-analytics-admin.io   │
                                    └──────────────┬──────────────────┘
                                                   │
                    ┌──────────────────────────────┴──────────────────────────────┐
                    │                                                              │
                    ▼                                                              ▼
    ┌───────────────────────────────┐                        ┌───────────────────────────────┐
    │   CloudFront Distribution     │                        │   CloudFront Distribution     │
    │   www.journey-analytics.io    │                        │ www.journey-analytics-admin.io│
    │   - SSL/TLS Certificate       │                        │   - SSL/TLS Certificate       │
    │   - Global Edge Caching       │                        │   - Global Edge Caching       │
    │   - HTTPS Enforcement         │                        │   - HTTPS Enforcement         │
    └──────────────┬────────────────┘                        └──────────────┬────────────────┘
                   │                                                         │
                   ▼                                                         ▼
    ┌───────────────────────────────┐                        ┌───────────────────────────────┐
    │   S3 Bucket (Static Hosting)  │                        │   S3 Bucket (Static Hosting)  │
    │   User App Build              │                        │   Analytics Dashboard Build   │
    │   - React Production Build    │                        │   - React Production Build    │
    │   - Optimized Assets          │                        │   - Optimized Assets          │
    └───────────────────────────────┘                        └───────────────────────────────┘
                   │                                                         │
                   │                    API Requests                         │
                   └─────────────────────────┬───────────────────────────────┘
                                             │
                                             ▼
                            ┌────────────────────────────────┐
                            │  Application Load Balancer     │
                            │  - Health Checks               │
                            │  - SSL Termination             │
                            │  - Target Group Routing        │
                            └────────────┬───────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    │                                         │
                    ▼                                         ▼
        ┌───────────────────────┐              ┌───────────────────────┐
        │  ECS/Fargate Task 1   │              │  ECS/Fargate Task 2   │
        │  Backend Container    │              │  Backend Container    │
        │  - Spring Boot App    │              │  - Spring Boot App    │
        │  - Auto-scaling       │              │  - Auto-scaling       │
        └───────────────────────┘              └───────────────────────┘
                    │                                         │
                    └────────────────────┬────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    │                                         │
                    ▼                                         ▼
        ┌───────────────────────┐              ┌───────────────────────┐
        │   AWS Services        │              │   Firebase Services   │
        │   - DynamoDB          │              │   - Authentication    │
        │   - Kinesis           │              │   - Analytics         │
        │   - S3                │              │   - BigQuery Export   │
        │   - SQS               │              │                       │
        │   - Bedrock           │              │                       │
        └───────────────────────┘              └───────────────────────┘
```

### Domain Configuration

#### User App Domain: www.journey-analytics.io

**Purpose**: Public-facing application for end users

**Components**:
- CloudFront distribution for global CDN
- S3 bucket for static hosting
- ACM certificate for SSL/TLS
- Route 53 hosted zone for DNS

**Configuration**:
```yaml
Domain: www.journey-analytics.io
CloudFront:
  Origin: user-app-prod.s3.amazonaws.com
  ViewerProtocolPolicy: redirect-to-https
  CacheBehavior:
    DefaultTTL: 86400  # 24 hours
    MinTTL: 0
    MaxTTL: 31536000   # 1 year
  CustomErrorResponses:
    - ErrorCode: 404
      ResponseCode: 200
      ResponsePagePath: /index.html  # SPA routing
  SecurityHeaders:
    - Strict-Transport-Security: max-age=31536000; includeSubDomains
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - X-XSS-Protection: 1; mode=block
```

#### Analytics Dashboard Domain: www.journey-analytics-admin.io

**Purpose**: Internal analytics dashboard for authorized users

**Components**:
- CloudFront distribution for global CDN
- S3 bucket for static hosting
- ACM certificate for SSL/TLS
- Route 53 hosted zone for DNS

**Configuration**:
```yaml
Domain: www.journey-analytics-admin.io
CloudFront:
  Origin: analytics-dashboard-prod.s3.amazonaws.com
  ViewerProtocolPolicy: redirect-to-https
  CacheBehavior:
    DefaultTTL: 86400
    MinTTL: 0
    MaxTTL: 31536000
  CustomErrorResponses:
    - ErrorCode: 404
      ResponseCode: 200
      ResponsePagePath: /index.html
  SecurityHeaders:
    - Strict-Transport-Security: max-age=31536000; includeSubDomains
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - X-XSS-Protection: 1; mode=block
```

### SSL/TLS Certificate Management

**AWS Certificate Manager (ACM)**:

```typescript
// Certificate for User App
const userAppCertificate = new acm.Certificate(this, 'UserAppCertificate', {
  domainName: 'www.journey-analytics.io',
  validation: acm.CertificateValidation.fromDns(hostedZone),
  subjectAlternativeNames: ['journey-analytics.io']
});

// Certificate for Analytics Dashboard
const dashboardCertificate = new acm.Certificate(this, 'DashboardCertificate', {
  domainName: 'www.journey-analytics-admin.io',
  validation: acm.CertificateValidation.fromDns(hostedZone),
  subjectAlternativeNames: ['journey-analytics-admin.io']
});
```

**Features**:
- Automatic certificate renewal
- DNS validation
- Wildcard support
- Multi-region deployment

### DNS Configuration

**Route 53 Hosted Zones**:

```typescript
// User App DNS Records
const userAppZone = new route53.HostedZone(this, 'UserAppZone', {
  zoneName: 'journey-analytics.io'
});

new route53.ARecord(this, 'UserAppAliasRecord', {
  zone: userAppZone,
  recordName: 'www',
  target: route53.RecordTarget.fromAlias(
    new targets.CloudFrontTarget(userAppDistribution)
  )
});

// Redirect apex to www
new route53.ARecord(this, 'UserAppApexRecord', {
  zone: userAppZone,
  recordName: '',
  target: route53.RecordTarget.fromAlias(
    new targets.CloudFrontTarget(userAppDistribution)
  )
});

// Analytics Dashboard DNS Records
const dashboardZone = new route53.HostedZone(this, 'DashboardZone', {
  zoneName: 'journey-analytics-admin.io'
});

new route53.ARecord(this, 'DashboardAliasRecord', {
  zone: dashboardZone,
  recordName: 'www',
  target: route53.RecordTarget.fromAlias(
    new targets.CloudFrontTarget(dashboardDistribution)
  )
});
```

### Backend API Configuration

**Application Load Balancer**:

```typescript
const alb = new elbv2.ApplicationLoadBalancer(this, 'BackendALB', {
  vpc,
  internetFacing: true,
  loadBalancerName: 'user-journey-backend-alb'
});

const httpsListener = alb.addListener('HttpsListener', {
  port: 443,
  protocol: elbv2.ApplicationProtocol.HTTPS,
  certificates: [backendCertificate],
  defaultAction: elbv2.ListenerAction.forward([targetGroup])
});

// Redirect HTTP to HTTPS
alb.addListener('HttpListener', {
  port: 80,
  protocol: elbv2.ApplicationProtocol.HTTP,
  defaultAction: elbv2.ListenerAction.redirect({
    protocol: 'HTTPS',
    port: '443',
    permanent: true
  })
});
```

**Health Checks**:
```typescript
const targetGroup = new elbv2.ApplicationTargetGroup(this, 'BackendTargetGroup', {
  vpc,
  port: 8080,
  protocol: elbv2.ApplicationProtocol.HTTP,
  targetType: elbv2.TargetType.IP,
  healthCheck: {
    path: '/actuator/health',
    interval: cdk.Duration.seconds(30),
    timeout: cdk.Duration.seconds(5),
    healthyThresholdCount: 2,
    unhealthyThresholdCount: 3,
    healthyHttpCodes: '200'
  }
});
```

### Frontend Environment Configuration

**User App Production Config** (`.env.production`):
```bash
# Application
REACT_APP_ENV=production
REACT_APP_NAME=User Journey Analytics

# API Configuration
REACT_APP_API_BASE_URL=https://api.journey-analytics.io
REACT_APP_WS_URL=wss://api.journey-analytics.io/ws

# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=${FIREBASE_API_KEY}
REACT_APP_FIREBASE_AUTH_DOMAIN=journey-analytics.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=journey-analytics-prod
REACT_APP_FIREBASE_STORAGE_BUCKET=journey-analytics-prod.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=${FIREBASE_MESSAGING_SENDER_ID}
REACT_APP_FIREBASE_APP_ID=${FIREBASE_APP_ID}
REACT_APP_FIREBASE_MEASUREMENT_ID=${FIREBASE_MEASUREMENT_ID}

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_DEBUG=false
```

**Analytics Dashboard Production Config** (`.env.production`):
```bash
# Application
REACT_APP_ENV=production
REACT_APP_NAME=Journey Analytics Dashboard

# API Configuration
REACT_APP_API_BASE_URL=https://api.journey-analytics.io
REACT_APP_WS_URL=wss://api.journey-analytics.io/ws

# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=${FIREBASE_API_KEY}
REACT_APP_FIREBASE_AUTH_DOMAIN=journey-analytics.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=journey-analytics-prod

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_DEBUG=false
REACT_APP_REQUIRE_ADMIN=true
```

### CORS Configuration

**Backend CORS Settings** (`application-production.yml`):
```yaml
cors:
  allowed-origins:
    - https://www.journey-analytics.io
    - https://journey-analytics.io
    - https://www.journey-analytics-admin.io
    - https://journey-analytics-admin.io
  allowed-methods: GET,POST,PUT,DELETE,OPTIONS
  allowed-headers: Authorization,Content-Type,X-Requested-With,Accept,Origin
  allow-credentials: true
  max-age: 3600
```

### Security Headers

**CloudFront Response Headers Policy**:
```typescript
const securityHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
  securityHeadersBehavior: {
    contentTypeOptions: { override: true },
    frameOptions: {
      frameOption: cloudfront.HeadersFrameOption.DENY,
      override: true
    },
    referrerPolicy: {
      referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
      override: true
    },
    strictTransportSecurity: {
      accessControlMaxAge: cdk.Duration.days(365),
      includeSubdomains: true,
      override: true
    },
    xssProtection: {
      protection: true,
      modeBlock: true,
      override: true
    },
    contentSecurityPolicy: {
      contentSecurityPolicy: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' https://api.journey-analytics.io wss://api.journey-analytics.io https://*.firebase.com https://*.googleapis.com",
        "frame-ancestors 'none'"
      ].join('; '),
      override: true
    }
  }
});
```

### Auto-Scaling Configuration

**ECS Service Auto-Scaling**:
```typescript
const scaling = service.autoScaleTaskCount({
  minCapacity: 2,
  maxCapacity: 10
});

// Scale based on CPU utilization
scaling.scaleOnCpuUtilization('CpuScaling', {
  targetUtilizationPercent: 70,
  scaleInCooldown: cdk.Duration.seconds(60),
  scaleOutCooldown: cdk.Duration.seconds(60)
});

// Scale based on memory utilization
scaling.scaleOnMemoryUtilization('MemoryScaling', {
  targetUtilizationPercent: 80,
  scaleInCooldown: cdk.Duration.seconds(60),
  scaleOutCooldown: cdk.Duration.seconds(60)
});

// Scale based on request count
scaling.scaleOnRequestCount('RequestScaling', {
  requestsPerTarget: 1000,
  targetGroup: targetGroup,
  scaleInCooldown: cdk.Duration.seconds(60),
  scaleOutCooldown: cdk.Duration.seconds(60)
});
```

### Monitoring and Alarms

**CloudWatch Alarms**:
```typescript
// High error rate alarm
new cloudwatch.Alarm(this, 'HighErrorRate', {
  metric: alb.metricTargetResponseTime(),
  threshold: 1000,  // 1 second
  evaluationPeriods: 2,
  alarmDescription: 'Alert when response time exceeds 1 second',
  actionsEnabled: true
});

// Unhealthy target alarm
new cloudwatch.Alarm(this, 'UnhealthyTargets', {
  metric: targetGroup.metricUnhealthyHostCount(),
  threshold: 1,
  evaluationPeriods: 2,
  alarmDescription: 'Alert when targets become unhealthy'
});

// High CPU utilization
new cloudwatch.Alarm(this, 'HighCpuUtilization', {
  metric: service.metricCpuUtilization(),
  threshold: 80,
  evaluationPeriods: 2,
  alarmDescription: 'Alert when CPU utilization exceeds 80%'
});
```

### Deployment Pipeline

**CI/CD Workflow**:

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy-infrastructure:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy Infrastructure
        run: |
          cd infrastructure
          npm install
          npm run cdk deploy -- --all --require-approval never

  deploy-backend:
    needs: deploy-infrastructure
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Backend
        run: |
          cd backend
          mvn clean package -DskipTests
      
      - name: Build and Push Docker Image
        run: |
          docker build -t user-journey-backend:latest ./backend
          aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REGISTRY
          docker tag user-journey-backend:latest $ECR_REGISTRY/user-journey-backend:latest
          docker push $ECR_REGISTRY/user-journey-backend:latest
      
      - name: Update ECS Service
        run: |
          aws ecs update-service --cluster user-journey-cluster --service backend-service --force-new-deployment

  deploy-user-app:
    needs: deploy-infrastructure
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build User App
        run: |
          cd packages/user-app
          npm install
          npm run build
        env:
          REACT_APP_API_BASE_URL: https://api.journey-analytics.io
          REACT_APP_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          REACT_APP_FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
      
      - name: Deploy to S3
        run: |
          aws s3 sync packages/user-app/build s3://user-app-prod --delete
      
      - name: Invalidate CloudFront Cache
        run: |
          aws cloudfront create-invalidation --distribution-id $USER_APP_DISTRIBUTION_ID --paths "/*"

  deploy-analytics-dashboard:
    needs: deploy-infrastructure
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Analytics Dashboard
        run: |
          cd packages/analytics-dashboard
          npm install
          npm run build
        env:
          REACT_APP_API_BASE_URL: https://api.journey-analytics.io
          REACT_APP_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          REACT_APP_FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
      
      - name: Deploy to S3
        run: |
          aws s3 sync packages/analytics-dashboard/build s3://analytics-dashboard-prod --delete
      
      - name: Invalidate CloudFront Cache
        run: |
          aws cloudfront create-invalidation --distribution-id $DASHBOARD_DISTRIBUTION_ID --paths "/*"
```

### Backup and Disaster Recovery

**DynamoDB Backup**:
```typescript
// Enable point-in-time recovery
const table = new dynamodb.Table(this, 'UserEventsTable', {
  tableName: 'user-events',
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
  pointInTimeRecovery: true,
  removalPolicy: cdk.RemovalPolicy.RETAIN
});

// Daily backup
new backup.BackupPlan(this, 'DynamoDBBackupPlan', {
  backupPlanRules: [
    new backup.BackupPlanRule({
      ruleName: 'DailyBackup',
      scheduleExpression: events.Schedule.cron({ hour: '2', minute: '0' }),
      deleteAfter: cdk.Duration.days(30),
      moveToColdStorageAfter: cdk.Duration.days(7)
    })
  ]
});
```

**Cross-Region Replication**:
```typescript
// Replicate to disaster recovery region
const replicaTable = new dynamodb.Table(this, 'UserEventsTableReplica', {
  tableName: 'user-events-replica',
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
  replicationRegions: ['us-west-2'],
  pointInTimeRecovery: true
});
```

### Cost Optimization

**S3 Lifecycle Policies**:
```typescript
bucket.addLifecycleRule({
  id: 'TransitionToIA',
  transitions: [
    {
      storageClass: s3.StorageClass.INFREQUENT_ACCESS,
      transitionAfter: cdk.Duration.days(30)
    },
    {
      storageClass: s3.StorageClass.GLACIER,
      transitionAfter: cdk.Duration.days(90)
    }
  ],
  expiration: cdk.Duration.days(365)
});
```

**CloudFront Cost Optimization**:
- Use price class to limit edge locations
- Enable compression
- Optimize cache hit ratio
- Set appropriate TTLs

### Phase 7: Production Deployment

1. **Domain Registration and DNS Setup**
   - Register domains (journey-analytics.io, journey-analytics-admin.io)
   - Create Route 53 hosted zones
   - Update domain nameservers

2. **SSL Certificate Provisioning**
   - Request ACM certificates
   - Validate via DNS
   - Wait for certificate issuance

3. **Infrastructure Deployment**
   - Deploy VPC and networking
   - Deploy ECS cluster and services
   - Deploy Application Load Balancer
   - Deploy S3 buckets for static hosting
   - Deploy CloudFront distributions

4. **Application Deployment**
   - Build and deploy backend Docker image
   - Build and deploy User App to S3
   - Build and deploy Analytics Dashboard to S3
   - Configure environment variables

5. **DNS Configuration**
   - Create A records pointing to CloudFront
   - Verify DNS propagation
   - Test domain access

6. **Security Configuration**
   - Configure security groups
   - Set up WAF rules
   - Enable CloudTrail logging
   - Configure GuardDuty

7. **Monitoring Setup**
   - Create CloudWatch dashboards
   - Configure alarms
   - Set up SNS notifications
   - Enable X-Ray tracing

8. **Testing and Validation**
   - Test HTTPS access
   - Verify authentication flow
   - Test API endpoints
   - Validate CORS configuration
   - Performance testing
   - Security scanning

9. **Go-Live**
   - Final smoke tests
   - Enable production traffic
   - Monitor metrics and logs
   - Document runbooks
