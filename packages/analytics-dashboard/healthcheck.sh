#!/bin/sh

# Health check script for analytics dashboard
# Checks if nginx is running and serving content

# Check if nginx process is running
if ! pgrep nginx > /dev/null; then
    echo "ERROR: nginx process not found"
    exit 1
fi

# Check if the health endpoint responds
if ! wget --quiet --tries=1 --spider http://localhost/health; then
    echo "ERROR: Health endpoint not responding"
    exit 1
fi

# Check if metrics endpoint responds
if ! wget --quiet --tries=1 --spider http://localhost/metrics; then
    echo "ERROR: Metrics endpoint not responding"
    exit 1
fi

# Check if main application is accessible
if ! wget --quiet --tries=1 --spider http://localhost/; then
    echo "ERROR: Main application not responding"
    exit 1
fi

echo "Analytics dashboard is healthy"
exit 0