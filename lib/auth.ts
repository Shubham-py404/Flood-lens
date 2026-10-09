/**
 * Authentication and User Identity Helper for FloodLens
 *
 * Current State:
 * AWS Cognito authentication integration is pending client-side login implementation.
 * In accordance with Section 6 of the specification, this module cleanly isolates
 * user-identity resolution so full Cognito JWT verification can be swapped in
 * server-side without modifying route handlers or UI logic.
 */

export const DEFAULT_MVP_USER_ID = 'demo-citizen-user-001';

/**
 * Extracts and resolves the current user's identifier from the request context.
 *
 * Checks in order of priority:
 * 1. Bearer token in Authorization header (Cognito Sub when JWT is verified)
 * 2. `x-user-id` header (for internal testing / client session)
 * 3. Cookie `floodlens_user_id`
 * 4. Fallback to documented MVP user identity (`demo-citizen-user-001`)
 */
export function getAuthenticatedUserId(request: Request): string {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        // If a direct user ID / sub is passed as bearer token in testing/mock
        if (token && !token.includes('.')) {
            return token;
        }
        // In full Cognito environment, JWT payload can be decoded here:
        // const payload = jwt.decode(token);
        // if (payload?.sub) return payload.sub;
    }

    const headerUserId = request.headers.get('x-user-id');
    if (headerUserId && headerUserId.trim().length > 0) {
        return headerUserId.trim();
    }

    // Check cookie if available
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
        const cookies = cookieHeader.split(';').map((c) => c.trim());
        for (const cookie of cookies) {
            if (cookie.startsWith('floodlens_user_id=')) {
                const val = decodeURIComponent(cookie.substring('floodlens_user_id='.length));
                if (val) return val;
            }
        }
    }

    return DEFAULT_MVP_USER_ID;
}
