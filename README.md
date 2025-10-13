# User Journey Analytics Agent

An intelligent AI-powered system that provides real-time user behavior analysis, predictive analytics, and automated interventions for mobile and web applications.

## Project Structure

```
user-journey-analytics-agent/
├── frontend/                 # React.js TypeScript frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── config/          # Configuration files
│   │   ├── services/        # API services
│   │   └── utils/           # Utility functions
│   ├── public/              # Static assets
│   └── package.json         # Frontend dependencies
├── backend/                 # Spring Boot backend
│   ├── src/main/java/       # Java source code
│   │   └── com/userjourney/analytics/
│   │       ├── config/      # Configuration classes
│   │       ├── controller/  # REST controllers
│   │       ├── model/       # Data models
│   │       ├── service/     # Business logic
│   │       └── repository/  # Data access layer
│   ├── src/main/resources/  # Configuration files
│   └── pom.xml              # Maven dependencies
├── infrastructure/          # AWS CDK infrastructure
│   ├── lib/                 # CDK stack definitions
│   ├── bin/                 # CDK app entry point
│   └── package.json         # Infrastructure dependencies
└── .kiro/specs/            # Project specifications
    └── user-journey-analytics-agent/
        ├── requirements.md  # Project requirements
        ├── design.md        # System design
        └── tasks.md         # Implementation tasks
```

## Technology Stack

### Frontend
- **React.js 18** with TypeScript
- **React Router** for navigation
- **Firebase Analytics** for event tracking
- **AWS Amplify** for AWS integration
- **Recharts** for data visualization

### Backend
- **Spring Boot 3.2** with Java 17
- **Spring Security** for authentication
- **AWS SDK v2** for AWS services integration
- **Firebase Admin SDK** for Firebase integration
- **Maven** for dependency management

### Infrastructure
- **AWS CDK** for Infrastructure as Code
- **Amazon DynamoDB** for user profiles and events
- **Amazon Kinesis** for real-time event streaming
- **Amazon S3** for data storage
- **Amazon Timestream** for time-series analytics
- **Amazon Bedrock** for AI/ML capabilities
- **Amazon SageMaker** for machine learning models
- **API Gateway** for REST API management

## Getting Started

### Prerequisites
- Node.js 18+
- Java 17+
- Maven 3.8+
- AWS CLI configured
- AWS CDK CLI installed

### Installation

1. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   mvn clean install
   ```

3. **Install Infrastructure Dependencies**
   ```bash
   cd infrastructure
   npm install
   ```

### Development

1. **Start Frontend Development Server**
   ```bash
   cd frontend
   npm start
   ```

2. **Start Backend Development Server**
   ```bash
   cd backend
   mvn spring-boot:run
   ```

3. **Deploy Infrastructure (Optional)**
   ```bash
   cd infrastructure
   npm run deploy
   ```

## Features

- **Real-time User Event Tracking** via Firebase Analytics
- **AI-Powered Behavior Analysis** using Amazon Bedrock
- **Predictive Drop-off Prevention** with SageMaker ML models
- **Automated Intervention System** for user assistance
- **Video Engagement Intelligence** for content optimization
- **Natural Language Analytics** with Amazon Q
- **Comprehensive Analytics Dashboard** with real-time insights

## Architecture

The system follows a microservices architecture with:
- React frontend for user interface
- Spring Boot backend for API services
- AWS managed services for scalability and AI capabilities
- Event-driven architecture using Kinesis for real-time processing

## Contributing

Please refer to the project specifications in `.kiro/specs/` for detailed requirements and implementation guidelines.

## License

This project is part of a hackathon demonstration and is for educational purposes.# user_journey_agent
