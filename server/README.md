# Express + TypeScript Production Template

You are an expert backend engineer. Generate a complete, ready-to-run production-grade Express + TypeScript backend template repository that follows best practices for scalability, security, observability and developer ergonomics. Output ONLY the repository file tree with full file contents (no extra commentary). The repo must be runnable after `npm install` and include multi-stage Dockerfile, a GitHub Actions CI workflow, and tests.

Requirements and constraints:
- Node LTS, TypeScript, Express (latest stable). Use minimal but well-supported libraries.
- Project must be TypeScript-first and strongly typed. No any for public types.
- Use pino for structured logging and include request-id correlation (attach request id to logs).
- Centralized config using dotenv with `env.example`.
- Implement robust error handling middleware with typed API error responses (HTTP status, code, message, details).
- Implement Basic auth using best tools so it scalable and best and free. Keep secrets in env.
- Provide security middleware: helmet, cors, rate-limiter, compression.
- Add graceful shutdown on SIGINT/SIGTERM and proper connection close hooks (DB, message queues).
- Add GitHub Actions workflow that runs lint, build, test, and outputs coverage.
- Provide a clear folder layout: `src/controllers`, `src/services`, `src/middleware`, `src/routes`, `src/lib` (logger, config, db), `src/types`. and structure must be simple not too complex.
- Use Prisma OR to Connect with database ORM
- Provide example environment variables and `.env.example`.
- Provide clear npm scripts: `build`, `start`, `dev`, `lint`.
- Keep production settings secure by default (no hard-coded secrets).
- log each request in database table which can log everything like a pro level logging so we can know everything about api request 
- use all latest version of each package
- no need of documation and no test framework like jest 

Output format:
- Print the repository tree and each file content in a way that can be recreated exactly (e.g., show file paths and full contents).
- Do NOT include explanations outside the repo content.
- Keep code concise but complete and runnable.

Performance/security extras (must include):
- Use pino-http with log level via env.
- Add request-logging and error logging context.
- Use helmet with sane defaults + CORS config read from env.
- Rate limit with express-rate-limit and allow override via env.
- Ensure input validation errors map to 400 with structured error body.
- Provide a simple middleware to add a correlation ID (use `x-request-id`) if absent.

Make the generated repository production-ready and easy to extend by an engineering team.

## Features

- **TypeScript-first** - Strongly typed with strict TypeScript configuration
- **Security** - Helmet, CORS, rate limiting, bcrypt password hashing, JWT authentication
- **Logging** - Pino structured logging with request correlation IDs + database persistence
- **Database** - Prisma ORM with PostgreSQL, automatic migrations
- **Authentication** - JWT + Basic auth for admin endpoints
- **Error Handling** - Centralized error handling with typed API responses
- **DevOps** - Multi-stage Dockerfile, GitHub Actions CI/CD
- **Graceful Shutdown** - Proper connection cleanup on SIGTERM/SIGINT

## Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd express-template
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and secrets
   ```

3. **Set up database:**
   ```bash
   npm run db:push
   npm run db:generate
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## API Endpoints

### Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - Login user

### Users (JWT required)
- `GET /api/users/me` - Get current user
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

### Health & Monitoring
- `GET /api/health` - Health check
- `GET /api/logs` - Request logs (basic auth required)

## Environment Variables

See `.env.example` for all required environment variables.

## Docker

Build and run with Docker:
```bash
docker build -t express-template .
docker run -p 3000:3000 express-template
```

## Production Deployment

The template includes a complete CI/CD pipeline with:
- Automated testing and linting
- Security scanning
- Multi-architecture Docker builds
- Container registry publishing

Ready for deployment to any container orchestration platform.

## License

MIT