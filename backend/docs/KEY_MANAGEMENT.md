# Encryption Key Management Guide

This guide explains how to generate, store, and manage encryption keys and JWT secrets for the User Journey Analytics application.

## Table of Contents

- [Overview](#overview)
- [Key Types](#key-types)
- [Generating Keys](#generating-keys)
- [Storing Keys Securely](#storing-keys-securely)
- [Environment-Specific Keys](#environment-specific-keys)
- [Key Rotation](#key-rotation)
- [Troubleshooting](#troubleshooting)

---

## Overview

The application uses two types of cryptographic keys:

1. **Encryption Key**: Used for encrypting sensitive data at rest (PII, credentials, etc.)
2. **JWT Secret**: Used for signing and verifying JSON Web Tokens for authentication

Both keys must be:
- At least 256 bits (32 bytes)
- Cryptographically random
- Base64 encoded
- Different between development and production environments

---

## Key Types

### Encryption Key

**Purpose**: Encrypts sensitive data using AES-256-GCM

**Configuration**:
```yaml
app:
  encryption:
    key: ${ENCRYPTION_KEY}
```

**Environment Variable**:
```bash
export ENCRYPTION_KEY="<base64-encoded-256-bit-key>"
```

### JWT Secret

**Purpose**: Signs JWT tokens for authentication

**Configuration**:
```yaml
app:
  jwt:
    secret: ${JWT_SECRET}
```

**Environment Variable**:
```bash
export JWT_SECRET="<base64-encoded-256-bit-secret>"
```

---

## Generating Keys

### Method 1: Using OpenSSL (Recommended)

Generate both keys at once:

```bash
# Generate Encryption Key
export ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"

# Generate JWT Secret
export JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET"
```

### Method 2: Using the Key Generator CLI

Run the interactive key generator:

```bash
cd backend
mvn exec:java -Dexec.mainClass="com.userjourney.analytics.util.KeyGeneratorCLI"
```

Menu options:
1. Generate Encryption Key
2. Generate JWT Secret
3. Generate Both (Encryption Key + JWT Secret)
4. Save Key to File
5. Load Key from File
6. Validate Key
7. Show Setup Instructions
8. Exit

### Method 3: Using Java Code

```java
import com.userjourney.analytics.util.SecureKeyStorage;

SecureKeyStorage keyStorage = new SecureKeyStorage();

// Generate encryption key
String encryptionKey = keyStorage.generateSecureKey();

// Generate JWT secret
String jwtSecret = keyStorage.generateJwtSecret();
```

---

## Storing Keys Securely

### Development Environment

For development, you can store keys in environment variables or `application-dev.yml`:

**Option 1: Environment Variables** (Recommended)
```bash
# Add to ~/.bashrc or ~/.zshrc
export ENCRYPTION_KEY="<dev-key>"
export JWT_SECRET="<dev-secret>"
```

**Option 2: Configuration File**
```yaml
# application-dev.yml
app:
  encryption:
    key: ZGV2RW5jcnlwdGlvbktleUZvckRldmVsb3BtZW50T25seU5vdEZvclByb2R1Y3Rpb24=
  jwt:
    secret: ZGV2U2VjcmV0S2V5Rm9yRGV2ZWxvcG1lbnRPbmx5Tm90Rm9yUHJvZHVjdGlvbg==
```

### Production Environment

**NEVER store production keys in configuration files or version control!**

#### Option 1: Environment Variables (Basic)

```bash
# Set in production environment
export ENCRYPTION_KEY="<prod-key>"
export JWT_SECRET="<prod-secret>"
```

#### Option 2: AWS Secrets Manager (Recommended)

1. **Store secrets in AWS Secrets Manager:**

```bash
# Create encryption key secret
aws secretsmanager create-secret \
  --name user-journey-analytics/encryption-key \
  --secret-string "$(openssl rand -base64 32)"

# Create JWT secret
aws secretsmanager create-secret \
  --name user-journey-analytics/jwt-secret \
  --secret-string "$(openssl rand -base64 32)"
```

2. **Configure application to use Secrets Manager:**

Add dependency to `pom.xml`:
```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-aws-secrets-manager-config</artifactId>
</dependency>
```

Update `application-prod.yml`:
```yaml
app:
  encryption:
    key: ${aws.secretsmanager:user-journey-analytics/encryption-key}
  jwt:
    secret: ${aws.secretsmanager:user-journey-analytics/jwt-secret}
```

#### Option 3: File-Based Storage (Unix/Linux)

```bash
# Generate and save keys to secure files
openssl rand -base64 32 > /secure/path/encryption.key
openssl rand -base64 32 > /secure/path/jwt.secret

# Set restrictive permissions (owner read/write only)
chmod 600 /secure/path/encryption.key
chmod 600 /secure/path/jwt.secret

# Load in application
export ENCRYPTION_KEY=$(cat /secure/path/encryption.key)
export JWT_SECRET=$(cat /secure/path/jwt.secret)
```

Using the SecureKeyStorage utility:

```java
SecureKeyStorage keyStorage = new SecureKeyStorage();

// Save key to file with secure permissions
String key = keyStorage.generateSecureKey();
keyStorage.saveKeyToFile(key, "/secure/path/encryption.key");

// Load key from file (validates permissions)
String loadedKey = keyStorage.loadKeyFromFile("/secure/path/encryption.key");
```

---

## Environment-Specific Keys

### Development Keys

Development keys are pre-configured in `application-dev.yml`:

```yaml
app:
  encryption:
    key: ZGV2RW5jcnlwdGlvbktleUZvckRldmVsb3BtZW50T25seU5vdEZvclByb2R1Y3Rpb24=
  jwt:
    secret: ZGV2U2VjcmV0S2V5Rm9yRGV2ZWxvcG1lbnRPbmx5Tm90Rm9yUHJvZHVjdGlvbg==
```

These keys are:
- Safe to commit to version control
- Only used in development environment
- Clearly marked as "not for production"

### Production Keys

Production keys MUST be:
- Generated uniquely for production
- Never committed to version control
- Stored securely (AWS Secrets Manager, environment variables, etc.)
- Different from development keys
- Rotated periodically

---

## Key Rotation

### When to Rotate Keys

Rotate keys when:
- A team member with key access leaves
- Keys may have been compromised
- As part of regular security maintenance (annually)
- Compliance requirements mandate rotation

### Rotation Process

#### 1. Generate New Keys

```bash
# Generate new keys
NEW_ENCRYPTION_KEY=$(openssl rand -base64 32)
NEW_JWT_SECRET=$(openssl rand -base64 32)
```

#### 2. Update Configuration

For AWS Secrets Manager:
```bash
# Update encryption key
aws secretsmanager update-secret \
  --secret-id user-journey-analytics/encryption-key \
  --secret-string "$NEW_ENCRYPTION_KEY"

# Update JWT secret
aws secretsmanager update-secret \
  --secret-id user-journey-analytics/jwt-secret \
  --secret-string "$NEW_JWT_SECRET"
```

#### 3. Re-encrypt Data (Encryption Key Only)

If rotating the encryption key, you must re-encrypt all encrypted data:

```java
// Pseudo-code for data re-encryption
DataEncryptionService oldService = new DataEncryptionService(oldKey);
DataEncryptionService newService = new DataEncryptionService(newKey);

// For each encrypted record:
String decrypted = oldService.decryptSensitiveData(encryptedData);
String reencrypted = newService.encryptSensitiveData(decrypted);
// Save reencrypted data
```

#### 4. Restart Application

```bash
# Restart to load new keys
kubectl rollout restart deployment/user-journey-backend
# or
systemctl restart user-journey-backend
```

#### 5. Invalidate Old JWT Tokens (JWT Secret Only)

When rotating JWT secret, all existing tokens become invalid. Users will need to re-authenticate.

---

## Troubleshooting

### Error: "Encryption key is not configured"

**Cause**: `ENCRYPTION_KEY` environment variable or `app.encryption.key` is not set.

**Solution**:
```bash
export ENCRYPTION_KEY=$(openssl rand -base64 32)
```

### Error: "Encryption key is too short"

**Cause**: Key is less than 256 bits (32 bytes).

**Solution**: Generate a new 256-bit key:
```bash
export ENCRYPTION_KEY=$(openssl rand -base64 32)
```

### Error: "Using a default/test encryption key in PRODUCTION"

**Cause**: Production environment is using a development or example key.

**Solution**: Generate a unique production key:
```bash
export ENCRYPTION_KEY=$(openssl rand -base64 32)
```

### Error: "Key file has overly permissive permissions"

**Cause**: Key file is readable by group or others.

**Solution**: Restrict permissions:
```bash
chmod 600 /path/to/key/file
```

### Error: "Key is not valid base64 encoding"

**Cause**: Key contains invalid characters or is corrupted.

**Solution**: Generate a new key using OpenSSL or the Key Generator CLI.

### Validation Failed

Use the Key Generator CLI to validate your key:

```bash
mvn exec:java -Dexec.mainClass="com.userjourney.analytics.util.KeyGeneratorCLI"
# Select option 6: Validate Key
```

---

## Security Best Practices

### DO:
✓ Use different keys for development and production  
✓ Generate keys using cryptographically secure methods  
✓ Store production keys in AWS Secrets Manager or similar  
✓ Rotate keys periodically  
✓ Use 256-bit keys minimum  
✓ Restrict file permissions to 0600 (owner only)  
✓ Audit key access regularly  

### DON'T:
✗ Commit production keys to version control  
✗ Share keys via email or chat  
✗ Use the same keys across environments  
✗ Use weak or predictable keys  
✗ Store keys in application logs  
✗ Reuse keys from examples or documentation  

---

## Quick Reference

### Generate Keys
```bash
openssl rand -base64 32
```

### Set Environment Variables
```bash
export ENCRYPTION_KEY=$(openssl rand -base64 32)
export JWT_SECRET=$(openssl rand -base64 32)
```

### Validate Key Length
```bash
echo -n "$ENCRYPTION_KEY" | base64 -d | wc -c
# Should output: 32 (or more)
```

### Run Key Generator CLI
```bash
mvn exec:java -Dexec.mainClass="com.userjourney.analytics.util.KeyGeneratorCLI"
```

---

## Additional Resources

- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [NIST Key Management Guidelines](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)
