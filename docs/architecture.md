# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

Record your plan here before editing code.

- Presentation tier decision: Build route-specific React components that use `src/api/client.ts` for every API request. Keep the shared fetch behavior and URL construction in the client, render loading, empty, success, and error states accessibly, and keep Bootstrap markup in the presentation components rather than the API or data layers.
- Logic tier decision: Keep Express routes thin and use explicit functions in `octofitService.ts` for validation and business behavior. Routes will translate service results and expected client errors into the existing `/api` JSON response shapes, while Mongoose handles persisted-data validation.
- Data tier decision: Use Mongoose schemas and models for `User`, `Team`, `Activity`, and `Workout`, with required fields and ObjectId references matching the API contract. Use the shared MongoDB configuration and stable, idempotent upsert-based seed fixtures that preserve unrelated data and reconcile a seeded user's team membership.
- Activity tracking approach: Validate `userId`, `teamId`, `type`, and `minutes` in the service before model creation. Only accept well-formed ObjectIds that identify existing users and teams, return a 4xx for malformed or missing references, and create activities with computed positive points and an `occurredAt` timestamp.
- Team management approach: Require a team name and mascot, default `members` to an empty array, accept valid member ObjectIds, and expose the submitted name, mascot, and member IDs from both create and list responses. Return `400` for a missing or invalid team payload.
- Leaderboard approach: Aggregate activity points by team in the service, sort descending by `totalPoints`, assign 1-based ranks in sorted order, and return entries containing `teamName`, `totalPoints`, and `rank`.
- Workout suggestions approach: Look up the exact seeded user by email and return a 4xx for no match. Determine the user's dominant recent activity or fitness goal, select matching workout records, and explain the match in each suggestion's `reason`; make the returned array deterministic enough that the first suggestion satisfies the contract.

## Test plan

Record the commands you run and what each failure means.

- Data-tier command: `npm run test:data --prefix octofit-tracker/backend`
  - Verifies Mongoose required fields, stable seeded relationships, and idempotent seed behavior in isolated MongoDB memory storage.
  - Failure means a model contract, seed fixture, or demo-user team reconciliation is incomplete or overwrites unrelated records.
- API command: `npm run test:api --prefix octofit-tracker/backend`
  - Verifies create/list behavior, invalid-activity 4xx responses, leaderboard ordering, and email-based workout matching through Express.
  - Failure means route/service validation or the service implementation does not satisfy the API contract, or that no data exists for a capability.
- Frontend command: `npm test --prefix octofit-tracker/frontend`
  - Verifies route rendering and meaningful loading, empty, success, and accessible error states using component tests.
  - Failure means a presentation component, shared API fetch behavior, or route is not satisfying the UI contract.
- Backend build command: `npm run build --prefix octofit-tracker/backend`
  - Runs the TypeScript no-emit build to catch service, route, model, and test type errors.
  - Failure means a backend type or module error must be corrected before runtime verification.
- Frontend build command: `npm run build --prefix octofit-tracker/frontend`
  - Runs the TypeScript no-emit check and Vite production build.
  - Failure means a React component, route, API client, or frontend type/module issue blocks deployment.
