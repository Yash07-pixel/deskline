# Deskline

Deskline is an internal ticketing tool prototype for employee support requests across IT, HR, Finance, and Admin. Employees can raise tickets, agents can manage department queues, and the app includes notifications, AI assistance, analytics, search/filtering, SLA indicators, activity timelines, satisfaction ratings, internal notes, and CSV export.

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: SQLite via `better-sqlite3`
- AI: Google Gemini via `@google/generative-ai`

## Local Setup

Install dependencies:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

Create `backend/.env` from `backend/.env.example`:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
FRONTEND_URL=http://localhost:5173
```

Run both servers from the project root:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

The backend runs on `http://localhost:3001`, and Vite proxies local `/api` requests to it.


## Features

- Employee ticket creation with title, description, category, urgency, and employee name
- Employee My Tickets view with expandable ticket details
- Notification bell for ticket status changes
- Agent department queue for IT, HR, Finance, and Admin
- Ticket lifecycle: Open -> In Progress -> Resolved -> Closed
- Agent response drafting and private internal notes
- Search and filters by text, status, and urgency
- Ticket activity timeline
- SLA indicators in the agent queue
- Satisfaction rating for resolved/closed tickets
- Analytics dashboard with Recharts
- CSV export from analytics
- Recent activity feed

## AI Layer

Gemini is called only from the backend. The API key is never exposed to the frontend.

AI features include:

- Category suggestion from ticket description
- Similar resolved ticket surfacing
- Draft first response for agents
- Different draft responses depending on target status, such as In Progress versus Resolved

If Gemini quota is unavailable or the request fails, Deskline uses graceful local fallback logic so the demo still works.

## Sample Data

The app creates a SQLite database at:

```text
backend/data/deskline.sqlite
```

By default, the database can start empty. Run the sample seed command to add a realistic mix of Open, In Progress, Resolved, and Closed tickets so the analytics dashboard has data immediately.

The seed script is idempotent and will not duplicate the sample set if it already exists.

## Architecture

The backend keeps SQL and data access inside `backend/src/db`, with route handlers in `backend/src/routes`. The Gemini wrapper lives in `backend/src/services/geminiService.ts`. The frontend uses React Router, shared TypeScript types, a typed API client, CSS variables for the design system, and Recharts for dashboard visualizations.

## Demo Flow

1. Open the app.
2. Show the Analytics dashboard with sample data.
3. Raise a new ticket as an employee.
4. Show category suggestion and similar-ticket surfacing.
5. Go to Agent Queue and select the matching department.
6. Open the ticket drawer.
7. Show SLA, activity timeline, draft response, and internal notes.
8. Move the ticket to In Progress or Resolved.
9. Return to My Tickets.
10. Show updated status, agent response, notification, timeline, and satisfaction rating.
11. Return to Analytics to show updated counts and export CSV.
