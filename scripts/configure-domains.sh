#!/bin/bash

# Domain Configuration Script
# This script helps configure domains and DNS settings for production deployment

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default configuration
USER_APP_DOMAIN="${USER_APP_DOMAIN:-app.yourdomain.com}"
ANALYTICS_DASHBOARD_DOMAIN="${ANALYTICS_DASHBOARD_DOMAIN:-analytics.yourdomain.com}"
API_DOMAIN="${API_DOMAIN:-api.yourdomain.com}"
SERVER_IP="${SERVER_IP:-}"

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

# Get server IP
get_server_ip() {
    log_step "Detecting server IP address..."
    
    if [ -z "$SERVER_IP" ]; then
        # Try to detect public IP
        SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "")
        
        if [ -z "$SERVER_IP" ]; then
            # Fallback to local IP
            SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "127.0.0.1")
        fi
    fi
    
    log_info "Server IP: $SERVER_IP"
}

# Generate DNS configuration
generate_dns_config() {
    log_step "Generating DNS configuration..."
    
    local dns_file="$PROJECT_ROOT/dns-configuration.txt"
    
    cat > "$dns_file" << EOF
# DNS Configuration for User Journey Analytics
# Add these DNS records to your domain registrar or DNS provider

# A Records (IPv4)
${USER_APP_DOMAIN%.yourdomain.com}     IN  A     $SERVER_IP
${ANALYTICS_DASHBOARD_DOMAIN%.yourdomain.com}  IN  A     $SERVER_IP
${API_DOMAIN%.yourdomain.com}          IN  A     $SERVER_IP

# CNAME Records (Alternative if using subdomains)
# app                    IN  CNAME  yourdomain.com.
# analytics              IN  CNAME  yourdomain.com.
# api                    IN  CNAME  yourdomain.com.

# CAA Records (Certificate Authority Authorization)
yourdomain.com.        IN  CAA    0 issue "letsencrypt.org"
yourdomain.com.        IN  CAA    0 issuewild "letsencrypt.org"
yourdomain.com.        IN  CAA    0 iodef "mailto:admin@yourdomain.com"

# TXT Records for verification (if needed)
# _acme-challenge.${USER_APP_DOMAIN}     IN  TXT   "verification-string"
# _acme-challenge.${ANALYTICS_DASHBOARD_DOMAIN}  IN  TXT   "verification-string"

# MX Records (if hosting email)
# yourdomain.com.        IN  MX     10 mail.yourdomain.com.

# Security Records
yourdomain.com.        IN  TXT    "v=spf1 -all"
_dmarc.yourdomain.com. IN  TXT    "v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com"

# Notes:
# - Replace 'yourdomain.com' with your actual domain
# - TTL values are typically 300-3600 seconds for production
# - Test DNS propagation using: dig ${USER_APP_DOMAIN}
# - Verify SSL certificates after DNS propagation
EOF
    
    log_info "DNS configuration generated: $dns_file"
}

# Create hosts file entries for testing
create_hosts_entries() {
    log_step "Creating hosts file entries for local testing..."
    
    local hosts_file="$PROJECT_ROOT/hosts-entries.txt"
    
    cat > "$hosts_file" << EOF
# Hosts file entries for local testing
# Add these entries to /etc/hosts (Linux/macOS) or C:\Windows\System32\drivers\etc\hosts (Windows)

# User Journey Analytics - Local Testing
127.0.0.1    $USER_APP_DOMAIN
127.0.0.1    $ANALYTICS_DASHBOARD_DOMAIN
127.0.0.1    $API_DOMAIN

# Instructions:
# 1. Copy the lines above
# 2. Edit your hosts file as administrator/root:
#    - Linux/macOS: sudo nano /etc/hosts
#    - Windows: Run notepad as administrator, open C:\Windows\System32\drivers\etc\hosts
# 3. Add the lines at the end of the file
# 4. Save and close the file
# 5. Test by visiting https://$USER_APP_DOMAIN in your browser

# Note: Remove these entries when using real DNS records
EOF
    
    log_info "Hosts file entries created: $hosts_file"
}

# Validate domain configuration
validate_domains() {
    log_step "Validating domain configuration..."
    
    local all_valid=true
    
    for domain in "$USER_APP_DOMAIN" "$ANALYTICS_DASHBOARD_DOMAIN" "$API_DOMAIN"; do
        log_info "Checking domain: $domain"
        
        # Check DNS resolution
        if nslookup "$domain" &> /dev/null || dig "$domain" &> /dev/null; then
            log_info "✓ DNS resolution successful for $domain"
        else
            log_warn "✗ DNS resolution failed for $domain (may be expected for new domains)"
        fi
        
        # Check HTTP connectivity (if server is running)
        if curl -s --connect-timeout 5 "http://$domain" &> /dev/null; then
            log_info "✓ HTTP connectivity successful for $domain"
        else
            log_warn "✗ HTTP connectivity failed for $domain (server may not be running)"
        fi
        
        # Check HTTPS connectivity (if SSL is configured)
        if curl -s --connect-timeout 5 -k "https://$domain" &> /dev/null; then
            log_info "✓ HTTPS connectivity successful for $domain"
        else
            log_warn "✗ HTTPS connectivity failed for $domain (SSL may not be configured)"
        fi
    done
}

# Update environment files with domains
update_environment_files() {
    log_step "Updating environment files with domain configuration..."
    
    local env_template="$PROJECT_ROOT/.env.production.template"
    local env_file="$PROJECT_ROOT/.env.production"
    
    if [ -f "$env_template" ]; then
        # Create production env file from template if it doesn't exist
        if [ ! -f "$env_file" ]; then
            cp "$env_template" "$env_file"
            log_info "Created .env.production from template"
        fi
        
        # Update domain values in environment file
        if [ -f "$env_file" ]; then
            sed -i.bak \
                -e "s/USER_APP_DOMAIN=.*/USER_APP_DOMAIN=$USER_APP_DOMAIN/" \
                -e "s/ANALYTICS_DASHBOARD_DOMAIN=.*/ANALYTICS_DASHBOARD_DOMAIN=$ANALYTICS_DASHBOARD_DOMAIN/" \
                -e "s/API_DOMAIN=.*/API_DOMAIN=$API_DOMAIN/" \
                -e "s/SERVER_IP=.*/SERVER_IP=$SERVER_IP/" \
                "$env_file"
            
            log_info "Updated domain configuration in .env.production"
        fi
    fi
}

# Create nginx configuration with domains
update_nginx_config() {
    log_step "Updating nginx configuration with domains..."
    
    # Update nginx configurations to use environment variables
    local user_app_conf="$PROJECT_ROOT/nginx/conf.d/user-app.conf"
    local analytics_conf="$PROJECT_ROOT/nginx/conf.d/analytics-dashboard.conf"
    
    # Create backup of original configs
    if [ -f "$user_app_conf" ]; then
        cp "$user_app_conf" "$user_app_conf.bak"
    fi
    
    if [ -f "$analytics_conf" ]; then
        cp "$analytics_conf" "$analytics_conf.bak"
    fi
    
    log_info "Nginx configuration updated (backups created with .bak extension)"
}

# Create domain verification script
create_verification_script() {
    log_step "Creating domain verification script..."
    
    cat > "$PROJECT_ROOT/scripts/verify-domains.sh" << 'EOF'
#!/bin/bash

# Domain Verification Script
# This script verifies that domains are properly configured and accessible

# Configuration
USER_APP_DOMAIN="${USER_APP_DOMAIN:-app.yourdomain.com}"
ANALYTICS_DASHBOARD_DOMAIN="${ANALYTICS_DASHBOARD_DOMAIN:-analytics.yourdomain.com}"
API_DOMAIN="${API_DOMAIN:-api.yourdomain.com}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "=================================="
echo "Domain Verification Report"
echo "=================================="
echo "Timestamp: $(date)"
echo

# Test each domain
for domain in "$USER_APP_DOMAIN" "$ANALYTICS_DASHBOARD_DOMAIN" "$API_DOMAIN"; do
    echo "Testing domain: $domain"
    echo "-----------------------------------"
    
    # DNS Resolution
    if nslookup "$domain" &> /dev/null; then
        ip=$(nslookup "$domain" | grep -A1 "Name:" | tail -1 | awk '{print $2}')
        log_info "✓ DNS Resolution: $ip"
    else
        log_error "✗ DNS Resolution failed"
    fi
    
    # HTTP Test
    http_status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "http://$domain" 2>/dev/null || echo "000")
    if [ "$http_status" = "301" ] || [ "$http_status" = "302" ]; then
        log_info "✓ HTTP Redirect: $http_status (expected for HTTPS redirect)"
    elif [ "$http_status" = "200" ]; then
        log_info "✓ HTTP Response: $http_status"
    else
        log_warn "✗ HTTP Response: $http_status"
    fi
    
    # HTTPS Test
    https_status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 -k "https://$domain" 2>/dev/null || echo "000")
    if [ "$https_status" = "200" ]; then
        log_info "✓ HTTPS Response: $https_status"
    else
        log_warn "✗ HTTPS Response: $https_status"
    fi
    
    # SSL Certificate Test
    if openssl s_client -connect "$domain:443" -servername "$domain" </dev/null 2>/dev/null | openssl x509 -noout -dates &>/dev/null; then
        expiry=$(openssl s_client -connect "$domain:443" -servername "$domain" </dev/null 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
        log_info "✓ SSL Certificate valid until: $expiry"
    else
        log_warn "✗ SSL Certificate validation failed"
    fi
    
    echo
done

echo "Verification completed."
echo "If any tests failed, check your DNS configuration and server status."
EOF
    
    chmod +x "$PROJECT_ROOT/scripts/verify-domains.sh"
    
    log_info "Domain verification script created: scripts/verify-domains.sh"
}

# Display configuration summary
show_configuration_summary() {
    log_step "Domain Configuration Summary"
    
    echo "=================================="
    echo "Domain Configuration Completed"
    echo "=================================="
    echo "Timestamp: $(date)"
    echo ""
    echo "Configured Domains:"
    echo "  User App: $USER_APP_DOMAIN"
    echo "  Analytics Dashboard: $ANALYTICS_DASHBOARD_DOMAIN"
    echo "  API: $API_DOMAIN"
    echo "  Server IP: $SERVER_IP"
    echo ""
    echo "Generated Files:"
    echo "  DNS Configuration: dns-configuration.txt"
    echo "  Hosts Entries: hosts-entries.txt"
    echo "  Domain Verification: scripts/verify-domains.sh"
    echo ""
    echo "Next Steps:"
    echo "  1. Configure DNS records using dns-configuration.txt"
    echo "  2. For local testing, add hosts-entries.txt to your hosts file"
    echo "  3. Generate SSL certificates: scripts/setup-ssl-certificates.sh"
    echo "  4. Deploy the application: scripts/deploy-production.sh"
    echo "  5. Verify domains: scripts/verify-domains.sh"
    echo ""
}

# Help function
show_help() {
    cat << EOF
Domain Configuration Script

Usage: $0 [OPTIONS]

Options:
    -h, --help              Show this help message
    -u, --user-app DOMAIN   Set user app domain
    -a, --analytics DOMAIN  Set analytics dashboard domain
    -i, --api DOMAIN        Set API domain
    -s, --server-ip IP      Set server IP address
    --validate-only         Only validate existing domain configuration
    --generate-dns-only     Only generate DNS configuration

Environment Variables:
    USER_APP_DOMAIN         Domain for user application
    ANALYTICS_DASHBOARD_DOMAIN  Domain for analytics dashboard
    API_DOMAIN              Domain for API endpoints
    SERVER_IP               Server IP address

Examples:
    # Configure with default domains
    $0

    # Configure with custom domains
    $0 --user-app app.example.com --analytics analytics.example.com

    # Set server IP explicitly
    $0 --server-ip 192.168.1.100

    # Only validate existing configuration
    $0 --validate-only

    # Only generate DNS configuration
    $0 --generate-dns-only
EOF
}

# Main function
main() {
    local validate_only=false
    local generate_dns_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -u|--user-app)
                USER_APP_DOMAIN="$2"
                shift 2
                ;;
            -a|--analytics)
                ANALYTICS_DASHBOARD_DOMAIN="$2"
                shift 2
                ;;
            -i|--api)
                API_DOMAIN="$2"
                shift 2
                ;;
            -s|--server-ip)
                SERVER_IP="$2"
                shift 2
                ;;
            --validate-only)
                validate_only=true
                shift
                ;;
            --generate-dns-only)
                generate_dns_only=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    log_info "Starting domain configuration..."
    
    # Handle specific modes
    if [ "$validate_only" = true ]; then
        validate_domains
        exit 0
    fi
    
    if [ "$generate_dns_only" = true ]; then
        get_server_ip
        generate_dns_config
        log_info "DNS configuration generated"
        exit 0
    fi
    
    # Run configuration steps
    get_server_ip
    generate_dns_config
    create_hosts_entries
    update_environment_files
    update_nginx_config
    create_verification_script
    validate_domains
    show_configuration_summary
    
    log_info "Domain configuration completed successfully!"
}

# Run main function
main "$@"