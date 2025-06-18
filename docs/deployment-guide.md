# Autopilot-v6 Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying and running the Topcoder Autopilot-v6 service with its event-based scheduling system. The service features **intelligent infrastructure detection** and supports multiple deployment modes including development, testing, and production environments.

## 🚀 Quick Start Modes

### Instant Development (No Infrastructure Required)
```bash
npm install
npm run start:dev
```
✅ **Auto-detects missing Kafka → Enables mock mode → Starts in ~3 seconds**

### Full Development (With Kafka)
```bash
npm run docker:up    # Start Kafka infrastructure
npm run start:dev    # Start application with real Kafka
```
✅ **Full event-driven scheduling with real message processing**

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Docker Deployment](#docker-deployment)
5. [Environment Setup](#environment-setup)
6. [Monitoring and Health Checks](#monitoring-and-health-checks)
7. [Security Configuration](#security-configuration)
8. [Operational Procedures](#operational-procedures)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance](#maintenance)

## Prerequisites

### Required Software
- **Node.js** >= 18.0.0
- **npm** >= 8.0.0 or **pnpm** >= 7.0.0
- **Docker** >= 20.10.0 (for Kafka infrastructure)
- **Docker Compose** >= 2.0.0

### System Requirements
- **Memory**: Minimum 4GB RAM (8GB recommended for development)
- **Storage**: At least 2GB free disk space
- **Network**: Ports 3000, 8080, 8081, 9092, 2181 available

## Quick Start

### 1. Clone and Install Dependencies
```bash
git clone https://github.com/topcoder-platform/autopilot-v6.git
cd autopilot-v6
npm install
```

### 2. Start Kafka Infrastructure
```bash
# Start all required services (Kafka, Zookeeper, Schema Registry, Kafka UI)
npm run docker:up

# Wait for services to be healthy (30-60 seconds)
# Check status with:
docker-compose ps
```

### 3. Run the Application
```bash
# Development mode with Kafka
./start-local.sh

# Or manually:
export NODE_ENV=development
export KAFKA_BROKERS=localhost:9092
export SCHEMA_REGISTRY_URL=http://localhost:8081
npm run start:dev
```

## Environment Modes

### Development Mode (Full Kafka)
**Purpose**: Local development with real Kafka infrastructure
**Requirements**: Running Kafka cluster

```bash
# Start Kafka infrastructure
npm run docker:up

# Run application
./start-local.sh
```

**Features**:
- ✅ Real Kafka message publishing
- ✅ Schema Registry validation
- ✅ Full event-driven scheduling
- ✅ Recovery mechanisms
- ✅ Consumer group processing

### Auto-Fallback Development Mode (NEW)
**Purpose**: Instant development without infrastructure setup
**Requirements**: None (auto-detects and enables mock mode)

```bash
# Simply start the application - no setup required
npm run start:dev
```

**Features**:
- ✅ **Intelligent connection detection** (500ms timeout)
- ✅ **Automatic mock mode activation** when Kafka unavailable
- ✅ **Zero configuration required** for quick development
- ✅ **All APIs functional** in simulated mode
- ✅ **3-second startup time** without infrastructure

### Test Mode (Mock Kafka)
**Purpose**: Unit and integration testing without external dependencies
**Requirements**: None (mocked services)

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests with mocks
```

**Features**:
- ✅ Mock Kafka producers/consumers
- ✅ No external connections required
- ✅ Fast test execution
- ✅ Isolated test environment
- ✅ CI/CD friendly

### Production Mode
**Purpose**: Production deployment with full monitoring
**Requirements**: External Kafka cluster, monitoring setup

```bash
export NODE_ENV=production
export KAFKA_BROKERS=kafka1:9092,kafka2:9092,kafka3:9092
export SCHEMA_REGISTRY_URL=https://schema-registry.company.com
npm run start:prod
```

## Configuration

### Environment Variables

#### Core Application Settings
```bash
NODE_ENV=development          # Environment: development, test, production
PORT=3000                    # Application port
LOG_LEVEL=info              # Logging level: error, warn, info, debug, verbose
LOG_DIR=logs                # Log file directory
```

#### Kafka Configuration
```bash
# Connection Settings
KAFKA_BROKERS=localhost:9092               # Comma-separated broker list
KAFKA_CLIENT_ID=autopilot-service         # Client identifier
KAFKA_ENABLED=true                        # Enable/disable Kafka (false for testing)
KAFKA_MOCK_MODE=false                     # Enable mock mode (true for testing)

# Schema Registry
SCHEMA_REGISTRY_URL=http://localhost:8081  # Schema Registry URL
SCHEMA_REGISTRY_USER=username              # Optional authentication
SCHEMA_REGISTRY_PASSWORD=password          # Optional authentication

# Connection Retry Settings
KAFKA_MAX_RETRY_TIME=30000                # Maximum retry time (ms)
KAFKA_INITIAL_RETRY_TIME=300              # Initial retry delay (ms)
KAFKA_RETRIES=5                           # Number of retry attempts
```

#### Scheduler Configuration
```bash
# Performance Settings
SCHEDULER_JOB_TIMEOUT=60000               # Job execution timeout (ms)
SCHEDULER_MAX_RETRIES=3                   # Maximum job retries
SCHEDULER_RETRY_DELAY=5000                # Retry delay (ms)
SCHEDULER_MAX_CONCURRENT_JOBS=50          # Concurrent job limit

# Scheduling Constraints
SCHEDULER_MIN_SCHEDULE_ADVANCE=1000       # Minimum schedule advance time (ms)
SCHEDULER_MAX_SCHEDULE_ADVANCE=7776000000 # Maximum schedule advance time (ms)
SCHEDULER_ALLOW_PAST_SCHEDULING=false     # Allow scheduling in the past

# Monitoring and Debugging
SCHEDULER_ENABLE_METRICS=true             # Enable performance metrics
SCHEDULER_DEBUG_LOGGING=false             # Enable debug logging
SCHEDULER_MOCK_MODE=false                 # Enable mock mode for testing
```

#### Recovery Configuration
```bash
# Recovery Behavior
RECOVERY_ENABLED=true                     # Enable startup recovery
RECOVERY_STARTUP_TIMEOUT=120000           # Recovery timeout (ms)
RECOVERY_PROCESS_OVERDUE=true             # Process overdue phases
RECOVERY_MAX_CONCURRENT_PHASES=10         # Concurrent phase processing limit

# External Service Integration
CHALLENGE_SERVICE_URL=http://localhost:3001  # Challenge service endpoint
CHALLENGE_SERVICE_TIMEOUT=30000           # Service call timeout (ms)
CHALLENGE_SERVICE_MOCK_MODE=false         # Enable mock mode for testing
```

## Docker Deployment

### Using Docker Compose (Recommended)
```bash
# Start all services including application
docker-compose up -d

# Scale application instances
docker-compose up -d --scale autopilot-service=3

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

### Production Docker Deployment
```yaml
version: '3.8'
services:
  autopilot-service:
    image: autopilot-v6:latest
    environment:
      NODE_ENV: production
      KAFKA_BROKERS: kafka1:9092,kafka2:9092
      SCHEMA_REGISTRY_URL: https://schema-registry.prod.com
      # ... other production settings
    ports:
      - "3000:3000"
    depends_on:
      - kafka
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Testing

### Running Tests

#### All Tests (Recommended)
```bash
npm test                    # All tests with mocked Kafka
```

#### Specific Test Types
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests with mocks
npm run test:watch         # Watch mode for development
npm run test:cov           # Coverage report
```

#### Tests with Real Kafka (Advanced)
```bash
# Start Kafka first
npm run docker:up

# Run integration tests against real Kafka
npm run test:integration:kafka
```

### Test Environment Setup
Tests automatically run in mock mode with:
- ✅ **No Kafka connections required**
- ✅ **Mocked producers and consumers**
- ✅ **Isolated test environment**
- ✅ **Fast execution**

## Troubleshooting

### Common Issues

#### 1. Kafka Connection Errors
**Problem**: `connect ECONNREFUSED 127.0.0.1:9092`

**Solutions**:
```bash
# Check if Kafka is running
docker-compose ps

# Start Kafka infrastructure
npm run docker:up

# Wait for services to be healthy
docker-compose logs kafka

# For tests, ensure NODE_ENV=test
NODE_ENV=test npm test
```

#### 2. Schema Registry Errors
**Problem**: `Schema Registry error: Failed to register schema`

**Solutions**:
```bash
# Check Schema Registry status
curl http://localhost:8081

# Restart Schema Registry
docker-compose restart schema-registry

# Check logs
docker-compose logs schema-registry
```

#### 3. Port Conflicts
**Problem**: `Port 3000 is already in use`

**Solutions**:
```bash
# Use different port
export PORT=3001
npm run start:dev

# Or kill existing process
lsof -ti:3000 | xargs kill -9
```

#### 4. Memory Issues
**Problem**: Application crashes with out-of-memory errors

**Solutions**:
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Reduce concurrent job limits
export SCHEDULER_MAX_CONCURRENT_JOBS=25
export RECOVERY_MAX_CONCURRENT_PHASES=5
```

### Health Checks

#### Application Health
```bash
# Basic health check
curl http://localhost:3000/health

# Detailed health status
curl http://localhost:3000/health/detailed

# Scheduler status
curl http://localhost:3000/health/scheduler

# Recovery status  
curl http://localhost:3000/health/recovery
```

#### Kafka Infrastructure Health
```bash
# Kafka broker status
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Schema Registry status
curl http://localhost:8081/subjects

# Kafka UI (if running)
open http://localhost:8080
```

## Monitoring and Logging

### Application Logs
```bash
# View live logs
tail -f logs/autopilot-service.log

# Docker logs
docker-compose logs -f autopilot-service

# Filter by log level
grep "ERROR" logs/autopilot-service.log
```

### Metrics and Monitoring
- **Scheduler Metrics**: Job execution rates, success/failure ratios
- **Recovery Metrics**: Phase processing statistics, recovery times
- **Kafka Metrics**: Message production/consumption rates
- **System Metrics**: Memory usage, CPU utilization

### Log Levels
- **ERROR**: Critical errors requiring immediate attention
- **WARN**: Potential issues that don't break functionality
- **INFO**: Normal operational messages
- **DEBUG**: Detailed debugging information
- **VERBOSE**: Extremely detailed debugging (not recommended for production)

## Security Considerations

### Production Deployment
- ✅ Use HTTPS for Schema Registry connections
- ✅ Enable Kafka SSL/SASL authentication
- ✅ Restrict network access to Kafka brokers
- ✅ Use secrets management for credentials
- ✅ Enable audit logging
- ✅ Regular security updates

### Environment Variables
```bash
# Secure configuration
SCHEMA_REGISTRY_USER=secure_username
SCHEMA_REGISTRY_PASSWORD=secure_password
KAFKA_SASL_MECHANISM=PLAIN
KAFKA_SECURITY_PROTOCOL=SASL_SSL
```

## Performance Tuning

### Scheduler Optimization
```bash
# High-throughput settings
SCHEDULER_MAX_CONCURRENT_JOBS=100
SCHEDULER_CLEANUP_INTERVAL=60000
SCHEDULER_ENABLE_CIRCUIT_BREAKER=true

# Memory optimization
SCHEDULER_MAX_JOB_HISTORY=500
SCHEDULER_MAX_COMPLETED_JOB_AGE=1800000
```

### Kafka Optimization
```bash
# Producer settings
KAFKA_BATCH_SIZE=16384
KAFKA_LINGER_MS=5
KAFKA_COMPRESSION_TYPE=snappy

# Consumer settings
KAFKA_FETCH_MIN_BYTES=1
KAFKA_FETCH_MAX_WAIT=500
KAFKA_MAX_PARTITION_FETCH_BYTES=1048576
```

## Support

### Getting Help
- **Documentation**: [Project README](../README.md)
- **Issues**: [GitHub Issues](https://github.com/topcoder-platform/autopilot-v6/issues)
- **Architecture**: [Scheduling Approach](./scheduling-approach.md)
- **Recovery**: [Recovery Mechanisms](./recovery-mechanisms.md)

### Debug Information
When reporting issues, include:
- Environment variables (redact sensitive information)
- Application logs (last 100 lines)
- Docker/Kafka logs if applicable
- System specifications
- Steps to reproduce the issue

This comprehensive deployment guide ensures successful deployment and operation of the Autopilot-v6 service in production environments with proper monitoring, security, and maintenance procedures.