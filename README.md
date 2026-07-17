# ROAMER

ROAMER is a travel management web application developed as part of the SEP course.

The application helps users plan, organize, and manage travel-related information in one central platform. ROAMER combines trip planning, flights, hotels, activities, calendar entries, budget tracking, map-based travel progress, user profile features, and account management in one web application.

The system is built as a client-server application with an Angular frontend, a Spring Boot backend, and a PostgreSQL database.

This repository represents the final project version after Sprint 4.

---

## Final Release

| Field | Details |
|---|---|
| Release name | ROAMER Final Release |
| Version | v1.0.0 |
| Sprint | Sprint 4 |
| Release type | Final project release |
| Project | ROAMER |
| Team | team-lovelace-notation |

---

## Features

ROAMER includes the following main features:

- User registration, login, logout, and account management
- Email verification during registration
- Password reset flow
- JWT-based authentication
- Dashboard with travel overview
- Trip planning flow
- Flight search and flight planning
- Hotel search and hotel planning
- Activities and event discovery
- Calendar for travel-related entries
- Budget tracking
- Trip overview pages
- Trip summary PDF export
- World map and travel progress features
- Profile-related features
- XP/level and community-related UI elements
- Light/dark mode
- Settings and user preferences
- External API integration for travel-related data
- ROAMER-themed authentication avatar
- Avatar interactions such as eye tracking, blinking, and password visibility reaction
- Global loading animation for API requests
- Responsive frontend design

---

## Visual Overview

ROAMER provides a dashboard-based user interface with sidebar navigation.

Main navigation areas include:

- Dashboard
- Trips
- Flights
- Hotels
- Activities
- Budget Tracker
- Calendar
- Profile
- Settings

The final version also includes improved authentication pages with a ROAMER-themed avatar, themed backgrounds, password visibility toggles, and global loading feedback.

---

## Tech Stack

### Frontend

- Angular
- TypeScript
- HTML
- CSS
- RxJS

### Backend

- Java 21
- Spring Boot
- Spring Security
- JWT authentication
- PostgreSQL

### DevOps / Tooling

- Docker
- Docker Compose
- GitLab
- GitLab CI/CD
- Gradle
- npm

---

## Project Structure

```text
project-root/
├── frontend/           Angular frontend
├── backend/            Spring Boot backend
├── compose.yaml        Docker Compose setup
├── README.md           Project documentation
└── .gitlab-ci.yml      GitLab CI/CD pipeline

Requirements

Before running the project locally, install:

Java 21
Node.js and npm
Docker Desktop
Git
IntelliJ IDEA or another suitable IDE
Environment Configuration

The backend requires local environment configuration for sensitive values such as email credentials, JWT secrets, and external API keys.

Create a local environment file if required by the backend setup:

backend/.env

Example structure:

MAIL_USERNAME=your_sender_email@gmail.com
MAIL_PASSWORD=your_gmail_app_password
JWT_SECRET=your_jwt_secret
TICKETMASTER_API_KEY=your_ticketmaster_api_key
RAPIDAPI_KEY=your_rapidapi_key

Important:

Do not commit .env files.
Each developer must create their own local environment configuration.
Gmail requires an App Password, not the normal Gmail password.
API keys and secrets must not be committed to the repository.
Running the Project
1. Start Docker Services

From the project root:

docker compose up -d

This starts the required Docker services, including the PostgreSQL database.

Check running containers:

docker ps
2. Start the Backend

From the project root:

cd backend
.\gradlew bootRun

Backend URL:

http://localhost:8080

Swagger UI:

http://localhost:8080/swagger-ui/index.html
3. Start the Frontend

Open a second terminal:

cd frontend
npm install
npm start

or:

cd frontend
ng serve

Frontend URL:

http://localhost:4200
4. Open the Application

Open the frontend in the browser:

http://localhost:4200
Build and Testing
Frontend Build
cd frontend
npm run build
Backend Build
cd backend
.\gradlew build
API Testing

API endpoints can be tested using:

Swagger UI
Postman
Browser developer tools
Frontend integration flows

Swagger UI is available at:

http://localhost:8080/swagger-ui/index.html
Database Reset

To reset the local database and delete all local test data:

docker compose down -v
docker compose up -d

After resetting the database, restart the backend so the database schema can be recreated.

External APIs

ROAMER uses external services for travel-related data such as flights, hotels, activities, events, and weather information.

External API behavior may depend on:

provider availability
network conditions
API rate limits
valid API keys
response data from external providers

API keys must be configured locally through environment variables or local configuration files and must not be committed to the repository.

CI/CD

The project uses GitLab CI/CD for build automation.

The pipeline includes Docker-based build steps and frontend/backend validation. The final project version was prepared with dependency lockfile consistency and build stability in mind.

Before merging final changes, the team should ensure:

the main branch is up to date
merge requests are reviewed
the pipeline is green
no unresolved conflicts remain
no secrets are committed
Documentation

Detailed project documentation is maintained in the GitLab Wiki.

The Wiki contains information about:

Setup Guide
Git Workflow
Architecture
User Manual / Benutzeranleitung
Frontend Overview
Backend Overview
Database Overview
API Documentation
Swagger Documentation
Testing Documentation
Sprint Documentation
Release Notes
Known Issues
Decisions Log
Final Project Checklist

Before final submission or presentation, the following should be checked:

Main branch contains the final merged version.
GitLab pipeline is successful.
Final release v1.0.0 is created.
Release notes are available in GitLab and/or the Wiki.
README is updated.
Wiki documentation is updated.
Application can be started locally.
Frontend build succeeds.
Backend build succeeds.
Docker services start correctly.
Demo flow is tested.
No API keys or secrets are committed.
Known Limitations
External API results depend on provider availability and network conditions.
Some advanced community/profile features may require further refinement.
API response times may vary depending on external services.
Some UI animations are visual polish and can be improved further in future versions.
Some features were implemented as part of the SEP project scope and may require additional production hardening for real-world deployment.
Contributing

During development, the team used GitLab issues, branches, commits, merge requests, and code reviews.

Typical workflow:

Issue → Branch → Implementation → Commit → Push → Merge Request → Review → Merge

Guidelines used during development:

Do not push directly to main.
Create a branch for each issue or feature.
Use meaningful commit messages.
Open a merge request after pushing changes.
Let at least one teammate review the merge request.
Keep the Wiki updated when features change.
Keep release notes updated for major project versions.
Support

For project-related questions, team members should use:

GitLab issues
GitLab merge request discussions
Team communication channels
GitLab Wiki documentation
Authors and Acknowledgment

This project was developed by the ROAMER SEP team.

The team worked collaboratively on frontend, backend, database, testing, documentation, UI/UX, DevOps, and project management tasks.

Team:

team-lovelace-notation
License

This project was developed for educational purposes as part of the SEP course.

Project Status

ROAMER has reached its final Sprint 4 project version.

The project is no longer considered under active development for the SEP implementation phase. Future improvements may be documented as known limitations, future work, or extension ideas.