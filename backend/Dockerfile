# ---- Stage 1: Build the application ----
ARG GRADLE_IMAGE=gradle:jdk21
ARG RUNTIME_IMAGE=eclipse-temurin:21-jre
FROM ${GRADLE_IMAGE} AS build

WORKDIR /app

# Copy Gradle wrapper and build files first (for caching)
COPY build.gradle settings.gradle ./
COPY gradle gradle
COPY gradlew ./
RUN ./gradlew --version

# Copy source code
COPY src src

# Build the app (skip tests for speed in CI/CD)
RUN ./gradlew clean bootJar -x test

# ---- Stage 2: Run the application ----
FROM ${RUNTIME_IMAGE}

WORKDIR /app

# Copy the bootJar (fat JAR) from the build stage
COPY --from=build /app/build/libs/*.jar app.jar

# Expose Spring Boot’s default port
EXPOSE 8080

# Run the app
ENTRYPOINT ["java", "-jar", "app.jar"]
