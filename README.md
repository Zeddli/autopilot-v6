# Autopilot Service

autopilot operations with Kafka integration.

## Features

- Kafka message production and consumption
- Schema Registry integration for Avro message serialization
- Health check endpoints for Kafka and application monitoring
- Structured logging with Winston
- Environment-based configuration
- Graceful shutdown handling
- Error handling and validation

## Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose

## Installation

### 1. Prerequisites

- Node.js v20 or higher
- Docker and Docker Compose

### 2. Environment Setup

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Configure the following environment variables:

```env
# App Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
LOG_DIR=logs

# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=autopilot-service
KAFKA_MAX_RETRY_TIME=30000
KAFKA_INITIAL_RETRY_TIME=300
KAFKA_RETRIES=5

# Schema Registry Configuration
SCHEMA_REGISTRY_URL=http://localhost:8081
```

### 3. Install Dependencies

```bash
# Using pnpm
pnpm install
```

### 4. Development Setup

1. Start Kafka infrastructure using Docker Compose:
```bash
docker compose up -d
```

This will start:
- Zookeeper (port 2181)
- Kafka (ports 9092, 29092)
- Schema Registry (port 8081)
- Kafka UI (port 8080)

2. Verify Docker containers are healthy:
```bash
# Check container status
docker compose ps

# Check container logs for any errors
docker compose logs

# Verify Kafka UI is accessible
http://localhost:8080
```

3. Start the application locally:
```bash
# Using the start script
./start-local.sh

# Or manually with environment variables
npm run start:dev
```

### 5. Verify Installation

1. Check if the application is running:
```bash
curl http://localhost:3000/health
```

2. Access Kafka UI:
- Open http://localhost:8080 in your browser
- Verify Kafka cluster connection
- Check Schema Registry status

3. Access Schema Registry:
- Open http://localhost:8081 in your browser
- Verify schemas are registered

# Test coverage

## Scripts

```bash
# Lint
$ npm run lint

```

## API Endpoints

### Health Checks

- `GET /health` - Overall health check including Kafka
- `GET /health/kafka` - Kafka-specific health check
- `GET /health/app` - Application health check

## Kafka Topics

The service interacts with the following Kafka topics:

1. `autopilot.command`
   - Used for sending commands to the autopilot service
   - Example payload:
   ```json
   {
     "command": "START_PHASE",
     "operator": "john.doe",
     "projectId": 123,
     "date": "2024-03-20T10:00:00Z"
   }
   ```

2. `autopilot.phase.transition`
   - Used for phase transition events
   - Example payload:
   ```json
   {
     "projectId": 123,
     "phaseId": 456,
     "phaseTypeName": "Development",
     "state": "START",
     "operator": "john.doe",
     "projectStatus": "IN_PROGRESS",
     "date": "2024-03-20T10:00:00Z"
   }
   ```

3. `autopilot.challenge.update`
   - Used for challenge update events
   - Example payload:
   ```json
   {
     "projectId": 123,
     "challengeId": 789,
     "status": "ACTIVE",
     "operator": "john.doe",
     "date": "2024-03-20T10:00:00Z"
   }
   ```

## Project Structure

```
src/
├── app.module.ts              # Root application module
├── main.ts                    # Application entry point
├── config/                    # Configuration files
│   ├── configuration.ts       # Main configuration
│   ├── validation.ts         # Environment validation
│   └── sections/             # Configuration sections
├── kafka/                    # Kafka related code
│   ├── kafka.module.ts       # Kafka module
│   ├── kafka.service.ts      # Kafka service
│   ├── consumers/           # Kafka consumers
│   └── producers/           # Kafka producers
├── common/                   # Common utilities
│   ├── constants/           # Constants
│   ├── exceptions/          # Custom exceptions
│   ├── filters/             # Exception filters
│   ├── interceptors/        # Interceptors
│   ├── interfaces/          # TypeScript interfaces
│   ├── services/            # Common services
│   └── utils/               # Utility functions
└── autopilot/               # Autopilot specific code
    ├── autopilot.module.ts  # Autopilot module
    ├── services/           # Autopilot services
    └── interfaces/         # Autopilot interfaces

test/                        # Test files
├── jest-e2e.json           # Jest E2E configuration
└── app.e2e-spec.ts         # E2E test specifications

.env                         # Environment variables
.env.example                 # Example env template
package.json                 # Dependencies and scripts
tsconfig.json               # TypeScript config
README.md                   # Documentation
```
