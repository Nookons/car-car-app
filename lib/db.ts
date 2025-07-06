// lib/db.ts
import { Pool } from 'pg';

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: 6543,
    ssl: {
        rejectUnauthorized: false,
    },
});

export default pool;
