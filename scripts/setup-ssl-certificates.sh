#!/bin/bash

# SSL Certificate Setup Script
# This script handles SSL certificate generation and management for production

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SSL_DIR="${PROJECT_ROOT}/ssl-certs"
NGINX_SSL_DIR="${SSL_DIR}/nginx"

# Default domains (can be overridden by environment variables)
USER_APP_DOMAIN="${USER_APP_DOMAIN:-app.yourdomain.com}"
ANALYTICS_DASHBOARD_DOMAIN="${ANALYTICS_DASHBOARD_DOMAIN:-analytics.yourdomain.com}"
API_DOMAIN="${API_DOMAIN:-api.yourdomain.com}"

# Certificate configuration
CERT_COUNTRY="${CERT_COUNTRY:-US}"
CERT_STATE="${CERT_STATE:-California}"
CERT_CITY="${CERT_CITY:-San Francisco}"
CERT_ORG="${CERT_ORG:-Your Organization}"
CERT_OU="${CERT_OU:-IT Department}"
CERT_EMAIL="${CERT_EMAIL:-admin@yourdomain.com}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Error handling
error_exit() {
    log_error "$1"
    exit 1
}

# Create directory structure
create_directories() {
    log_step "Creating SSL directory structure..."
    
    mkdir -p "$SSL_DIR"
    mkdir -p "$NGINX_SSL_DIR"
    mkdir -p "$SSL_DIR/ca"
    mkdir -p "$SSL_DIR/certs"
    mkdir -p "$SSL_DIR/private"
    
    # Set proper permissions
    chmod 700 "$SSL_DIR/private"
    chmod 755 "$SSL_DIR/certs"
    
    log_info "SSL directories created"
}

# Generate CA certificate
generate_ca_certificate() {
    log_step "Generating Certificate Authority (CA)..."
    
    local ca_key="$SSL_DIR/ca/ca-key.pem"
    local ca_cert="$SSL_DIR/ca/ca-cert.pem"
    
    if [ -f "$ca_cert" ] && [ -f "$ca_key" ]; then
        log_info "CA certificate already exists, skipping generation"
        return 0
    fi
    
    # Generate CA private key
    openssl genrsa -out "$ca_key" 4096
    chmod 600 "$ca_key"
    
    # Generate CA certificate
    openssl req -new -x509 -days 3650 -key "$ca_key" -out "$ca_cert" \
        -subj "/C=$CERT_COUNTRY/ST=$CERT_STATE/L=$CERT_CITY/O=$CERT_ORG/OU=$CERT_OU/CN=User Journey Analytics CA/emailAddress=$CERT_EMAIL"
    
    chmod 644 "$ca_cert"
    
    log_info "CA certificate generated successfully"
}

# Generate domain certificate
generate_domain_certificate() {
    local domain=$1
    local cert_name=$2
    
    log_step "Generating certificate for $domain..."
    
    local key_file="$SSL_DIR/private/${cert_name}-key.pem"
    local cert_file="$SSL_DIR/certs/${cert_name}-cert.pem"
    local csr_file="$SSL_DIR/${cert_name}-csr.pem"
    local config_file="$SSL_DIR/${cert_name}-config.conf"
    
    # Skip if certificate already exists and is valid
    if [ -f "$cert_file" ] && [ -f "$key_file" ]; then
        if openssl x509 -in "$cert_file" -noout -checkend 86400 &> /dev/null; then
            log_info "Valid certificate for $domain already exists, skipping generation"
            return 0
        fi
    fi
    
    # Create OpenSSL config file
    cat > "$config_file" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = $CERT_COUNTRY
ST = $CERT_STATE
L = $CERT_CITY
O = $CERT_ORG
OU = $CERT_OU
CN = $domain
emailAddress = $CERT_EMAIL

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $domain
DNS.2 = *.$domain
DNS.3 = localhost
IP.1 = 127.0.0.1
EOF
    
    # Generate private key
    openssl genrsa -out "$key_file" 2048
    chmod 600 "$key_file"
    
    # Generate certificate signing request
    openssl req -new -key "$key_file" -out "$csr_file" -config "$config_file"
    
    # Generate certificate signed by CA
    openssl x509 -req -in "$csr_file" -CA "$SSL_DIR/ca/ca-cert.pem" -CAkey "$SSL_DIR/ca/ca-key.pem" \
        -CAcreateserial -out "$cert_file" -days 365 -extensions v3_req -extfile "$config_file"
    
    chmod 644 "$cert_file"
    
    # Create nginx-compatible certificate (cert + CA)
    cat "$cert_file" "$SSL_DIR/ca/ca-cert.pem" > "$NGINX_SSL_DIR/${cert_name}.crt"
    cp "$key_file" "$NGINX_SSL_DIR/${cert_name}.key"
    
    # Clean up temporary files
    rm -f "$csr_file" "$config_file"
    
    log_info "Certificate for $domain generated successfully"
}

# Generate DH parameters for enhanced security
generate_dhparam() {
    log_step "Generating Diffie-Hellman parameters..."
    
    local dhparam_file="$NGINX_SSL_DIR/dhparam.pem"
    
    if [ -f "$dhparam_file" ]; then
        log_info "DH parameters already exist, skipping generation"
        return 0
    fi
    
    # Generate 2048-bit DH parameters (4096 takes too long for demo purposes)
    openssl dhparam -out "$dhparam_file" 2048
    chmod 644 "$dhparam_file"
    
    log_info "DH parameters generated successfully"
}

# Create Let's Encrypt setup script
create_letsencrypt_script() {
    log_step "Creating Let's Encrypt setup script..."
    
    cat > "$SSL_DIR/setup-letsencrypt.sh" << 'EOF'
#!/bin/bash

# Let's Encrypt Certificate Setup
# This script sets up Let's Encrypt certificates for production domains

set -e

# Configuration
DOMAINS="${USER_APP_DOMAIN} ${ANALYTICS_DASHBOARD_DOMAIN} ${API_DOMAIN}"
EMAIL="${CERT_EMAIL}"
WEBROOT="/var/www/certbot"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    log_error "Certbot is not installed. Please install it first:"
    echo "  Ubuntu/Debian: sudo apt-get install certbot python3-certbot-nginx"
    echo "  CentOS/RHEL: sudo yum install certbot python3-certbot-nginx"
    echo "  macOS: brew install certbot"
    exit 1
fi

# Create webroot directory
mkdir -p "$WEBROOT"

# Generate certificates for each domain
for domain in $DOMAINS; do
    log_info "Generating Let's Encrypt certificate for $domain..."
    
    certbot certonly \
        --webroot \
        --webroot-path="$WEBROOT" \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --domains "$domain"
done

# Set up auto-renewal
log_info "Setting up certificate auto-renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

log_info "Let's Encrypt certificates generated successfully!"
log_info "Certificates are located in /etc/letsencrypt/live/"
log_info "Update your nginx configuration to use these certificates."
EOF
    
    chmod +x "$SSL_DIR/setup-letsencrypt.sh"
    
    log_info "Let's Encrypt setup script created at $SSL_DIR/setup-letsencrypt.sh"
}

# Validate certificates
validate_certificates() {
    log_step "Validating generated certificates..."
    
    local domains=("user-app" "analytics-dashboard")
    local all_valid=true
    
    for cert_name in "${domains[@]}"; do
        local cert_file="$NGINX_SSL_DIR/${cert_name}.crt"
        local key_file="$NGINX_SSL_DIR/${cert_name}.key"
        
        if [ -f "$cert_file" ] && [ -f "$key_file" ]; then
            # Check certificate validity
            if openssl x509 -in "$cert_file" -noout -checkend 86400 &> /dev/null; then
                log_info "✓ Certificate for $cert_name is valid"
            else
                log_error "✗ Certificate for $cert_name is invalid or expired"
                all_valid=false
            fi
            
            # Check key-certificate match
            local cert_hash=$(openssl x509 -noout -modulus -in "$cert_file" | openssl md5)
            local key_hash=$(openssl rsa -noout -modulus -in "$key_file" | openssl md5)
            
            if [ "$cert_hash" = "$key_hash" ]; then
                log_info "✓ Certificate and key for $cert_name match"
            else
                log_error "✗ Certificate and key for $cert_name do not match"
                all_valid=false
            fi
        else
            log_error "✗ Certificate or key file missing for $cert_name"
            all_valid=false
        fi
    done
    
    if [ "$all_valid" = true ]; then
        log_info "All certificates are valid"
    else
        log_error "Some certificates are invalid"
        return 1
    fi
}

# Create certificate info script
create_cert_info_script() {
    log_step "Creating certificate information script..."
    
    cat > "$SSL_DIR/cert-info.sh" << 'EOF'
#!/bin/bash

# Certificate Information Script
# Displays information about generated certificates

SSL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_SSL_DIR="$SSL_DIR/nginx"

echo "==================================="
echo "SSL Certificate Information"
echo "==================================="
echo

for cert_file in "$NGINX_SSL_DIR"/*.crt; do
    if [ -f "$cert_file" ]; then
        cert_name=$(basename "$cert_file" .crt)
        echo "Certificate: $cert_name"
        echo "-----------------------------------"
        
        # Basic certificate info
        openssl x509 -in "$cert_file" -noout -subject -issuer -dates
        
        # Subject Alternative Names
        echo "Subject Alternative Names:"
        openssl x509 -in "$cert_file" -noout -text | grep -A 1 "Subject Alternative Name" | tail -1 | sed 's/^[[:space:]]*/  /'
        
        # Check expiration
        if openssl x509 -in "$cert_file" -noout -checkend 2592000 &> /dev/null; then
            echo "Status: Valid (expires in more than 30 days)"
        elif openssl x509 -in "$cert_file" -noout -checkend 86400 &> /dev/null; then
            echo "Status: Warning (expires within 30 days)"
        else
            echo "Status: Expired or expires within 24 hours"
        fi
        
        echo
    fi
done

echo "Certificate files location: $NGINX_SSL_DIR"
echo "CA certificate: $SSL_DIR/ca/ca-cert.pem"
echo
EOF
    
    chmod +x "$SSL_DIR/cert-info.sh"
    
    log_info "Certificate info script created at $SSL_DIR/cert-info.sh"
}

# Update nginx configuration for SSL
update_nginx_ssl_config() {
    log_step "Updating nginx SSL configuration..."
    
    # Update main nginx configuration to include SSL settings
    local nginx_ssl_conf="$PROJECT_ROOT/nginx/conf.d/ssl-common.conf"
    
    cat > "$nginx_ssl_conf" << EOF
# Common SSL Configuration
# Include this file in server blocks that use SSL

# SSL Configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;

# DH Parameters
ssl_dhparam /etc/nginx/ssl/dhparam.pem;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# Security Headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# HSTS Preload
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
EOF
    
    log_info "SSL configuration updated at $nginx_ssl_conf"
}

# Create CORS configuration
create_cors_config() {
    log_step "Creating CORS configuration..."
    
    local cors_conf="$PROJECT_ROOT/nginx/conf.d/cors.conf"
    
    cat > "$cors_conf" << EOF
# CORS Configuration for Production
# This file contains CORS headers for cross-origin requests

# Map to set CORS origin
map \$http_origin \$cors_origin {
    default "";
    "~^https://${USER_APP_DOMAIN}\$" \$http_origin;
    "~^https://${ANALYTICS_DASHBOARD_DOMAIN}\$" \$http_origin;
    "~^https://${API_DOMAIN}\$" \$http_origin;
    "~^https://localhost:3000\$" \$http_origin;  # Development
    "~^https://localhost:3001\$" \$http_origin;  # Development
}

# CORS headers for API endpoints
location ~* ^/api/ {
    # Handle preflight requests
    if (\$request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' \$cors_origin always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, X-Analytics-Token, X-Requested-With' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Max-Age' 1728000 always;
        add_header 'Content-Type' 'text/plain; charset=utf-8' always;
        add_header 'Content-Length' 0 always;
        return 204;
    }
    
    # Add CORS headers to actual requests
    add_header 'Access-Control-Allow-Origin' \$cors_origin always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, X-Analytics-Token, X-Requested-With' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
}
EOF
    
    log_info "CORS configuration created at $cors_conf"
}

# Display setup summary
show_setup_summary() {
    log_step "SSL Setup Summary"
    
    echo "=================================="
    echo "SSL Certificate Setup Completed"
    echo "=================================="
    echo "Timestamp: $(date)"
    echo ""
    echo "Generated Certificates:"
    echo "  User App: $NGINX_SSL_DIR/user-app.crt"
    echo "  Analytics Dashboard: $NGINX_SSL_DIR/analytics-dashboard.crt"
    echo "  CA Certificate: $SSL_DIR/ca/ca-cert.pem"
    echo ""
    echo "Domains Configured:"
    echo "  User App: $USER_APP_DOMAIN"
    echo "  Analytics Dashboard: $ANALYTICS_DASHBOARD_DOMAIN"
    echo "  API: $API_DOMAIN"
    echo ""
    echo "Next Steps:"
    echo "  1. Update your DNS records to point to your server"
    echo "  2. For production, consider using Let's Encrypt:"
    echo "     $SSL_DIR/setup-letsencrypt.sh"
    echo "  3. Import CA certificate to client browsers for self-signed certs"
    echo "  4. Test SSL configuration: $SSL_DIR/cert-info.sh"
    echo ""
}

# Help function
show_help() {
    cat << EOF
SSL Certificate Setup Script

Usage: $0 [OPTIONS]

Options:
    -h, --help              Show this help message
    -d, --domains           Specify domains (comma-separated)
    -e, --email             Certificate email address
    --letsencrypt-only      Only create Let's Encrypt setup script
    --validate-only         Only validate existing certificates
    --regenerate            Force regenerate all certificates

Environment Variables:
    USER_APP_DOMAIN         Domain for user application
    ANALYTICS_DASHBOARD_DOMAIN  Domain for analytics dashboard
    API_DOMAIN              Domain for API endpoints
    CERT_EMAIL              Email for certificates
    CERT_COUNTRY            Certificate country code
    CERT_STATE              Certificate state/province
    CERT_CITY               Certificate city
    CERT_ORG                Certificate organization
    CERT_OU                 Certificate organizational unit

Examples:
    # Generate self-signed certificates
    $0

    # Generate certificates for specific domains
    $0 --domains "app.example.com,analytics.example.com"

    # Only create Let's Encrypt setup
    $0 --letsencrypt-only

    # Validate existing certificates
    $0 --validate-only
EOF
}

# Main function
main() {
    local letsencrypt_only=false
    local validate_only=false
    local regenerate=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -d|--domains)
                IFS=',' read -ra DOMAIN_ARRAY <<< "$2"
                if [ ${#DOMAIN_ARRAY[@]} -ge 1 ]; then
                    USER_APP_DOMAIN="${DOMAIN_ARRAY[0]}"
                fi
                if [ ${#DOMAIN_ARRAY[@]} -ge 2 ]; then
                    ANALYTICS_DASHBOARD_DOMAIN="${DOMAIN_ARRAY[1]}"
                fi
                if [ ${#DOMAIN_ARRAY[@]} -ge 3 ]; then
                    API_DOMAIN="${DOMAIN_ARRAY[2]}"
                fi
                shift 2
                ;;
            -e|--email)
                CERT_EMAIL="$2"
                shift 2
                ;;
            --letsencrypt-only)
                letsencrypt_only=true
                shift
                ;;
            --validate-only)
                validate_only=true
                shift
                ;;
            --regenerate)
                regenerate=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    log_info "Starting SSL certificate setup..."
    
    # Validate prerequisites
    if ! command -v openssl &> /dev/null; then
        error_exit "OpenSSL is not installed or not in PATH"
    fi
    
    # Handle specific modes
    if [ "$letsencrypt_only" = true ]; then
        create_directories
        create_letsencrypt_script
        log_info "Let's Encrypt setup script created"
        exit 0
    fi
    
    if [ "$validate_only" = true ]; then
        validate_certificates
        exit 0
    fi
    
    # Remove existing certificates if regenerating
    if [ "$regenerate" = true ]; then
        log_info "Removing existing certificates for regeneration..."
        rm -rf "$SSL_DIR"
    fi
    
    # Run setup steps
    create_directories
    generate_ca_certificate
    generate_domain_certificate "$USER_APP_DOMAIN" "user-app"
    generate_domain_certificate "$ANALYTICS_DASHBOARD_DOMAIN" "analytics-dashboard"
    generate_dhparam
    create_letsencrypt_script
    create_cert_info_script
    update_nginx_ssl_config
    create_cors_config
    validate_certificates
    show_setup_summary
    
    log_info "SSL certificate setup completed successfully!"
}

# Run main function
main "$@"