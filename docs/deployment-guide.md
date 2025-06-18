# Autopilot-v6 Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Topcoder Autopilot-v6 service in production environments. The service implements event-based scheduling for challenge phase transitions with comprehensive recovery and monitoring capabilities.

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

### System Requirements

#### Minimum Requirements
- **CPU**: 2 cores
- **Memory**: 4GB RAM
- **Storage**: 20GB available space
- **Network**: Stable internet connection

#### Recommended Requirements
- **CPU**: 4+ cores
- **Memory**: 8GB+ RAM
- **Storage**: 50GB+ available space
- **Network**: High-bandwidth, low-latency connection

### Software Dependencies

#### Required Software
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0 (or **pnpm**: >= 7.0.0)
- **Docker**: >= 20.10.0 (for containerized deployment)
- **Docker Compose**: >= 2.0.0

#### External Services
- **Kafka Cluster**: >= 2.8.0
- **Challenge Service**: Topcoder Challenge API
- **Monitoring System**: Prometheus/Grafana (recommended)

### Network Requirements

#### Outbound Connections
- **Kafka Brokers**: Port 9092 (configurable)
- **Challenge Service**: HTTPS (Port 443)
- **Health Check Endpoints**: HTTP (Port 3000)

#### Inbound Connections
- **Health Checks**: Port 3000
- **Metrics Endpoint**: Port 3000/metrics

## Installation

### Option 1: Direct Installation

#### 1. Clone Repository

```bash
git clone https://github.com/topcoder-platform/autopilot-v6.git
cd autopilot-v6
```

#### 2. Install Dependencies

```bash
# Using npm
npm install

# Using pnpm (recommended)
pnpm install
```

#### 3. Build Application

```bash
# Development build
npm run build

# Production optimized build
npm run build:prod
```

#### 4. Verify Installation

```bash
# Run tests
npm run test

# Run linting
npm run lint

# Check health
npm run start:dev &
curl http://localhost:3000/health
```

### Option 2: Docker Installation

#### 1. Build Docker Image

```bash
# Build production image
docker build -f Dockerfile -t autopilot-v6:latest .

# Build development image
docker build -f Dockerfile.dev -t autopilot-v6:dev .
```

#### 2. Verify Docker Build

```bash
# Run container
docker run -p 3000:3000 --env-file .env.example autopilot-v6:latest

# Check health
curl http://localhost:3000/health
```

## Configuration

### Environment Variables

Create a `.env` file based on the provided `.env.example`:

```bash
cp .env.example .env
```

#### Core Configuration

```bash
# Application Settings
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=autopilot-v6
KAFKA_GROUP_ID=autopilot-group
KAFKA_RETRY_ATTEMPTS=5
KAFKA_RETRY_DELAY=3000

# Challenge Service
CHALLENGE_SERVICE_URL=https://api.topcoder.com/v5
CHALLENGE_SERVICE_TIMEOUT=15000
CHALLENGE_SERVICE_API_KEY=your-api-key-here
```

#### Scheduler Configuration

```bash
# Job Management
SCHEDULER_JOB_TIMEOUT=60000
SCHEDULER_MAX_RETRIES=3
SCHEDULER_RETRY_DELAY=5000

# Performance Tuning
SCHEDULER_MAX_CONCURRENT_JOBS=50
SCHEDULER_CLEANUP_INTERVAL=300000
SCHEDULER_MAX_COMPLETED_JOB_AGE=3600000
SCHEDULER_MAX_FAILED_JOB_AGE=86400000

# Scheduling Constraints
SCHEDULER_MIN_SCHEDULE_ADVANCE=1000
SCHEDULER_MAX_SCHEDULE_ADVANCE=7776000000
SCHEDULER_ALLOW_PAST_SCHEDULING=false

# Debugging
SCHEDULER_ENABLE_DEBUG_LOGGING=false
SCHEDULER_LOG_JOB_DETAILS=false
```

#### Recovery Configuration

```bash
# Startup Recovery
RECOVERY_ENABLED=true
RECOVERY_STARTUP_TIMEOUT=120000

# Phase Processing
RECOVERY_MAX_CONCURRENT_PHASES=10
RECOVERY_PHASE_TIMEOUT=30000
RECOVERY_PROCESS_OVERDUE_PHASES=true
RECOVERY_SKIP_INVALID_PHASES=true
RECOVERY_MAX_PHASE_AGE_HOURS=72

# Batch Processing
RECOVERY_MAX_BATCH_SIZE=50
RECOVERY_BATCH_DELAY=100

# Challenge Service Integration
RECOVERY_CHALLENGE_SERVICE_TIMEOUT=15000
RECOVERY_CHALLENGE_SERVICE_RETRIES=3
RECOVERY_CHALLENGE_SERVICE_MOCK_MODE=false

# Monitoring
RECOVERY_ENABLE_DEBUG_LOGGING=false
RECOVERY_ENABLE_METRICS=true
```

#### Circuit Breaker Configuration

```bash
# Scheduler Circuit Breaker
CIRCUIT_BREAKER_SCHEDULER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_SCHEDULER_RESET_TIMEOUT=60000
CIRCUIT_BREAKER_SCHEDULER_SUCCESS_THRESHOLD=3

# Recovery Circuit Breaker
CIRCUIT_BREAKER_RECOVERY_FAILURE_THRESHOLD=3
CIRCUIT_BREAKER_RECOVERY_RESET_TIMEOUT=120000
CIRCUIT_BREAKER_RECOVERY_SUCCESS_THRESHOLD=2

# Challenge Service Circuit Breaker
CIRCUIT_BREAKER_CHALLENGE_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_CHALLENGE_RESET_TIMEOUT=30000
CIRCUIT_BREAKER_CHALLENGE_SUCCESS_THRESHOLD=2
```

### Configuration Validation

The application validates all configuration on startup:

```bash
# Check configuration validity
npm run config:validate

# View current configuration
npm run config:show
```

## Docker Deployment

### Docker Compose Setup

#### 1. Create docker-compose.yml

```yaml
version: '3.8'

services:
  autopilot-v6:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env
    depends_on:
      - kafka
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  kafka:
    image: confluentinc/cp-kafka:7.4.0
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    depends_on:
      - zookeeper

  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    ports:
      - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

volumes:
  kafka_data:
  zookeeper_data:
```

#### 2. Deploy with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f autopilot-v6

# Check service status
docker-compose ps

# Stop services
docker-compose down
```

### Production Docker Deployment

#### 1. Multi-stage Production Dockerfile

```dockerfile
# Production Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S autopilot -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=autopilot:nodejs . .

USER autopilot

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "run", "start:prod"]
```

#### 2. Build and Deploy

```bash
# Build production image
docker build -f Dockerfile -t autopilot-v6:v1.0.0 .

# Tag for registry
docker tag autopilot-v6:v1.0.0 your-registry.com/autopilot-v6:v1.0.0

# Push to registry
docker push your-registry.com/autopilot-v6:v1.0.0

# Deploy to production
docker run -d \
  --name autopilot-v6-prod \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env.production \
  your-registry.com/autopilot-v6:v1.0.0
```

## Environment Setup

### Development Environment

```bash
# Install dependencies
pnpm install

# Start development server
npm run start:dev

# Run in watch mode
npm run start:debug

# Run tests
npm run test:watch
```

### Staging Environment

```bash
# Build for staging
npm run build

# Start staging server
NODE_ENV=staging npm run start:prod

# Run integration tests
npm run test:e2e
```

### Production Environment

```bash
# Build optimized production bundle
npm run build:prod

# Start production server
NODE_ENV=production npm run start:prod

# Health check
curl http://localhost:3000/health/all
```

### Environment-Specific Configuration

#### Development (.env.development)

```bash
NODE_ENV=development
LOG_LEVEL=debug
SCHEDULER_ENABLE_DEBUG_LOGGING=true
RECOVERY_ENABLE_DEBUG_LOGGING=true
RECOVERY_CHALLENGE_SERVICE_MOCK_MODE=true
```

#### Staging (.env.staging)

```bash
NODE_ENV=staging
LOG_LEVEL=info
SCHEDULER_ENABLE_DEBUG_LOGGING=false
RECOVERY_ENABLE_DEBUG_LOGGING=false
RECOVERY_CHALLENGE_SERVICE_MOCK_MODE=false
```

#### Production (.env.production)

```bash
NODE_ENV=production
LOG_LEVEL=warn
SCHEDULER_ENABLE_DEBUG_LOGGING=false
RECOVERY_ENABLE_DEBUG_LOGGING=false
RECOVERY_CHALLENGE_SERVICE_MOCK_MODE=false
SCHEDULER_LOG_JOB_DETAILS=false
```

## Monitoring and Health Checks

### Health Check Endpoints

#### Basic Health Check

```bash
# Overall system health
curl http://localhost:3000/health

# Response format
{
  "status": "ok",
  "info": {
    "scheduler": { "status": "up" },
    "recovery": { "status": "up" },
    "kafka": { "status": "up" }
  },
  "error": {},
  "details": {
    "scheduler": { "status": "up" },
    "recovery": { "status": "up" },
    "kafka": { "status": "up" }
  }
}
```

#### Detailed Health Checks

```bash
# Scheduler health
curl http://localhost:3000/health/scheduler

# Recovery health
curl http://localhost:3000/health/recovery

# All components
curl http://localhost:3000/health/all
```

### Metrics Endpoint

```bash
# Prometheus metrics
curl http://localhost:3000/metrics

# Sample metrics
# autopilot_scheduled_jobs_total 15
# autopilot_completed_jobs_total 142
# autopilot_failed_jobs_total 3
# autopilot_recovery_success_rate 0.98
```

### Monitoring Setup

#### 1. Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'autopilot-v6'
    static_configs:
      - targets: ['localhost:3000']
    scrape_interval: 10s
    metrics_path: /metrics
```

#### 2. Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Autopilot-v6 Monitoring",
    "panels": [
      {
        "title": "Active Jobs",
        "type": "stat",
        "targets": [
          {
            "expr": "autopilot_scheduled_jobs_total"
          }
        ]
      },
      {
        "title": "Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "autopilot_recovery_success_rate"
          }
        ]
      }
    ]
  }
}
```

#### 3. Alerting Rules

```yaml
# alerts.yml
groups:
  - name: autopilot-v6
    rules:
      - alert: HighFailureRate
        expr: autopilot_recovery_success_rate < 0.95
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Autopilot-v6 recovery success rate is below 95%"

      - alert: ServiceDown
        expr: up{job="autopilot-v6"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Autopilot-v6 service is down"
```

## Security Configuration

### Authentication Setup

#### 1. JWT Configuration

```bash
# JWT settings
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
```

#### 2. API Security

```bash
# API rate limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # 100 requests per window

# CORS configuration
CORS_ORIGIN=https://your-frontend-domain.com
CORS_METHODS=GET,POST,PUT,DELETE
CORS_ALLOWED_HEADERS=Content-Type,Authorization
```

### Network Security

#### 1. Firewall Configuration

```bash
# Allow inbound HTTP traffic
sudo ufw allow 3000/tcp

# Allow outbound Kafka traffic
sudo ufw allow out 9092/tcp

# Allow outbound HTTPS traffic
sudo ufw allow out 443/tcp
```

#### 2. TLS/SSL Setup

```bash
# SSL certificate configuration
SSL_CERT_PATH=/path/to/certificate.crt
SSL_KEY_PATH=/path/to/private.key
SSL_CA_PATH=/path/to/ca-bundle.crt

# Enable HTTPS
ENABLE_HTTPS=true
HTTPS_PORT=3443
```

### Environment Security

#### 1. Secrets Management

```bash
# Use environment-specific secret files
source /etc/autopilot-v6/secrets.env

# Or use external secret management
export CHALLENGE_SERVICE_API_KEY=$(vault kv get -field=api_key secret/autopilot-v6)
```

#### 2. Container Security

```dockerfile
# Security-hardened Dockerfile
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S autopilot -u 1001 -G nodejs

# Set secure file permissions
COPY --chown=autopilot:nodejs . .

# Drop privileges
USER autopilot

# Use read-only filesystem
VOLUME ["/tmp"]
```

## Operational Procedures

### Deployment Process

#### 1. Pre-deployment Checklist

```bash
# Configuration validation
npm run config:validate

# Security scan
npm audit

# Unit tests
npm run test

# Integration tests
npm run test:e2e

# Build verification
npm run build && npm run start:prod &
curl http://localhost:3000/health
```

#### 2. Rolling Deployment

```bash
#!/bin/bash
# rolling-deploy.sh

set -e

echo "Starting rolling deployment..."

# Build new image
docker build -t autopilot-v6:new .

# Health check function
health_check() {
  curl -f http://localhost:3000/health >/dev/null 2>&1
}

# Stop old container gracefully
docker stop autopilot-v6-current || true

# Start new container
docker run -d \
  --name autopilot-v6-new \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env.production \
  autopilot-v6:new

# Wait for health check
echo "Waiting for service to be healthy..."
for i in {1..30}; do
  if health_check; then
    echo "Service is healthy!"
    break
  fi
  sleep 10
done

# Verify deployment
if health_check; then
  # Cleanup old container
  docker rm autopilot-v6-current || true
  docker tag autopilot-v6:new autopilot-v6:current
  echo "Deployment successful!"
else
  echo "Deployment failed - rolling back..."
  docker stop autopilot-v6-new
  docker start autopilot-v6-current
  exit 1
fi
```

#### 3. Blue-Green Deployment

```bash
#!/bin/bash
# blue-green-deploy.sh

set -e

CURRENT_COLOR=$(docker ps --format "table {{.Names}}" | grep autopilot | head -1 | cut -d'-' -f3)
NEW_COLOR=$([ "$CURRENT_COLOR" = "blue" ] && echo "green" || echo "blue")

echo "Current deployment: $CURRENT_COLOR"
echo "New deployment: $NEW_COLOR"

# Deploy to new environment
docker run -d \
  --name autopilot-v6-$NEW_COLOR \
  -p $([ "$NEW_COLOR" = "blue" ] && echo "3001" || echo "3002"):3000 \
  --env-file .env.production \
  autopilot-v6:latest

# Health check new deployment
sleep 30
if curl -f http://localhost:$([ "$NEW_COLOR" = "blue" ] && echo "3001" || echo "3002")/health; then
  # Switch traffic
  docker stop autopilot-v6-$CURRENT_COLOR
  docker run -d \
    --name autopilot-v6-proxy-$NEW_COLOR \
    -p 3000:3000 \
    nginx:alpine
  
  echo "Traffic switched to $NEW_COLOR"
else
  echo "Health check failed - deployment aborted"
  docker stop autopilot-v6-$NEW_COLOR
  exit 1
fi
```

### Backup and Recovery

#### 1. Configuration Backup

```bash
#!/bin/bash
# backup-config.sh

BACKUP_DIR="/backups/autopilot-v6/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup configuration files
cp .env* "$BACKUP_DIR/"
cp docker-compose.yml "$BACKUP_DIR/"

# Backup logs
cp -r logs/ "$BACKUP_DIR/" 2>/dev/null || true

echo "Configuration backed up to $BACKUP_DIR"
```

#### 2. State Recovery

```bash
#!/bin/bash
# recover-state.sh

echo "Starting state recovery..."

# Stop current service
docker-compose down

# Restore configuration
RESTORE_DIR="$1"
if [ -z "$RESTORE_DIR" ]; then
  echo "Usage: $0 <backup-directory>"
  exit 1
fi

cp "$RESTORE_DIR"/.env* .
cp "$RESTORE_DIR"/docker-compose.yml .

# Start service with recovery enabled
RECOVERY_ENABLED=true docker-compose up -d

echo "State recovery completed"
```

### Log Management

#### 1. Log Rotation

```bash
# /etc/logrotate.d/autopilot-v6
/var/log/autopilot-v6/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 autopilot autopilot
    postrotate
        docker kill -s USR1 autopilot-v6-current 2>/dev/null || true
    endscript
}
```

#### 2. Centralized Logging

```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  autopilot-v6:
    logging:
      driver: "fluentd"
      options:
        fluentd-address: localhost:24224
        tag: autopilot-v6

  fluentd:
    image: fluent/fluentd:v1.14-1
    ports:
      - "24224:24224"
    volumes:
      - ./fluentd.conf:/fluentd/etc/fluentd.conf
```

## Troubleshooting

### Common Issues

#### 1. Service Won't Start

**Symptoms**: Service fails to start or crashes immediately

**Diagnostic Steps**:
```bash
# Check logs
docker logs autopilot-v6-current

# Verify configuration
npm run config:validate

# Check dependencies
npm run health:dependencies

# Test minimal configuration
NODE_ENV=development npm run start:dev
```

**Common Causes**:
- Invalid configuration values
- Missing environment variables
- Kafka connectivity issues
- Port conflicts

#### 2. High Memory Usage

**Symptoms**: Memory usage continuously increases

**Diagnostic Steps**:
```bash
# Monitor memory usage
docker stats autopilot-v6-current

# Check active jobs
curl http://localhost:3000/health/scheduler

# Review job cleanup settings
grep CLEANUP .env
```

**Resolution**:
```bash
# Reduce concurrent jobs
SCHEDULER_MAX_CONCURRENT_JOBS=25

# Increase cleanup frequency
SCHEDULER_CLEANUP_INTERVAL=120000

# Restart service
docker restart autopilot-v6-current
```

#### 3. Recovery Failures

**Symptoms**: Startup recovery reports failures

**Diagnostic Steps**:
```bash
# Check recovery logs
grep "RecoveryService" logs/application.log

# Test challenge service connectivity
curl -H "Authorization: Bearer $API_KEY" $CHALLENGE_SERVICE_URL/challenges

# Verify recovery configuration
grep RECOVERY .env
```

**Resolution**:
```bash
# Enable mock mode temporarily
RECOVERY_CHALLENGE_SERVICE_MOCK_MODE=true

# Reduce concurrent processing
RECOVERY_MAX_CONCURRENT_PHASES=5

# Increase timeouts
RECOVERY_STARTUP_TIMEOUT=300000
```

### Performance Issues

#### 1. Slow Response Times

**Diagnostic Steps**:
```bash
# Check response times
time curl http://localhost:3000/health

# Monitor active connections
netstat -an | grep :3000

# Check system resources
top -p $(pgrep -f autopilot-v6)
```

**Optimization**:
```bash
# Increase worker threads
UV_THREADPOOL_SIZE=16

# Optimize garbage collection
NODE_OPTIONS="--max-old-space-size=2048 --optimize-for-size"

# Enable clustering
CLUSTER_WORKERS=4
```

#### 2. High CPU Usage

**Diagnostic Steps**:
```bash
# Profile CPU usage
node --prof app.js

# Analyze profile
node --prof-process isolate-*.log > profile.txt

# Check job execution frequency
grep "Executed phase transition" logs/application.log | wc -l
```

**Resolution**:
```bash
# Reduce job concurrency
SCHEDULER_MAX_CONCURRENT_JOBS=20

# Add job delays
SCHEDULER_MIN_SCHEDULE_ADVANCE=5000

# Optimize cleanup intervals
SCHEDULER_CLEANUP_INTERVAL=600000
```

## Maintenance

### Regular Maintenance Tasks

#### Daily Tasks

```bash
#!/bin/bash
# daily-maintenance.sh

# Health check
curl -f http://localhost:3000/health/all || exit 1

# Log rotation
logrotate /etc/logrotate.d/autopilot-v6

# Disk space check
df -h | grep -E '(9[0-9]|100)%' && echo "WARNING: Disk space low"

# Memory usage check
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.2f", $3/$2 * 100.0)}')
if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
  echo "WARNING: Memory usage high: $MEMORY_USAGE%"
fi
```

#### Weekly Tasks

```bash
#!/bin/bash
# weekly-maintenance.sh

# Update dependencies
npm audit fix

# Clean up old logs
find logs/ -name "*.log" -mtime +7 -delete

# Clean up old Docker images
docker image prune -f

# Backup configuration
./backup-config.sh

# Performance report
echo "=== Weekly Performance Report ===" >> reports/weekly-$(date +%Y%m%d).txt
curl -s http://localhost:3000/metrics | grep -E "(jobs_total|success_rate)" >> reports/weekly-$(date +%Y%m%d).txt
```

#### Monthly Tasks

```bash
#!/bin/bash
# monthly-maintenance.sh

# Security updates
npm audit
docker pull node:18-alpine

# Configuration review
npm run config:validate
npm run config:show > config-backup-$(date +%Y%m%d).txt

# Performance optimization review
echo "=== Monthly Performance Review ===" > reports/monthly-$(date +%Y%m%d).txt
docker stats --no-stream autopilot-v6-current >> reports/monthly-$(date +%Y%m%d).txt

# Capacity planning
echo "=== Capacity Metrics ===" >> reports/monthly-$(date +%Y%m%d).txt
curl -s http://localhost:3000/metrics | grep -E "(memory|cpu|disk)" >> reports/monthly-$(date +%Y%m%d).txt
```

### Upgrade Procedures

#### 1. Minor Version Upgrade

```bash
#!/bin/bash
# minor-upgrade.sh

VERSION="$1"
if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

# Backup current state
./backup-config.sh

# Pull new image
docker pull autopilot-v6:$VERSION

# Rolling upgrade
docker stop autopilot-v6-current
docker run -d \
  --name autopilot-v6-$VERSION \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env.production \
  autopilot-v6:$VERSION

# Health check
sleep 30
if curl -f http://localhost:3000/health; then
  docker rm autopilot-v6-current
  docker rename autopilot-v6-$VERSION autopilot-v6-current
  echo "Upgrade to $VERSION successful"
else
  echo "Upgrade failed - rolling back"
  docker stop autopilot-v6-$VERSION
  docker start autopilot-v6-current
  exit 1
fi
```

#### 2. Major Version Upgrade

```bash
#!/bin/bash
# major-upgrade.sh

echo "Major version upgrade requires careful planning"
echo "1. Review breaking changes in CHANGELOG.md"
echo "2. Test in staging environment first"
echo "3. Plan maintenance window"
echo "4. Backup all data and configuration"
echo "5. Have rollback plan ready"

read -p "Have you completed all pre-upgrade steps? (y/N): " confirm
if [ "$confirm" != "y" ]; then
  echo "Please complete pre-upgrade steps first"
  exit 1
fi

# Continue with upgrade process...
```

This comprehensive deployment guide ensures successful deployment and operation of the Autopilot-v6 service in production environments with proper monitoring, security, and maintenance procedures.