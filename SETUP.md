# Setting it up

From nothing to a live site on Cloudflare. Follow it top to bottom the first
time; after that you only need [Everyday use](#everyday-use).

---

## 1. Install the tools (once per computer)

1. **Node.js** — download the LTS build from [nodejs.org](https://nodejs.org)
   and run the installer. Check it worked:

   ```bash
   node --version     # should print v20.x or higher
   ```

2. **Git** — [git-scm.com/downloads](https://git-scm.com/downloads).

   ```bash
   git --version
   ```

3. A **GitHub** account — [github.com](https://github.com).
4. A **Cloudflare** account — [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
   The free plan is plenty for this.

---

## 2. Get the code onto GitHub

If you already have the `WH-Program` repository on GitHub, skip to step 3.

```bash
cd path/to/WH-Program
git init
git add .
git commit -m "Itinerary builder"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/WH-Program.git
git push -u origin main
```

---

## 3. Check it runs locally first

Always confirm it works on your machine before deploying.

```bash
npm install      # once, and again whenever dependencies change
npm run dev
```

Open <http://localhost:5173>. The app loads with an empty plan and the toolbar
reports **Offline**, because `npm run dev` on its own is the interface without
the API behind it — see [Everyday use](#making-a-change) for running both. Press
<kbd>Ctrl</kbd>+<kbd>C</kbd> in the terminal to stop it.

---

## 4. The database

**Already done** — `wh-program` exists and `wrangler.jsonc` points at it, so
there is nothing to do here. This section is for the day you need a second one,
or the tables get lost.

The plan lives in a **Cloudflare D1** database, which is why everyone on every
computer sees the same thing. Its tables are defined in
[`schema.sql`](schema.sql); every statement is `IF NOT EXISTS`, so this is safe
to re-run at any time and is also how you apply a new table later:

```bash
npx wrangler login     # opens a browser to authorise, once per computer
npm run db:schema      # create or update the tables on the live database
```

To check what's there, in the Cloudflare dashboard under **Storage &
Databases → D1 → wh-program → Console**:

```sql
SELECT name FROM sqlite_master WHERE type = 'table';
```

You want `bookings`, `blocks`, `catalogue` and `settings`.

### Setting up a second copy

A staging site, or a fresh deployment somewhere else, needs its own database —
two Workers pointing at one database would share one plan:

```bash
npx wrangler d1 create wh-program-staging
```

Put the `database_name` and `database_id` it prints into `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "wh-program-staging",
    "database_id": "a1b2c3d4-...."
  }
],
```

Check it before pushing — this is the one thing here that can break a deploy:

```bash
npx wrangler deploy --dry-run
```

It should list `env.DB (wh-program-staging)   D1 Database` among the bindings.
Then `npm run db:schema` to create its tables, and commit, because Cloudflare
builds from what's in GitHub.

> The id is not a secret — it only identifies the database, and reaching it
> still needs your Cloudflare account. It belongs in the repository.

> **With no database bound at all**, the site still builds, deploys and opens.
> It just has nowhere to put anything, so it says *Nothing is saving* across
> the top with the fix spelled out. That's deliberate: a deployment that can't
> save beats a deployment that won't build.

---

## 5. Connect Cloudflare to GitHub

This is the setup to use. Cloudflare rebuilds and redeploys every time you push
— you never deploy by hand.

1. Go to the [Cloudflare dashboard](https://dash.cloudflare.com).
2. **Compute (Workers)** → **Workers & Pages** → **Create**.
3. Choose the **Import a repository** tab (not "Start with Hello World").
4. **Connect GitHub**, authorise Cloudflare, and pick `WH-Program`.
5. Set the build settings:

   | Field | Value |
   | --- | --- |
   | Project name | `wh-program` |
   | Production branch | `main` |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` |
   | Build output directory | `dist` |
   | Root directory | *(leave blank)* |

6. **Save and Deploy.**

The first build takes two or three minutes. When it finishes you get a URL like
`https://wh-program.YOUR-SUBDOMAIN.workers.dev`. That's the live app.

Open it and use **Program → Load the sample week** to check the database is
wired up. If the schools appear, and are still there when you open the same URL
on your phone, everything is working.

> **If the build fails**, open the build log in Cloudflare and read the last
> ~20 lines — it will name the problem. The usual cause is that `npm run build`
> also fails locally, so run it locally first. If the build succeeds but the
> *deploy* fails, it's almost always `wrangler.jsonc` — check
> `npx wrangler deploy --dry-run` passes.

### Deploying by hand instead

You don't need this if step 5 worked, but it's there if you want it:

```bash
npx wrangler login     # opens a browser to authorise, once
npm run deploy         # builds and uploads
```

---

## 6. Put it on your own address (optional)

To serve it at `program.woodhouse.org.au` instead of `.workers.dev`, the domain
has to be on Cloudflare:

1. Add the domain to Cloudflare (**Add a site**) and point your registrar's
   nameservers at the ones Cloudflare gives you. This can take a few hours.
2. Open the Worker → **Settings** → **Domains & Routes** → **Add** → **Custom
   domain**.
3. Enter `program.woodhouse.org.au` and save. HTTPS is handled for you.

---

## 7. Lock it down — do this one

Anyone with the URL can read **and change** the plan, because there is no login.
That was awkward when plans lived in each person's browser; now that they're
shared it matters, so put Cloudflare Access in front of the site:

1. Cloudflare dashboard → **Zero Trust** → **Access** → **Applications** →
   **Add an application** → **Self-hosted**.
2. Point it at your Worker's hostname.
3. Add a policy — *Emails ending in* `@woodhouse.org.au`, or a list of specific
   addresses.

Staff then get a one-time email code the first time they visit. The free Zero
Trust plan covers up to 50 users.

Access sits in front of the whole hostname, so it covers the API as well as the
pages — there's no back door to the database left open.

---

## Everyday use

### Making a change

```bash
git pull                       # get anything others changed
npm run dev                    # the app, with the browser reloading as you save
```

That gives you the interface on its own. It runs perfectly well like that —
it just reports itself **Offline** in the toolbar and keeps everything in your
browser, which is all you need for most interface work.

To work against a real database, run the API in a **second terminal**:

```bash
npm run db:schema:local        # once, to create the local tables
npm run dev:api                # the Worker and a local D1, on port 8787
```

`npm run dev` proxies `/api` to it. The local database is a file under
`.wrangler/` and is nothing to do with the live one, so experiment freely.

To check the real thing end to end before pushing:

```bash
npm run preview                # builds, then serves it exactly as deployed
```

When you're happy:

```bash
npm run build                  # must pass before you push
git add .
git commit -m "Describe what changed"
git push
```

Cloudflare picks up the push and redeploys within a couple of minutes.

### Trying something risky

Work on a branch so `main` always stays deployable:

```bash
git checkout -b new-idea
# ...make changes, commit...
git push -u origin new-idea
```

Cloudflare builds a **preview** URL for the branch, separate from production.
Open a pull request on GitHub, check the preview, then merge into `main` when
you're happy.

---

## Changing the app

### Adding or editing an activity

**Do this in the app** — the **Activities** page covers everything below, and
changes are saved with the program. The notes here are only for changing the
data that ships with the app, so every new program starts with it.

Edit `src/data/activities.ts`. Each entry looks like:

```ts
{
  id: 'bouldering',              // unique, never change once in use
  name: 'Bouldering',
  sites: ['woodhouse'],          // 'woodhouse' and/or 'roonka'
  colour: '#ffc000',             // from the Activities Colour Key sheet
  defaultDurationMin: 90,
  venueIds: ['bouldering-wall'], // must match an id in venues.ts
  deliveries: ['staff', 'self_led'],
  notes: 'Anything worth telling whoever is planning.',
}
```

`deliveries` decides the suffix on the printed line: `teacher_led` prints as
`- TL`, `self_led` as `- Self Led`.

### Adding a venue

Use the **Venues** page. To change the shipped list, add it to
`src/data/venues.ts` and reference its `id` from the activity.

### Changing the standard day times

`src/data/templates.ts`. `t(9, 30)` means 9:30am.

### Updating staff training

See [DATA.md](DATA.md#staff-competency).

### Changing the look

`src/index.css` holds the colour tokens. Every colour is defined once on
`:root` and again under `:root[data-theme='dark']` — change both.

---

## The database

One deployment, one shared plan. Both sites live in it — Woodhouse and Roonka
are a column on a booking, not separate databases, which is what lets the
whole-site views see across both.

| Table | Holds |
| --- | --- |
| `bookings` | One row per school stay. Groups ride along as JSON. |
| `blocks` | One row per scheduled session. |
| `catalogue` | Activities, venues and staff **added** in the app. |
| `settings` | Catalogue edits, and the revision counter. |

The catalogue that ships with the app is in the code and is never copied into
the database — only what you've added or changed on top of it. So a later
refresh of the workbook data still reaches everything you haven't overridden.

The whole schema is in [`schema.sql`](schema.sql), and every statement in it is
`IF NOT EXISTS`, so `npm run db:schema` is safe to re-run and doubles as the
migration when a table is added.

### How saving works

The app holds the whole plan in memory — that's what undo works on — but saves
**row by row**. Each change is compared against the one before it and only the
bookings and sessions that actually moved are sent. Two people planning
different schools at the same time therefore don't overwrite each other. Within
a single row, the last save wins.

Every write bumps a revision counter. Each browser checks it every ten seconds,
and whenever you come back to the tab, and re-reads the plan when it has moved.
Someone else's change lands in front of you within about ten seconds without a
refresh.

If the network drops, the app keeps working: changes queue up in your browser,
the toolbar badge turns grey and says **Offline**, and everything goes out as
soon as the connection is back — even if you closed the tab in between.

### Looking at the data directly

```bash
npx wrangler d1 execute wh-program --remote \
  --command "SELECT school_name, start_date, end_date FROM bookings ORDER BY start_date"
```

### Backups

D1 keeps point-in-time history. To take one yourself:

```bash
npx wrangler d1 export wh-program --remote --output backup.sql
```

Worth doing before anything irreversible — **Program → Start fresh** in
particular, which empties the plan for everyone.

---

## Troubleshooting

**`npm install` fails** — check `node --version` is 20 or higher. If it still
fails, delete `node_modules` and `package-lock.json` and try again.

**Cloudflare build fails but it works locally** — make sure `package-lock.json`
is committed (`git status` should not list it as untracked).

**A red bar says "Nothing is saving"** — it carries the reason. *No database
bound* means the `d1_databases` block in `wrangler.jsonc` is still commented
out, or the change hasn't been pushed and redeployed. *The database has no
tables yet* means `npm run db:schema` hasn't been run against the live
database. Everything you do meanwhile is held in your browser and will be sent
once it's fixed.

**The toolbar says "Offline"** — the app can't reach the API. Your changes are
safe in this browser and will be sent as soon as it can; click the badge to try
straight away. If it stays grey, check the deployment is healthy by opening
`/api/health` on the site — it should answer with a count of bookings.

**The plan is empty on a new computer** — open `/api/health`. If it reports
`"bookings": 0`, the database really is empty; if it errors, that's the problem
to fix first.

**Changes don't show up on the live site** — check the Cloudflare deployment
finished and succeeded, then hard-refresh (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>).

**A drag does nothing** — activities can only be dropped on a group column, and
a school must be selected. In *Whole site* view, drop onto a school's own
columns.
