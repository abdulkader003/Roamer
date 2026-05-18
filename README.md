# ROAMER

## Description

ROAMER is a travel management web application developed as part of the SEP course.

The goal of ROAMER is to help users plan and organize travel-related information in one central platform. The application contains modules for trips, flights, hotels, activities, bookings, calendar entries, budget tracking, analytics, settings, and user account management.

The system is built as a client-server application with an Angular frontend, a Spring Boot backend, and a PostgreSQL database.

Some features are already implemented, while others are still being improved or extended during development.

---

## Features

ROAMER includes or is intended to include the following features:

- User registration, login, logout, and account management
- Email verification during registration
- Dashboard with travel overview
- Trip planning
- Flight search and flight planning
- Hotel search and hotel planning
- Activities and events management
- Calendar for travel-related entries
- Booking overview
- Budget tracking
- Analytics and travel insights
- Settings and user preferences
- Light/dark mode
- External API integration for travel-related data

---

## Visuals

The application provides a dashboard-based user interface with sidebar navigation.

Main navigation areas include:

- Dashboard
- Trips
- Flights
- Hotels
- Activities
- Budget Tracker
- Calendar
- Bookings
- Analytics
- Settings

Screenshots and additional visuals can be added later as the project develops.

---

## Installation

### Requirements

Before running the project locally, install:

- Java 21
- Node.js and npm
- Docker Desktop
- Git
- IntelliJ IDEA or another suitable IDE

---

### Project Structure

```text
project-root/
├── frontend/          Angular frontend
├── backend/           Spring Boot backend
├── docker-compose.yml Local Docker setup
└── README.md
```

---

### Environment Configuration

The backend requires a local `.env` file for sensitive configuration such as email credentials and API keys.

The file must be located at:

```text
backend/.env
```

Example structure:

```env
MAIL_USERNAME=your_sender_email@gmail.com
MAIL_PASSWORD=your_gmail_app_password
```

Important:

- Do not commit `.env`
- Each developer must create their own local `.env`
- Gmail requires an App Password, not the normal Gmail password

---

## Usage

### 1. Start Docker services

From the project root:

```powershell
docker compose up -d
```

This starts the required Docker services, including the PostgreSQL database.

Check running containers:

```powershell
docker ps
```

---

### 2. Start the backend

```powershell
cd backend
.\gradlew bootRun
```

Backend URL:

```text
http://localhost:8080
```

---

### 3. Start the frontend

Open a second terminal:

```powershell
cd frontend
ng serve
```

Frontend URL:

```text
http://localhost:4200
```

---

### 4. Open the application

Open the frontend in the browser:

```text
http://localhost:4200
```

---

## Testing

Frontend build:

```powershell
cd frontend
npm run build
```

Backend build:

```powershell
cd backend
.\gradlew build
```

API endpoints can be tested using Postman or a similar API testing tool.

---

## Database Reset

To reset the local database and delete all local test data:

```powershell
docker compose down -v
docker compose up -d
```

After resetting the database, restart the backend so the database schema can be recreated.

---

## Support

For project-related questions, team members should use:

- GitLab issues
- GitLab merge request discussions
- Team communication channels
- GitLab Wiki documentation

---

## Roadmap

Planned and ongoing improvements include:

- Extending trip planning functionality
- Improving booking management
- Improving budget tracking
- Extending analytics
- Improving user account settings
- Improving calendar integration with flights, hotels, and activities
- Refining frontend design and user experience
- Improving testing and documentation

---

## Contributing

The team uses GitLab issues, branches, commits, merge requests, and code reviews.

Typical workflow:

```text
Issue → Branch → Implementation → Commit → Push → Merge Request → Review → Merge
```

Guidelines:

- Do not push directly to `main`
- Create a branch for each issue or feature
- Use meaningful commit messages
- Open a merge request after pushing changes
- Let at least one teammate review the merge request
- Keep the Wiki updated when features change

---

## Documentation

Detailed project documentation is maintained in the GitLab Wiki.

The Wiki contains information about:

- Setup Guide
- Git Workflow
- Architecture
- User Manual / Benutzeranleitung
- Frontend Overview
- Backend Overview
- Database Overview
- API Documentation
- Testing Documentation
- Sprint Documentation
- Known Issues
- Decisions Log

---

## Authors and Acknowledgment

This project is developed by the ROAMER SEP team.

The team works collaboratively on frontend, backend, database, testing, documentation, and project management tasks.

---

## License

This project is developed for educational purposes as part of the SEP course.

---

## Project Status

ROAMER is currently under active development.

Some modules are already functional, while others are still being extended, improved, or tested.