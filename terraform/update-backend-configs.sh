#!/bin/bash

# Script to update Terraform backend configuration files after renaming resources
# This updates all backend .hcl files to use the new simplified naming convention

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# Function to update backend configuration file
update_backend_config() {
    local file_path=$1
    local environment=$2
    
    if [ ! -f "$file_path" ]; then
        warn "Backend config file not found: $file_path"
        return
    fi
    
    log "Updating backend config: $file_path"
    
    # Create backup
    cp "$file_path" "${file_path}.backup"
    
    # Update the configuration based on environment
    case $environment in
        "prod")
            # Update prod to use simplified names
            sed -i.tmp 's/bucket.*=.*"user-journey-analytics-terraform-state-prod"/bucket         = "user-journey-analytics-terraform-state"/' "$file_path"
            sed -i.tmp 's/dynamodb_table.*=.*"user-journey-analytics-terraform-locks-prod"/dynamodb_table = "user-journey-analytics-terraform-locks"/' "$file_path"
            ;;
        "dev")
            # Mark dev config as deprecated or remove it
            echo "# DEPRECATED: Dev environment has been removed" > "${file_path}.deprecated"
            cat "$file_path" >> "${file_path}.deprecated"
            warn "Dev backend config marked as deprecated: ${file_path}.deprecated"
            ;;
        *)
            log "No changes needed for $environment environment"
            ;;
    esac
    
    # Remove temporary files
    rm -f "${file_path}.tmp"
    
    log "Updated: $file_path"
}

# Function to update scripts that reference the old names
update_scripts() {
    local script_files=(
        "terraform/setup-backend.sh"
        "terraform/setup-production-backend.sh"
        "terraform/scripts/manage-state.sh"
        "terraform/deploy-production.sh"
        "terraform/deploy-production-existing.sh"
        "terraform/deploy-production-with-ai.sh"
    )
    
    for script_file in "${script_files[@]}"; do
        if [ -f "$script_file" ]; then
            log "Updating script: $script_file"
            
            # Create backup
            cp "$script_file" "${script_file}.backup"
            
            # Update references to use simplified names for production
            sed -i.tmp 's/user-journey-analytics-terraform-state-prod/user-journey-analytics-terraform-state/g' "$script_file"
            sed -i.tmp 's/user-journey-analytics-terraform-locks-prod/user-journey-analytics-terraform-locks/g' "$script_file"
            
            # Remove temporary files
            rm -f "${script_file}.tmp"
            
            log "Updated script: $script_file"
        else
            warn "Script file not found: $script_file"
        fi
    done
}

# Function to update README and documentation
update_documentation() {
    local doc_files=(
        "terraform/README.md"
        "terraform/scripts/README.md"
    )
    
    for doc_file in "${doc_files[@]}"; do
        if [ -f "$doc_file" ]; then
            log "Updating documentation: $doc_file"
            
            # Create backup
            cp "$doc_file" "${doc_file}.backup"
            
            # Update references
            sed -i.tmp 's/user-journey-analytics-terraform-state-prod/user-journey-analytics-terraform-state/g' "$doc_file"
            sed -i.tmp 's/user-journey-analytics-terraform-locks-prod/user-journey-analytics-terraform-locks/g' "$doc_file"
            
            # Add note about dev environment removal
            if grep -q "user-journey-analytics-terraform-state-dev" "$doc_file"; then
                sed -i.tmp 's/user-journey-analytics-terraform-state-dev/# REMOVED: user-journey-analytics-terraform-state-dev/g' "$doc_file"
                sed -i.tmp 's/user-journey-analytics-terraform-locks-dev/# REMOVED: user-journey-analytics-terraform-locks-dev/g' "$doc_file"
            fi
            
            # Remove temporary files
            rm -f "${doc_file}.tmp"
            
            log "Updated documentation: $doc_file"
        else
            warn "Documentation file not found: $doc_file"
        fi
    done
}

# Main execution
main() {
    log "Starting backend configuration updates..."
    
    # Update backend configuration files
    log "Updating backend configuration files..."
    
    # Production backend config
    update_backend_config "terraform/environments/prod-backend.hcl" "prod"
    
    # Development backend config (mark as deprecated)
    update_backend_config "terraform/environments/dev-backend.hcl" "dev"
    update_backend_config "terraform/backend-dev.hcl" "dev"
    
    # Other environment configs (no changes needed, but check they exist)
    if [ -f "terraform/environments/staging-backend.hcl" ]; then
        log "Staging backend config exists and doesn't need changes"
    fi
    
    if [ -f "terraform/environments/demo-backend.hcl" ]; then
        log "Demo backend config exists and doesn't need changes"
    fi
    
    # Update scripts
    log "Updating scripts..."
    update_scripts
    
    # Update documentation
    log "Updating documentation..."
    update_documentation
    
    log "✅ All backend configurations updated successfully!"
    echo
    log "Summary of changes:"
    echo "  • Production backend now uses simplified names:"
    echo "    - S3 bucket: user-journey-analytics-terraform-state"
    echo "    - DynamoDB table: user-journey-analytics-terraform-locks"
    echo "  • Development backend configs marked as deprecated"
    echo "  • Scripts updated to use new naming convention"
    echo "  • Documentation updated"
    echo
    log "Next steps:"
    echo "  1. Review the updated configuration files"
    echo "  2. Run 'terraform init -reconfigure' in your production environment"
    echo "  3. Test Terraform operations to ensure everything works"
    echo "  4. Remove .backup files once you're satisfied with the changes"
    echo
    warn "Backup files have been created with .backup extension"
}

# Run main function
main "$@"