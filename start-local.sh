#!/bin/bash

# Export environment variables
export NODE_ENV=development
export PORT=3000
export LOG_LEVEL=debug
export LOG_DIR=logs
export KAFKA_BROKERS=localhost:9092
export KAFKA_CLIENT_ID=autopilot-service
export KAFKA_MAX_RETRY_TIME=30000
export KAFKA_INITIAL_RETRY_TIME=300
export KAFKA_RETRIES=5
export SCHEMA_REGISTRY_URL=http://localhost:8081

# Start the application
npm run start:dev 