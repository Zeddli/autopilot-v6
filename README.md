# Autopilot Service

autopilot operations with Kafka integration.

## Features

- **Intelligent Kafka Integration** with automatic fallback to mock mode
- **Enhanced Connection Detection** for development environments
- **Schema Registry Integration** for Avro message serialization
- **Graceful Infrastructure Handling** - works with or without Kafka
- **Health Check Endpoints** for comprehensive system monitoring
- **Structured Logging** with Winston
- **Environment-Based Configuration** with smart defaults
- **Graceful Shutdown Handling** and error recovery
- **Robust Error Handling** and validation

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

The application features **intelligent infrastructure detection** and will work in multiple modes:

#### Option A: Full Kafka Development (Recommended)

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

3. Start the application:
```bash
# Using the start script
./start-local.sh

# Or manually
npm run start:dev
```

#### Option B: Quick Start (No Infrastructure Required)

**The application will automatically detect missing infrastructure and enable mock mode:**

```bash
# Simply start the application - it auto-detects and falls back to mock mode
npm run start:dev
```

**Expected behavior:**
- ✅ Application starts successfully in ~2-3 seconds
- ✅ Kafka operations are simulated (mock mode)
- ✅ All APIs remain functional
- ✅ Perfect for quick development and testing

#### Option C: Explicit Mock Mode

```bash
# Force mock mode explicitly
KAFKA_MOCK_MODE=true npm run start:dev

# Or disable Kafka entirely
KAFKA_ENABLED=false npm run start:dev
```

### 5. Verify Installation

1. **Check Application Status**:
```bash
# Basic health check
curl http://localhost:3000/health

# Detailed system status (shows Kafka mode)
curl http://localhost:3000/health/detailed

# Kafka-specific status
curl http://localhost:3000/health/kafka
```

2. **Browser Verification**:
```bash
# Open in browser - should show structured 404 (proves app is running)
http://localhost:3000

# Health check endpoint
http://localhost:3000/health
```

3. **Infrastructure Verification** (if using full Kafka setup):
- **Kafka UI**: http://localhost:8080 - Monitor topics and consumers
- **Schema Registry**: http://localhost:8081 - View registered schemas

4. **Expected Behaviors**:
   - ✅ **With Kafka**: Real message publishing, consumer processing
   - ✅ **Without Kafka**: Mock mode enabled, simulated operations
   - ✅ **Both modes**: All health endpoints functional, API responses normal

## Intelligent Infrastructure Detection

The application features enhanced connection detection that automatically handles infrastructure availability:

### How It Works

1. **Fast Detection**: Uses lightweight TCP socket tests (500ms timeout)
2. **Graceful Fallback**: Automatically enables mock mode when infrastructure is unavailable
3. **Zero Configuration**: Works out-of-the-box without manual mock mode setup
4. **Environment Aware**: Behaves differently in development vs production

### Operating Modes

| Environment | Kafka Available | Behavior |
|-------------|----------------|----------|
| Development | ✅ Yes | Full Kafka integration |
| Development | ❌ No | **Auto-fallback to mock mode** |
| Test | N/A | Always mock mode |
| Production | ✅ Yes | Full Kafka integration |
| Production | ❌ No | **Fails fast** (intended behavior) |

### Startup Messages

**With Kafka Infrastructure:**
```
[KafkaService] Kafka broker connectivity test successful
[KafkaService] Kafka service initialized successfully with real connections
[MessageConsumer] Message consumer initialized successfully
```

**Without Kafka Infrastructure (Auto-Mock Mode):**
```
[KafkaService] Kafka broker connectivity test failed
[KafkaService] Kafka infrastructure not available, falling back to mock mode
[KafkaService] Mock mode enabled - Kafka operations will be simulated
[MessageConsumer] KafkaService is in mock mode - message consumer will not start
```

### Configuration Options

```bash
# Force mock mode (overrides detection)
KAFKA_MOCK_MODE=true

# Disable Kafka entirely
KAFKA_ENABLED=false

# Production mode (requires real Kafka)
NODE_ENV=production
```

# Test coverage

## Scripts

```bash
# Lint
$ npm run lint

```

## API Endpoints

### Health Checks

- `GET /health` - Overall health check including Kafka status
- `GET /health/detailed` - Comprehensive system status with all services
- `GET /health/kafka` - Kafka-specific health check (shows mock/real mode)
- `GET /health/scheduler` - Scheduler service health
- `GET /health/recovery` - Recovery service health  
- `GET /health/app` - Basic application health check

### Kafka Operations

- `POST /kafka/phase-transition` - Send phase transition events
- `POST /kafka/challenge-update` - Send challenge update events
- `POST /kafka/command` - Send autopilot commands

### Expected API Behavior

**Root Endpoint (`GET /`):**
```json
{
  "timestamp": "2025-06-18T02:47:20.749Z",
  "statusCode": 404,
  "message": "Cannot GET /",
  "data": {}
}
```
This is **normal and expected** - it proves the application is running correctly and handling requests.

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
