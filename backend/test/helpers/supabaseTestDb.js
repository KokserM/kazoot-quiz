// Real Postgres (PGlite) with the parts of Supabase that our SQL relies on:
// the anon/authenticated/service_role roles, Supabase's default privileges,
// auth.users, and auth.uid() driven by the request JWT claim.
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const SUPABASE_BOOTSTRAP = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const MIGRATIONS = ['001_ai_cost_controls.sql', '003_launch_hardening.sql'];

async function createSupabaseTestDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_BOOTSTRAP);
  for (const file of MIGRATIONS) {
    await db.exec(fs.readFileSync(path.join(__dirname, '../../db', file), 'utf8'));
  }

  async function asRole(role, userId, fn) {
    await db.exec(`set role ${role}`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId || '']);
    try {
      return await fn();
    } finally {
      await db.exec('reset role');
      await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    }
  }

  async function createUser(id, email = `${id.slice(0, 8)}@example.com`) {
    await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
    await db.query('insert into public.profiles (id, email) values ($1, $2)', [id, email]);
  }

  return { db, asRole, createUser };
}

module.exports = { createSupabaseTestDb };
