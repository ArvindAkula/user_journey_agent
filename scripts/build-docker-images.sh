#!/bin/bash

# Production Docker image build and push script
# This script builds optimized Docker images for production deployment

set -e

# Configuration
REGISTRY_URL="${DOCKER_REGISTRY_URL:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
BUILD_NUMBER="${BUILD_NUMBER:-$(date +%Y%m%d-%H%M%S)}"
PUSH_TO_REGISTRY="${PUSH_TO_REGISTRY:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Validate environment
validate_environment() {
    log_info "Validating build environment..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if [ "$PUSH_TO_REGISTRY" = "true" ] && [ -z "$REGISTRY_URL" ]; then
        log_error "DOCKER_REGISTRY_URL must be set when PUSH_TO_REGISTRY=true"
        exit 1
    fi
    
    log_info "Environment validation passed"
}

# Build function for each service
build_image() {
    local service_name=$1
    local dockerfile_path=$2
    local context_path=$3
    local image_name="${service_name}:${IMAGE_TAG}"
    local tagged_image_name="${service_name}:${BUILD_NUMBER}"
    
    log_info "Building ${service_name} image..."
    
    # Build the image
    docker build \
        --file "${dockerfile_path}" \
        --tag "${image_name}" \
        --tag "${tagged_image_name}" \
        --build-arg BUILD_NUMBER="${BUILD_NUMBER}" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        "${context_path}"
    
    if [ $? -eq 0 ]; then
        log_info "Successfully built ${service_name} image"
        
        # Tag for registry if needed
        if [ "$PUSH_TO_REGISTRY" = "true" ]; then
            local registry_image="${REGISTRY_URL}/${image_name}"
            local registry_tagged_image="${REGISTRY_URL}/${tagged_image_name}"
            
            docker tag "${image_name}" "${registry_image}"
            docker tag "${tagged_image_name}" "${registry_tagged_image}"
            
            log_info "Tagged ${service_name} for registry: ${registry_image}"
        fi
    else
        log_error "Failed to build ${service_name} image"
        exit 1
    fi
}

# Push function
push_image() {
    local service_name=$1
    local image_name="${service_name}:${IMAGE_TAG}"
    local tagged_image_name="${service_name}:${BUILD_NUMBER}"
    
    if [ "$PUSH_TO_REGISTRY" = "true" ]; then
        log_info "Pushing ${service_name} to registry..."
        
        local registry_image="${REGISTRY_URL}/${image_name}"
        local registry_tagged_image="${REGISTRY_URL}/${tagged_image_name}"
        
        docker push "${registry_image}"
        docker push "${registry_tagged_image}"
        
        if [ $? -eq 0 ]; then
            log_info "Successfully pushed ${service_name} to registry"
        else
            log_error "Failed to push ${service_name} to registry"
            exit 1
        fi
    fi
}

# Clean up function
cleanup_images() {
    log_info "Cleaning up intermediate images..."
    docker image prune -f
}

# Main build process
main() {
    log_info "Starting production Docker image build process..."
    log_info "Build number: ${BUILD_NUMBER}"
    log_info "Image tag: ${IMAGE_TAG}"
    
    validate_environment
    
    # Build backend image
    build_image "user-journey-backend" "backend/Dockerfile" "backend"
    
    # Build user app image
    build_image "user-journey-user-app" "packages/user-app/Dockerfile" "."
    
    # Build analytics dashboard image
    build_image "user-journey-analytics-dashboard" "packages/analytics-dashboard/Dockerfile" "."
    
    # Push images if configured
    if [ "$PUSH_TO_REGISTRY" = "true" ]; then
        log_info "Pushing images to registry..."
        push_image "user-journey-backend"
        push_image "user-journey-user-app"
        push_image "user-journey-analytics-dashboard"
    fi
    
    # Clean up
    cleanup_images
    
    log_info "Docker image build process completed successfully!"
    
    # Display built images
    log_info "Built images:"
    docker images | grep -E "(user-journey-backend|user-journey-user-app|user-journey-analytics-dashboard)" | head -10
}

# Help function
show_help() {
    cat << EOF
Production Docker Image Build Script

Usage: $0 [OPTIONS]

Options:
    -h, --help              Show this help message
    -t, --tag TAG          Set image tag (default: latest)
    -r, --registry URL     Set Docker registry URL
    -p, --push             Push images to registry
    -b, --build-number NUM Set build number (default: timestamp)

Environment Variables:
    DOCKER_REGISTRY_URL    Docker registry URL
    IMAGE_TAG              Image tag to use
    BUILD_NUMBER           Build number for tagging
    PUSH_TO_REGISTRY       Set to 'true' to push to registry

Examples:
    # Build images locally
    $0

    # Build and push to registry
    $0 --registry my-registry.com --push

    # Build with custom tag
    $0 --tag v1.2.3

    # Build with environment variables
    DOCKER_REGISTRY_URL=my-registry.com PUSH_TO_REGISTRY=true $0
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -r|--registry)
            REGISTRY_URL="$2"
            shift 2
            ;;
        -p|--push)
            PUSH_TO_REGISTRY="true"
            shift
            ;;
        -b|--build-number)
            BUILD_NUMBER="$2"
            shift 2
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main