# Autopilot Service v6

A robust, event-driven NestJS microservice for automating challenge phase transitions in the Topcoder platform. Features intelligent Kafka integration with automatic fallback capabilities, ensuring reliable operation in both development and production environments.

## 🚀 Features

### Core Capabilities
- **Event-Driven Architecture** - Dynamic job scheduling with precise timing control
- **Intelligent Kafka Integration** - Automatic detection and graceful fallback to mock mode
- **High Reliability** - Comprehensive recovery mechanisms and error handling
- **Real-time Processing** - Kafka-based message processing with Schema Registry support
- **Health Monitoring** - Extensive health check endpoints for system observability
- **Production Ready** - Structured logging, metrics, and deployment guides

### Smart Infrastructure Detection
- **Zero-Setup Development** - Works immediately without infrastructure dependencies
- **Auto-Fallback** - Seamlessly switches to mock mode when Kafka is unavailable
- **Environment Aware** - Different behaviors for development vs production
- **Fast Startup** - 3-second startup time vs traditional 30+ second failures

## 📋 Prerequisites

- **Node.js** v18 or higher
- **Docker & Docker Compose** (for full Kafka integration)
- **pnpm** (recommended package manager)

## ⚡ Quick Start

### Option 1: Instant Development (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd autopilot-v6

# Install dependencies
pnpm install

# Start immediately - auto-detects and falls back to mock mode
npm run start:dev
```

**✅ Application ready in ~3 seconds!**  
**✅ All APIs functional in mock mode**  
**✅ Perfect for development and testing**

### Option 2: Full Kafka Integration

1. **Start Infrastructure**
```bash
# Start Kafka ecosystem
sudo docker-compose up -d

# Verify services are healthy
docker-compose ps
```

2. **Start Application**
```bash
npm run start:dev
```

3. **Access Services**
- **Application**: http://localhost:3000
- **Kafka UI**: http://localhost:8080  
- **Schema Registry**: http://localhost:8081

## 🔧 Configuration

### Environment Variables

Create a `.env` file from the example:
```bash
cp .env.example .env
```

**Key Configuration Options:**
```env
# Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Kafka Configuration  
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=autopilot-service
KAFKA_ENABLED=true
KAFKA_MOCK_MODE=false

# Schema Registry
SCHEMA_REGISTRY_URL=http://localhost:8081

# Recovery Settings
RECOVERY_MAX_CONCURRENT_PHASES=10
RECOVERY_PHASE_OPERATION_TIMEOUT=30000
RECOVERY_PROCESS_OVERDUE_PHASES=true
```

### Operation Modes

| Environment | Kafka Available | Mode | Startup Time |
|-------------|-----------------|------|--------------|
| Development | ❌ No | Auto-Mock | ~3 seconds |
| Development | ✅ Yes | Full Integration | ~5 seconds |
| Production | ❌ No | Fails Fast | N/A |
| Production | ✅ Yes | Full Integration | ~5 seconds |

## 🛠 API Reference

### Health Check Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Overall system health |
| `GET /health/detailed` | Comprehensive status with operation mode |
| `GET /health/kafka` | Kafka connectivity and mode status |
| `GET /health/scheduler` | Scheduler service health |
| `GET /health/recovery` | Recovery service health |
| `GET /health/app` | Basic application health |

### Kafka Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/kafka/phase-transition` | POST | Trigger phase transition events |
| `/kafka/challenge-update` | POST | Send challenge update events |
| `/kafka/command` | POST | Send autopilot commands |

### Expected Behavior

**Root Endpoint (`GET /`):**
```json
{
  "timestamp": "2025-06-19T02:38:54.702Z",
  "statusCode": 404,
  "message": "Cannot GET /",
  "data": {}
}
```
*This is normal and expected - proves the application is running correctly.*

## 📨 Kafka Topics & Messages

### Topic Overview
- `autopilot.command` - System commands
- `autopilot.phase.transition` - Phase transition events  
- `autopilot.challenge.update` - Challenge update events
- `autopilot.message` - General messaging

### Message Examples

**Phase Transition Event:**
```json
{
  "projectId": 123456,
  "phaseId": 789012,
  "phaseTypeName": "Development",
  "state": "START",
  "operator": "system.autopilot",
  "projectStatus": "IN_PROGRESS",
  "date": "2025-06-19T10:00:00.000Z"
}
```

**Challenge Update Event:**
```json
{
  "projectId": 123456,
  "challengeId": 789012,
  "status": "ACTIVE",
  "operator": "john.doe",
  "date": "2025-06-19T10:00:00.000Z"
}
```

## 🏗 Architecture

### Project Structure
```
src/
├── app.module.ts              # Root application module
├── main.ts                    # Application entry point & bootstrap
├── config/                    # Configuration management
│   ├── configuration.ts       # Main config with validation
│   ├── sections/             # Feature-specific configs
│   └── validation.ts         # Environment validation
├── kafka/                    # Kafka ecosystem
│   ├── kafka.service.ts      # Core service with smart detection
│   ├── consumers/           # Message consumers
│   ├── producers/           # Message producers
│   └── templates/           # Message templates
├── scheduler/               # Event-driven scheduling
│   ├── services/           # Dynamic job management
│   └── interfaces/         # Scheduling contracts
├── recovery/               # Startup recovery system
│   └── services/           # Recovery mechanisms
├── autopilot/              # Core business logic
│   ├── services/           # Autopilot operations
│   └── handlers/           # Event handlers
├── health/                 # Health monitoring
└── common/                 # Shared utilities
    ├── services/           # Common services
    ├── utils/              # Utilities & helpers
    └── types/              # TypeScript definitions
```

### Key Services

**SchedulerService** - Dynamic job scheduling with precise timing
- Schedule phase transitions
- Handle schedule adjustments  
- Manage job lifecycle
- Cleanup and recovery

**RecoveryService** - Startup resilience and recovery
- Scan for active phases on startup
- Schedule upcoming transitions
- Process overdue phases
- Handle edge cases

**KafkaService** - Intelligent messaging with auto-fallback
- Smart infrastructure detection
- Automatic mock mode activation
- Schema Registry integration
- Producer/Consumer management

## 🧪 Development

### Scripts
```bash
# Development
npm run start:dev          # Start with hot reload
npm run start:debug        # Start with debugging

# Production
npm run build              # Build for production
npm run start:prod         # Start production build

# Testing
npm run test               # Unit tests
npm run test:e2e           # End-to-end tests
npm run test:cov           # Test coverage

# Linting
npm run lint               # ESLint check
npm run lint:fix           # Auto-fix issues
```

### Testing Strategy
- **Unit Tests** - Individual service testing
- **Integration Tests** - Service interaction testing  
- **E2E Tests** - Complete workflow testing
- **Health Checks** - System verification

## 🚀 Deployment

### Docker Deployment
```bash
# Build application image
docker build -t autopilot-service .

# Production deployment with infrastructure
docker-compose -f docker-compose.prod.yml up -d
```

### Environment-Specific Configuration

**Development:**
- Mock mode fallback enabled
- Enhanced logging
- Development-friendly timeouts

**Production:** 
- Requires real Kafka infrastructure
- Fails fast without dependencies
- Production-optimized settings
- Enhanced monitoring

### Monitoring & Observability

**Health Endpoints:**
- Continuous health monitoring
- Service dependency tracking
- Operation mode visibility

**Logging:**
- Structured Winston logging
- Request/response tracking
- Error correlation
- Performance metrics

**Metrics** (Available via logs):
- Startup time tracking
- Job execution metrics
- Message processing rates
- Error rates and patterns

## 🔍 Troubleshooting

### Common Issues

**Port 3000 Already in Use:**
```bash
# Find and kill the process
lsof -i :3000
kill -9 <PID>

# Or use different port
PORT=3001 npm run start:dev
```

**Kafka Connection Issues:**
- ✅ **Development**: Auto-fallback to mock mode (expected)
- ❌ **Production**: Check Docker services with `docker-compose ps`

**Docker Permission Issues:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Logout and login again
```

### Startup Messages

**✅ Successful Kafka Connection:**
```
[KafkaService] Kafka broker connectivity test successful
[Consumer] Starting
[ConsumerGroup] Consumer has joined the group
```

**✅ Mock Mode Fallback (Development):**
```
[KafkaService] Kafka broker connectivity test failed
[KafkaService] Kafka infrastructure not available, falling back to mock mode
[KafkaService] Mock mode enabled - Kafka operations will be simulated
```

## 📖 Additional Documentation

Comprehensive guides available in the `docs/` directory:
- `deployment-guide.md` - Detailed deployment instructions
- `scheduling-approach.md` - Event-driven architecture details
- `recovery-mechanisms.md` - Recovery system documentation
- `examples/` - Scenario-based examples and use cases

## 🎯 Status

**✅ PRODUCTION READY**
- Kafka integration: Complete with intelligent fallback
- Event scheduling: Fully implemented with recovery
- Health monitoring: Comprehensive endpoint coverage
- Documentation: Complete with examples
- Testing: Unit, integration, and E2E test suites

## 🤝 Contributing

1. Follow the established code structure
2. Add comprehensive tests for new features
3. Update documentation for any API changes
4. Ensure all health checks pass
5. Test both Kafka and mock modes

## 📝 License

[Add your license information here]

---

**Ready for immediate development and production deployment** 🚀
