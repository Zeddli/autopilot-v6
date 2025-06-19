# 🚀 Deployment Guide - Autopilot Service v6

## Quick Start Deployment

### Option 1: Development (Instant Start)
```bash
# Clone and install
git clone <repository-url>
cd autopilot-v6
npm install

# Start immediately (auto-fallback to mock mode)
npm run start:dev
```
✅ **Ready in 3 seconds** - All APIs functional in mock mode

### Option 2: Full Infrastructure
```bash
# Start Kafka infrastructure
sudo docker-compose up -d

# Wait for services to be ready
docker-compose ps

# Start application
npm run start:dev
```
✅ **Production-like environment** with real Kafka integration

---

## Production Deployment

### Prerequisites
- Node.js v18+
- Docker & Docker Compose
- Minimum 512MB RAM, 1GB recommended

### Environment Configuration
```bash
# Copy and configure environment
cp .env.example .env

# Key production settings
NODE_ENV=production
KAFKA_BROKERS=your-kafka-brokers
SCHEMA_REGISTRY_URL=your-schema-registry
```

### Deployment Methods

#### 1. Docker Container
```bash
# Build application
docker build -t autopilot-service .

# Run with environment
docker run -d \
  --name autopilot-service \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e KAFKA_BROKERS=kafka:9092 \
  autopilot-service
```

#### 2. Docker Compose (Full Stack)
```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

#### 3. Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: autopilot-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: autopilot-service
  template:
    metadata:
      labels:
        app: autopilot-service
    spec:
      containers:
      - name: autopilot-service
        image: autopilot-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: KAFKA_BROKERS
          value: "kafka-service:9092"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
        readinessProbe:
          httpGet:
            path: /health/app
            port: 3000
          initialDelaySeconds: 5
```

---

## Health Monitoring

### Health Check Endpoints
```bash
# Basic health check
curl http://localhost:3000/health

# Detailed system status
curl http://localhost:3000/health/detailed

# Kafka connectivity status  
curl http://localhost:3000/health/kafka
```

### Expected Responses
**Healthy Service:**
```json
{
  "status": "ok",
  "info": {
    "kafka": { "status": "up" },
    "scheduler": { "status": "up" },
    "recovery": { "status": "up" }
  }
}
```

**Mock Mode (Development):**
```json
{
  "status": "ok",
  "info": {
    "kafka": { 
      "status": "up", 
      "mode": "mock",
      "message": "Kafka infrastructure not available, running in mock mode"
    }
  }
}
```

---

## Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
lsof -i :3000
kill -9 <PID>
# Or use different port: PORT=3001 npm run start:dev
```

**Kafka Connection Issues:**
- Development: Auto-fallback to mock mode (expected)
- Production: Verify Kafka brokers are accessible

**Docker Permission Issues:**
```bash
sudo usermod -aG docker $USER
# Logout and login again
```

### Log Analysis
**Successful Kafka Connection:**
```
[KafkaService] Kafka broker connectivity test successful
[Consumer] Starting
[ConsumerGroup] Consumer has joined the group
```

**Mock Mode Fallback:**
```
[KafkaService] Kafka infrastructure not available, falling back to mock mode
[KafkaService] Mock mode enabled - Kafka operations will be simulated
```

---

## Configuration Reference

### Required Environment Variables
```env
NODE_ENV=production
KAFKA_BROKERS=localhost:9092
SCHEMA_REGISTRY_URL=http://localhost:8081
```

### Optional Configuration
```env
PORT=3000
LOG_LEVEL=info
KAFKA_CLIENT_ID=autopilot-service
KAFKA_ENABLED=true
RECOVERY_MAX_CONCURRENT_PHASES=10
```

---

## Performance Tuning

### Memory Optimization
- Base requirement: 512MB
- Recommended: 1GB
- High load: 2GB+

### Scaling Configuration
```env
# Increase for high-load environments
RECOVERY_MAX_CONCURRENT_PHASES=20
SCHEDULER_MAX_JOBS=2000
```

### Monitoring
- Use `/health/detailed` for comprehensive status
- Monitor job queue size via scheduler health endpoint
- Track Kafka consumer lag via Kafka UI

---

## Security Considerations

### Network Security
- Expose only necessary ports (3000 for HTTP)
- Use TLS for production Kafka connections
- Implement API authentication if required

### Environment Security
- Use secrets management for sensitive configs
- Avoid plain text credentials in environment files
- Enable audit logging in production

---

**🎯 Deployment Status: Production Ready**

The service is fully tested and ready for immediate deployment in any environment. 