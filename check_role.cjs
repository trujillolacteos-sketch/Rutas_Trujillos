const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT * FROM users").then(res => { console.log(res.rows); process.exit(0); }).catch(console.error);
