# Persistence

Add a persistence layer to the backend to save game state, which will pave the way for persistent user accounts.

## Difficulty: hard

## Acceptance Criteria
- Define an abstract storage interface (e.g., a `StorageProvider` class) so the actual database implementation can be swapped out later if needed.
- Implement a persistence layer capable of storing player data, inventory, loadouts, and location.
- Persist data upon key events (e.g., zone transitions, leveling up, logout) and/or on a periodic timer.
- Ensure atomic saves or backups so that a server crash does not corrupt player data.

## Potential Solutions

### Solution 1: Flat JSON Files
*   **Description:** The server keeps all state in memory and periodically writes it to a `.json` file on the disk.
*   **Pros:** Extremely simple to implement; requires no external dependencies or database server; very easy to inspect and debug.
*   **Cons:** Scales poorly with concurrent writes or large numbers of accounts; lacks complex querying capabilities; high risk of data corruption if the server crashes mid-write.

### Solution 2: SQLite (Recommended)
*   **Description:** Use SQLite (possibly with an ORM like Prisma or a query builder like Knex) to store game state in a local file-based relational database.
*   **Pros:** Fully functional relational database without requiring a separate server process; supports ACID transactions to prevent data corruption; decent performance for small to medium projects.
*   **Cons:** Slightly more complex setup than JSON files; requires defining schemas.

### Solution 3: External Database Daemon (Redis / PostgreSQL / MongoDB)
*   **Description:** Run a dedicated database server to handle persistence.
*   **Pros:** Industry standard for production environments; scales to thousands of concurrent users; incredibly robust.
*   **Cons:** Overkill for an early development phase; requires running and managing a separate daemon, which complicates the local dev environment and deployment.

## Technical Specs
- **Files to modify**: New persistence modules in `game/server/`.
