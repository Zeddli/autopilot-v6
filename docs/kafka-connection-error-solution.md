# Kafka Connection Error Solution Guide

## Overview

This document provides comprehensive solutions for Kafka connection errors in the Autopilot-v6 service. The application has been enhanced with intelligent connection detection and graceful fallback to mock mode when Kafka infrastructure is unavailable.

## Enhanced Error Handling Features ✨ **RESOLVED**

### 1. **Intelligent Connection Detection** ✅
- **Fast TCP socket tests** (500ms timeout) before Kafka client creation
- **Zero KafkaJS connection errors** during infrastructure detection
- **Immediate mock mode activation** when infrastructure unavailable
- **Race condition fixes** between KafkaService and MessageConsumer initialization

### 2. **Environment-Aware Operation Modes** ✅
- **Production Mode**: Requires real Kafka connections (fails if unavailable)
- **Development Mode**: **Auto-detects and falls back to mock mode**
- **Test Mode**: Always uses mock mode

### 3. **Dynamic Mock Mode Activation** ✅
- **Automatic mock mode** when infrastructure is unavailable
- **Constructor-level mock detection** for immediate availability
- **Synchronized service initialization** to prevent race conditions
- **Clear operation mode logging** throughout the application

### 4. **Enhanced Startup Reliability** ✅ **NEW**
- **Graceful MessageConsumer handling** with retry logic
- **Development mode error tolerance** (continues without Kafka)
- **Proper service lifecycle management** preventing startup failures
- **Structured error responses** proving application health

## Common Error Scenarios and Solutions

### Error 1: Connection Refused (ECONNREFUSED)
```
Error: connect ECONNREFUSED 127.0.0.1:9092
Error: connect ECONNREFUSED 127.0.0.1:8081
```

**Root Cause**: Kafka broker (port 9092) and Schema Registry (port 8081) are not running.

**Solution Options**:

#### Option A: Start Kafka Infrastructure (Recommended for Development)
```bash
# Start all Kafka services using docker-compose
docker-compose up -d

# Verify services are running
docker-compose ps

# Check service health
docker-compose logs kafka
docker-compose logs schema-registry
```

#### Option B: Use Mock Mode (Fastest for Development/Testing)
```bash
# Set environment variables to enable mock mode
export KAFKA_ENABLED=false
export KAFKA_MOCK_MODE=true

# Or run with inline environment variables
KAFKA_ENABLED=false KAFKA_MOCK_MODE=true npm run start:dev
```

#### Option C: Let Application Auto-Detect ✅ **RECOMMENDED** 
```bash
# Simply start the application - it will auto-detect and fall back
npm run start:dev
```

**What happens:**
1. **Fast detection** (500ms) → No infrastructure found
2. **Automatic fallback** → Mock mode enabled 
3. **Clean startup** → No connection errors in logs
4. **Full functionality** → All APIs work normally
5. **Success indicator** → Browser shows structured 404 response

### Error 2: Schema Registry Connection Issues
```
Failed to register schema for topic autopilot.phase.transition
```

**Root Cause**: Schema Registry service is not available.

**Solutions**:
1. **Start Schema Registry**: `docker-compose up -d schema-registry`
2. **Disable Schema Registry**: Set `SCHEMA_REGISTRY_ENABLED=false`
3. **Use Mock Mode**: The application will automatically handle this

### Error 3: Application Startup Failure
```
Failed to start application: KafkaConnectionException
```

**Root Cause**: Application cannot initialize due to Kafka connection failures.

**Solution**: The enhanced service now handles this gracefully:
- **Development**: Automatically falls back to mock mode
- **Production**: Still fails fast (as intended for production safety)
- **Test**: Always uses mock mode

## Configuration Options

### Environment Variables

```bash
# Kafka Broker Configuration
KAFKA_BROKERS=localhost:9092                    # Comma-separated broker list
KAFKA_CLIENT_ID=autopilot-service              # Client identifier

# Connection Control
KAFKA_ENABLED=true                             # Enable/disable Kafka (default: true)
KAFKA_MOCK_MODE=false                          # Force mock mode (default: false)

# Schema Registry Configuration
SCHEMA_REGISTRY_URL=http://localhost:8081      # Schema Registry URL
SCHEMA_REGISTRY_ENABLED=true                   # Enable/disable Schema Registry

# Connection Retry Settings
KAFKA_MAX_RETRY_TIME=30000                     # Maximum retry time (ms)
KAFKA_INITIAL_RETRY_TIME=300                   # Initial retry delay (ms)
KAFKA_RETRIES=5                                # Number of retry attempts

# Environment Detection
NODE_ENV=development                           # Environment mode
```

### Configuration Examples

#### Development with Real Kafka
```bash
export NODE_ENV=development
export KAFKA_ENABLED=true
export KAFKA_BROKERS=localhost:9092
export SCHEMA_REGISTRY_URL=http://localhost:8081
```

#### Development with Mock Mode
```bash
export NODE_ENV=development
export KAFKA_ENABLED=false
export KAFKA_MOCK_MODE=true
```

#### Production Configuration
```bash
export NODE_ENV=production
export KAFKA_ENABLED=true
export KAFKA_BROKERS=kafka1:9092,kafka2:9092,kafka3:9092
export SCHEMA_REGISTRY_URL=http://schema-registry:8081
```

## Infrastructure Setup

### Docker Compose Setup (Recommended)

The project includes a complete `docker-compose.yml` with:
- **Zookeeper**: Kafka coordination service
- **Kafka Broker**: Message broker (ports 9092, 29092)
- **Schema Registry**: Schema management (port 8081)
- **Kafka UI**: Web interface for monitoring (port 8080)

```bash
# Start all services
docker-compose up -d

# Start specific services
docker-compose up -d zookeeper kafka schema-registry

# View logs
docker-compose logs -f kafka

# Stop services
docker-compose down
```

### Manual Kafka Setup

If using external Kafka:
1. Ensure Kafka broker is accessible on the configured port
2. Ensure Schema Registry is accessible (if enabled)
3. Configure firewall rules for the required ports
4. Update `KAFKA_BROKERS` and `SCHEMA_REGISTRY_URL` accordingly

## Troubleshooting Guide

### Step 1: Check Service Status
```bash
# Check if ports are open
netstat -tulpn | grep -E "(9092|8081)"

# Test connectivity
telnet localhost 9092
telnet localhost 8081

# Check Docker services
docker-compose ps
```

### Step 2: Verify Configuration
```bash
# Check environment variables
env | grep -E "(KAFKA|SCHEMA)"

# Test configuration loading
npm run start:dev 2>&1 | grep -i kafka
```

### Step 3: Use Mock Mode for Development
```bash
# Quick start without infrastructure
KAFKA_MOCK_MODE=true npm run start:dev
```

## Success Indicators ✅

### How to Verify the Application is Working

1. **Browser Test** (Most Important):
   ```
   Navigate to: http://localhost:3000
   Expected: {"statusCode": 404, "message": "Cannot GET /"}
   ```
   ✅ **This 404 response proves the application started successfully!**

2. **Health Check Test**:
   ```bash
   curl http://localhost:3000/health
   # Should return JSON with service status
   ```

3. **Log Messages to Look For**:
   ```
   ✅ GOOD (Auto-Mock Mode):
   [KafkaService] Kafka infrastructure not available, falling back to mock mode
   [MessageConsumer] KafkaService is in mock mode - message consumer will not start
   [Bootstrap] Nest application successfully started

   ✅ GOOD (Real Kafka):
   [KafkaService] Kafka service initialized successfully with real connections
   [MessageConsumer] Message consumer initialized successfully
   ```

4. **Bad Log Messages** (Fixed):
   ```
   ❌ OLD ERRORS (Now Resolved):
   Failed to start application: KafkaConsumerException
   Error: connect ECONNREFUSED 127.0.0.1:9092
   ```

## Quick Development Workflow ⚡

```bash
# Fastest way to start developing (no setup required):
git clone <repo>
npm install
npm run start:dev

# Application auto-detects missing Kafka and enables mock mode
# Ready to develop in ~3 seconds!
```

### Step 4: Check Application Logs

The enhanced service provides detailed logging:

```typescript
// Success with real connections
"Kafka service initialized successfully with real connections"

// Fallback to mock mode
"Kafka infrastructure not available, falling back to mock mode"
"Suggestion: Start Kafka infrastructure with: docker-compose up -d"

// Mock mode operation
"[KAFKA-PRODUCER-MOCK] Message would be sent to autopilot.phase.transition"
```

## Development Workflow

### Option 1: Full Infrastructure Development
```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Wait for services to be ready
sleep 30

# 3. Start application
npm run start:dev
```

### Option 2: Mock Mode Development
```bash
# 1. Start in mock mode (no infrastructure needed)
KAFKA_MOCK_MODE=true npm run start:dev

# 2. All Kafka operations will be logged instead of executed
```

### Option 3: Auto-Detection Development (New)
```bash
# 1. Just start the application
npm run start:dev

# 2. Application will:
#    - Try to connect to Kafka
#    - Fall back to mock mode if unavailable
#    - Log the mode being used
```

## Testing Scenarios

### Unit Tests
```bash
# Always run in mock mode
npm run test:unit
```

### Integration Tests
```bash
# Use mock mode for integration tests
npm run test:integration

# Or with real infrastructure (if available)
KAFKA_ENABLED=true npm run test:integration
```

### End-to-End Tests
```bash
# Start infrastructure first
docker-compose up -d

# Run e2e tests
npm run test:e2e
```

## Production Deployment

### Prerequisites
- Kafka cluster must be available and accessible
- Schema Registry must be configured and accessible
- Network connectivity verified
- Environment variables properly set

### Deployment Checklist
1. ✅ Kafka cluster is running and accessible
2. ✅ Schema Registry is configured
3. ✅ Environment variables are set correctly
4. ✅ Network connectivity is verified
5. ✅ Application starts successfully with real connections

### Production Environment Variables
```bash
NODE_ENV=production
KAFKA_ENABLED=true
KAFKA_BROKERS=kafka1:9092,kafka2:9092,kafka3:9092
KAFKA_CLIENT_ID=autopilot-service-prod
SCHEMA_REGISTRY_URL=http://schema-registry:8081
KAFKA_MAX_RETRY_TIME=60000
KAFKA_RETRIES=10
```

## Monitoring and Observability

### Application Logs
```typescript
// Connection success
"Kafka service initialized successfully with real connections"

// Mock mode activation
"Kafka service running in mock mode due to infrastructure unavailability"

// Message production
"[KAFKA-PRODUCER] Message sent to autopilot.phase.transition"
"[KAFKA-PRODUCER-MOCK] Message would be sent to autopilot.phase.transition"
```

### Health Checks
```bash
# Application health
curl http://localhost:3000/health

# Kafka-specific health
curl http://localhost:3000/health/kafka
```

### Kafka UI (Development)
Access Kafka UI at: http://localhost:8080
- View topics and messages
- Monitor consumer groups
- Check Schema Registry schemas

## Security Considerations

### Network Security
- Kafka brokers should be accessible only from application servers
- Schema Registry should be secured with authentication if in production
- Use TLS/SSL for production Kafka connections

### Authentication (Production)
```bash
# Add SASL authentication if required
KAFKA_SASL_MECHANISM=PLAIN
KAFKA_SASL_USERNAME=your_username
KAFKA_SASL_PASSWORD=your_password

# Schema Registry authentication
SCHEMA_REGISTRY_USER=your_user
SCHEMA_REGISTRY_PASSWORD=your_password
```

## Advanced Configuration

### Circuit Breaker Settings
```typescript
// Configured in kafka.service.ts
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,    // Failures before opening circuit
  resetTimeout: 60000,    // Time before attempting reset
});
```

### Custom Kafka Configuration
```typescript
// Override in configuration if needed
const kafkaConfig = {
  clientId: 'autopilot-service',
  brokers: ['kafka1:9092', 'kafka2:9092'],
  retry: {
    initialRetryTime: 300,
    retries: 5,
    maxRetryTime: 30000,
  },
};
```

## FAQ

### Q: Why does the application fail to start?
**A**: The most common cause is Kafka infrastructure not being available. The enhanced service now handles this gracefully by falling back to mock mode in development.

### Q: Can I develop without starting Kafka?
**A**: Yes! Use mock mode (`KAFKA_MOCK_MODE=true`) or let the application auto-detect and fall back to mock mode.

### Q: How do I know if I'm running in mock mode?
**A**: Check the application logs for messages like:
- `"Kafka service running in mock mode"`
- `"[KAFKA-PRODUCER-MOCK] Message would be sent to..."`

### Q: What's the difference between development and production mode?
**A**: 
- **Development**: Falls back to mock mode if Kafka is unavailable
- **Production**: Requires real Kafka connections (fails if unavailable)

### Q: How do I test with real Kafka?
**A**: Start the infrastructure with `docker-compose up -d` and ensure `KAFKA_ENABLED=true`.

---

## Summary

The enhanced Kafka service provides:
1. **Intelligent connection detection** with graceful fallback
2. **Environment-aware operation** modes
3. **Comprehensive error handling** and logging
4. **Flexible development** options (real Kafka or mock mode)
5. **Production safety** with strict connection requirements

This allows developers to work efficiently regardless of infrastructure availability while maintaining production safety and reliability. 