# User Journey Analytics Agent Documentation

This directory contains comprehensive documentation for the User Journey Analytics Agent project.

## Contents

- [Architecture](architecture/) - System architecture diagrams and documentation
- [API Documentation](api/) - REST API and service interfaces
- [Deployment](deployment/) - Infrastructure and deployment guides
- [User Guide](user-guide/) - End-user documentation and tutorials

## Quick Start

1. [System Architecture Overview](architecture/system-architecture.md)
2. [Dashboard Separation Architecture](architecture/dashboard-separation-architecture.md)
3. [Infrastructure Setup](deployment/infrastructure-setup.md)
4. [API Reference](api/api-reference.md)

## Project Overview

The User Journey Analytics Agent is an AI-powered system that analyzes user behavior patterns, detects struggle signals, and provides intelligent interventions to improve user experience and prevent drop-offs in mobile applications.

### Key Features

- Real-time user behavior analysis
- AI-powered struggle signal detection
- Video engagement intelligence
- Predictive analytics for user exit risk
- Automated intervention system
- Comprehensive analytics dashboard

### Technology Stack

- **Frontend**: 
  - User Application (Port 3000): React.js with TypeScript
  - Analytics Dashboard (Port 3001): React.js with TypeScript
  - Shared Library: Common components and services
- **Backend**: Spring Boot (Java) on Port 8080
- **Infrastructure**: AWS (Terraform)
- **AI/ML**: Amazon Bedrock, SageMaker, Nova
- **Data Storage**: DynamoDB, Timestream, S3
- **Streaming**: Kinesis Data Streams
- **Monitoring**: CloudWatch, X-Ray