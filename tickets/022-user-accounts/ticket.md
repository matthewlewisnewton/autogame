# User Accounts

Add a system for user accounts where players can register, log in, and have their characters saved to the newly created persistence layer.

## Difficulty: hard

## Acceptance Criteria
- Implement a secure user registration and login flow.
- Securely store user passwords (hashed and salted, e.g., using `bcrypt`).
- Authenticate WebSocket connections using a token or session identifier.
- Tie in-game characters directly to the authenticated user's account ID.
- Automatically load the correct character from the persistence layer upon successful login, and save it back upon state changes or disconnect.

## Potential Solutions

### Solution 1: JWT (JSON Web Token) over WebSocket (Recommended)
*   **Description:** When a user logs in via a simple REST endpoint or a pre-auth socket event, the server issues a JWT. The client then passes this JWT in the Socket.IO `auth` payload during the connection handshake.
*   **Pros:** Stateless authentication on the backend; standard practice for real-time apps; integrates seamlessly with our current Socket.IO architecture.
*   **Cons:** Requires managing token expiration and implementing strategies for token revocation if needed.

### Solution 2: Session-based Auth via Express + Socket.IO Shared Sessions
*   **Description:** Use traditional cookie-based sessions with Express, and share the session store with Socket.IO to authenticate incoming websocket connections.
*   **Pros:** Secure, traditional, and has built-in expiration/revocation; works very well if the game has a heavy REST API alongside the websockets.
*   **Cons:** Harder to set up shared session stores across Express and Socket.IO; can cause headaches with CORS if the frontend and backend are ever hosted on different domains.

### Solution 3: Third-Party OAuth (Discord / Google)
*   **Description:** Allow users to log in using their existing Discord or Google accounts.
*   **Pros:** Highly secure; players don't need to remember a new password.
*   **Cons:** Significant implementation overhead for a feature that doesn't add core gameplay value right now; requires registering OAuth applications with third parties.

## Technical Specs
- **Files to modify**: Server auth and session management, client login/registration UI, persistence data models.
