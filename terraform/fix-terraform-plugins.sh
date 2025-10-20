#!/bin/bash

# Terraform Plugin Timeout Fix Script
# This script implements the recommended fixes for Terraform plugin timeout issues

set -e

echo "🔧 Fixing Terraform Plugin Timeout Issues"
echo "========================================"
echo ""

# Fix 1: Clean up existing Terraform state and cache
echo "1️⃣ Cleaning up existing Terraform state and cache..."
rm -rf .terraform .terraform.lock.hcl
echo "   ✅ Removed .terraform directory and lock file"

# Fix 2: Set plugin timeout environment variable
echo ""
echo "2️⃣ Setting plugin timeout to 2 minutes..."
export TF_PLUGIN_TIMEOUT=2m
echo "   ✅ TF_PLUGIN_TIMEOUT set to 2m"

# Fix 3: Create plugin cache directory
echo ""
echo "3️⃣ Setting up plugin cache..."
PLUGIN_CACHE_DIR="$HOME/.terraform.d/plugin-cache"
mkdir -p "$PLUGIN_CACHE_DIR"
echo "   ✅ Created plugin cache directory: $PLUGIN_CACHE_DIR"

# Fix 4: Create or update .terraformrc file
echo ""
echo "4️⃣ Configuring Terraform plugin cache..."
TERRAFORMRC_FILE="$HOME/.terraformrc"

# Create .terraformrc with plugin cache configuration
cat > "$TERRAFORMRC_FILE" << EOF
plugin_cache_dir = "$PLUGIN_CACHE_DIR"
EOF

echo "   ✅ Created/updated $TERRAFORMRC_FILE with plugin cache configuration"

# Fix 5: Re-initialize Terraform with upgrades
echo ""
echo "5️⃣ Re-initializing Terraform with provider upgrades..."
../terraform-bin/terraform init -upgrade -backend-config="environments/demo-backend.hcl"
echo "   ✅ Terraform re-initialized successfully"

# Fix 6: Verify providers
echo ""
echo "6️⃣ Verifying provider installation..."
../terraform-bin/terraform providers
echo "   ✅ Providers verified"

# Fix 7: Test with a simple validation
echo ""
echo "7️⃣ Testing configuration validation..."
../terraform-bin/terraform validate
echo "   ✅ Configuration validation successful"

echo ""
echo "🎉 All fixes applied successfully!"
echo ""
echo "💡 Next steps:"
echo "   1. Try: TF_PLUGIN_TIMEOUT=2m ../terraform-bin/terraform plan -target=module.vpc -var-file=\"environments/demo.tfvars\""
echo "   2. If successful, apply: TF_PLUGIN_TIMEOUT=2m ../terraform-bin/terraform apply -target=module.vpc -var-file=\"environments/demo.tfvars\""
echo ""
echo "🔧 Environment variables set for this session:"
echo "   TF_PLUGIN_TIMEOUT=$TF_PLUGIN_TIMEOUT"
echo ""