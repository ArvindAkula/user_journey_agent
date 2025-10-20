#!/bin/bash

# Nuclear option - disable everything except basic web server
export SPRING_PROFILES_ACTIVE=basic
export AWS_MOCK_MODE=true

# Start with minimal features
mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=8080 --spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration"