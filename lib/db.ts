import { Pool, QueryResult, QueryResultRow } from 'pg';

declare global {
    // eslint-disable-next-line no-var
    var globalPgPool: Pool | undefined;
}

const pool =
    global.globalPgPool ||
    new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl:
            process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('amazonaws.com')
                ? { rejectUnauthorized: false }
                : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    });

if (process.env.NODE_ENV !== 'production') {
    global.globalPgPool = pool;
}

export async function query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
): Promise<QueryResult<T>> {
    const start = Date.now();
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
        console.log('[DB Query]', { text: text.trim().substring(0, 100), duration: `${duration}ms`, rows: res.rowCount });
    }

    return res;
}

export default pool;