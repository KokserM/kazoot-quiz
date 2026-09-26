// Integration tests for the Supabase schema, RLS policies, and credit functions
// running on real Postgres (PGlite).
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createSupabaseTestDb } = require('./helpers/supabaseTestDb');

const MONTH_START = '2000-01-01T00:00:00Z';

async function reserve(db, userId, { freeLimit = 3, cost = 1, generationId = randomUUID() } = {}) {
  const { rows } = await db.query(
    `select public.kz_reserve_generation($1, $2, 'Topic', 'English', 'model', '1.2.3.4', $3, $4, $5) as r`,
    [generationId, userId, freeLimit, cost, MONTH_START]
  );
  return { generationId, ...rows[0].r };
}

async function grant(db, userId, sourceId, credits, { type = 'pack', expiresAt = null } = {}) {
  const { rows } = await db.query(
    `select public.kz_grant_credits($1, $2, $3, $4, $5, 'test_grant', '{}'::jsonb) as inserted`,
    [userId, sourceId, type, credits, expiresAt]
  );
  return rows[0].inserted;
}

async function remaining(db, userId) {
  const { rows } = await db.query(
    `select coalesce(sum(remaining_credits), 0)::int as n from public.credit_grants
     where user_id = $1 and (expires_at is null or expires_at > now())`,
    [userId]
  );
  return rows[0].n;
}

test('RLS: users read only their own billing rows and cannot write any of them', async () => {
  const { db, asRole, createUser } = await createSupabaseTestDb();
  const alice = randomUUID();
  const bob = randomUUID();
  await createUser(alice);
  await createUser(bob);
  await grant(db, alice, 'cs_alice', 20);
  await grant(db, bob, 'cs_bob', 20);
  await db.query(
    `insert into public.payments (stripe_event_id, user_id, status) values ('evt_a', $1, 'paid'), ('evt_b', $2, 'paid')`,
    [alice, bob]
  );

  await asRole('authenticated', alice, async () => {
    const grants = await db.query('select user_id from public.credit_grants');
    assert.deepEqual(grants.rows.map((row) => row.user_id), [alice]);
    const payments = await db.query('select user_id from public.payments');
    assert.deepEqual(payments.rows.map((row) => row.user_id), [alice]);
    const profiles = await db.query('select id from public.profiles');
    assert.deepEqual(profiles.rows.map((row) => row.id), [alice]);

    // Writes silently affect nothing (no UPDATE policy) or are rejected (no INSERT policy).
    const grantUpdate = await db.query(`update public.credit_grants set remaining_credits = 9999 returning id`);
    assert.equal(grantUpdate.rows.length, 0);
    const profileUpdate = await db.query(`update public.profiles set stripe_customer_id = 'cus_victim' returning id`);
    assert.equal(profileUpdate.rows.length, 0, 'profiles must not be client-writable after 003');
    await assert.rejects(
      db.query(`insert into public.credit_grants (user_id, source_id, grant_type, original_credits, remaining_credits) values ($1, 'x', 'manual', 5, 5)`, [alice]),
      /row-level security/
    );
    await assert.rejects(
      db.query(`insert into public.subscriptions (user_id, stripe_customer_id, tier, status) values ($1, 'cus', 'pro', 'active')`, [alice]),
      /row-level security/
    );
    const cache = await db.query('select * from public.quiz_cache');
    assert.equal(cache.rows.length, 0);
    const events = await db.query('select * from public.product_events');
    assert.equal(events.rows.length, 0);
  });

  await asRole('anon', null, async () => {
    for (const table of ['profiles', 'credit_grants', 'usage_ledger', 'payments', 'subscriptions', 'quiz_generations']) {
      const { rows } = await db.query(`select * from public.${table}`);
      assert.equal(rows.length, 0, `anon must not read ${table}`);
    }
  });

  assert.equal(await remaining(db, alice), 20);
});

test('credit functions cannot be executed by anon or authenticated users', async () => {
  const { db, asRole, createUser } = await createSupabaseTestDb();
  const alice = randomUUID();
  await createUser(alice);

  for (const role of ['anon', 'authenticated']) {
    await asRole(role, alice, async () => {
      await assert.rejects(
        db.query(`select public.kz_grant_credits($1, 'free', 'manual', 1000, null, 'x', '{}'::jsonb)`, [alice]),
        /permission denied/
      );
      await assert.rejects(db.query(`select public.kz_release_stale_generations(0)`), /permission denied/);
    });
  }

  await asRole('service_role', null, async () => {
    assert.equal(await grant(db, alice, 'svc', 5), true);
  });
});

test('free quota is used first, then the soonest-expiring paid credits', async () => {
  const { db, createUser } = await createSupabaseTestDb();
  const user = randomUUID();
  await createUser(user);
  const soon = new Date(Date.now() + 86_400_000).toISOString();
  const later = new Date(Date.now() + 30 * 86_400_000).toISOString();
  await grant(db, user, 'never', 2);
  await grant(db, user, 'later', 2, { type: 'subscription', expiresAt: later });
  await grant(db, user, 'soon', 1, { expiresAt: soon });

  const modes = [];
  for (let index = 0; index < 3; index += 1) {
    modes.push((await reserve(db, user)).mode);
  }
  assert.deepEqual(modes, ['free_quota', 'free_quota', 'free_quota']);
  assert.equal(await remaining(db, user), 5);

  const fourth = await reserve(db, user);
  assert.equal(fourth.mode, 'paid_credit');
  const { rows: [soonGrant] } = await db.query(`select remaining_credits from credit_grants where source_id = 'soon'`);
  assert.equal(soonGrant.remaining_credits, 0, 'soonest-expiring grant is spent first');

  await reserve(db, user);
  await reserve(db, user);
  const { rows: [neverGrant] } = await db.query(`select remaining_credits from credit_grants where source_id = 'never'`);
  assert.equal(neverGrant.remaining_credits, 2, 'non-expiring credits are spent last');
});

test('reservations fail atomically when credits run out and never go negative', async () => {
  const { db, createUser } = await createSupabaseTestDb();
  const user = randomUUID();
  await createUser(user);
  await grant(db, user, 'pack', 2);

  const results = await Promise.allSettled(
    Array.from({ length: 6 }, () => reserve(db, user, { freeLimit: 0 }))
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 2);
  for (const failure of results.filter((r) => r.status === 'rejected')) {
    assert.match(failure.reason.message, /insufficient_credits/);
  }
  assert.equal(await remaining(db, user), 0);
  const { rows: [counts] } = await db.query(
    `select count(*)::int as reserved from quiz_generations where user_id = $1`, [user]
  );
  assert.equal(counts.reserved, 2, 'failed reservations leave no generation rows behind');
});

test('release restores paid credits exactly once and completion cannot follow release', async () => {
  const { db, createUser } = await createSupabaseTestDb();
  const user = randomUUID();
  await createUser(user);
  await grant(db, user, 'pack', 3);
  const reservation = await reserve(db, user, { freeLimit: 0 });
  assert.equal(await remaining(db, user), 2);

  const first = await db.query(`select public.kz_release_generation($1, 'boom') as ok`, [reservation.generationId]);
  const second = await db.query(`select public.kz_release_generation($1, 'boom again') as ok`, [reservation.generationId]);
  assert.equal(first.rows[0].ok, true);
  assert.equal(second.rows[0].ok, false);
  assert.equal(await remaining(db, user), 3);

  const completed = await db.query(`select public.kz_complete_generation($1, 1, 1, 0.01) as ok`, [reservation.generationId]);
  assert.equal(completed.rows[0].ok, false);
  const { rows: [row] } = await db.query(`select status from quiz_generations where id = $1`, [reservation.generationId]);
  assert.equal(row.status, 'refunded');

  const ledger = await db.query(`select sum(delta)::int as net from usage_ledger where user_id = $1`, [user]);
  assert.equal(ledger.rows[0].net, 3, 'ledger nets back to the granted amount');
});

test('released free-quota reservations give the free game back', async () => {
  const { db, createUser } = await createSupabaseTestDb();
  const user = randomUUID();
  await createUser(user);
  const first = await reserve(db, user, { freeLimit: 1 });
  await db.query(`select public.kz_release_generation($1, 'failed')`, [first.generationId]);
  const retry = await reserve(db, user, { freeLimit: 1 });
  assert.equal(retry.mode, 'free_quota');
});

test('stale reservations from a crashed process are released', async () => {
  const { db, createUser } = await createSupabaseTestDb();
  const user = randomUUID();
  await createUser(user);
  await grant(db, user, 'pack', 1);
  const stale = await reserve(db, user, { freeLimit: 0 });
  await db.query(`update quiz_generations set created_at = now() - interval '1 hour' where id = $1`, [stale.generationId]);

  const { rows } = await db.query('select public.kz_release_stale_generations(600) as n');
  assert.equal(rows[0].n, 1);
  assert.equal(await remaining(db, user), 1);
});

test('grants are idempotent per source and revocation removes only unused credits', async () => {
  const { db, createUser } = await createSupabaseTestDb();
  const user = randomUUID();
  await createUser(user);
  assert.equal(await grant(db, user, 'cs_1', 20), true);
  assert.equal(await grant(db, user, 'cs_1', 20), false, 'webhook replay grants nothing');
  assert.equal(await remaining(db, user), 20);

  for (let index = 0; index < 5; index += 1) {
    await reserve(db, user, { freeLimit: 0 });
  }
  const { rows: [partial] } = await db.query(`select public.kz_revoke_grant('cs_1', 5, 'refund:re_1') as n`);
  assert.equal(partial.n, 5);
  const { rows: [replayed] } = await db.query(`select public.kz_revoke_grant('cs_1', 5, 'refund:re_1') as n`);
  assert.equal(replayed.n, 0, 'replaying the same refund removes nothing');
  const { rows: [rest] } = await db.query(`select public.kz_revoke_grant('cs_1', null, 'dispute:dp_1') as n`);
  assert.equal(rest.n, 10);
  const { rows: [again] } = await db.query(`select public.kz_revoke_grant('cs_1', null, 'dispute:dp_1') as n`);
  assert.equal(again.n, 0);
  assert.equal(await remaining(db, user), 0);
});
