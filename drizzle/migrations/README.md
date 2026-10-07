# Migrations

This folder is intentionally empty of SQL on a fresh clone.

## Why there are no `.sql` files yet

The project ships with **schema push** as its default workflow:

```bash
pnpm db:push        # drizzle-kit push — syncs drizzle/schema.ts → the database
```

`postinstall` runs `drizzle-kit push --force || true` on every install, which is what lets a
first `vercel --prod` provision its own tables without a manual migration step. The `|| true`
is deliberate: the install must not fail when the database is unreachable or not yet
configured (a local `pnpm build` with no `POSTGRES_URL`, for example).

Push is safe while the schema is still moving and there is no data worth protecting.

## When to switch to migrations

Once the deployment holds data you care about, stop pushing and start committing numbered
migrations. Drizzle writes them here:

```bash
pnpm db:generate        # diff schema.ts against the last migration → 0000_*.sql here
pnpm db:migrate         # apply every pending migration, in order
```

Commit the generated `.sql` files and the `meta/` journal. From that point on:

1. edit `lib/db/schema.ts`
2. `pnpm db:generate` and **read the generated SQL** — Drizzle cannot tell a rename from a
   drop-and-add, so it will ask
3. `pnpm db:migrate` against a staging database first
4. remove the `postinstall` push (or keep it, but it will fight your migrations)

## Ground rules

- **Never edit a migration that has already run in production.** Add a new one.
- Migrations are applied by `drizzle-kit migrate` from `drizzle.config.ts`, which reads the
  same `POSTGRES_URL`/`DATABASE_URL` fallback chain as the application.
- The 19 tables, their indexes and the foreign keys with their `onDelete` behaviour all live
  in `lib/db/schema.ts` — that file is the single source of truth, not this folder.
- Destructive changes (dropping a column that holds encrypted provider keys) need a backup
  first: `GET /api/admin/system` → backup, or the *Backup* button in **Admin → System**.
