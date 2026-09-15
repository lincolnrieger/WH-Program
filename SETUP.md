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

Open <http://localhost:5173>. You should see the sample week. Press
<kbd>Ctrl</kbd>+<kbd>C</kbd> in the terminal to stop it.

---

## 4. Connect Cloudflare to GitHub

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

> **If the build fails**, open the build log in Cloudflare and read the last
> ~20 lines — it will name the problem. The usual cause is that `npm run build`
> also fails locally, so run it locally first.

### Deploying by hand instead

You don't need this if step 4 worked, but it's there if you want it:

```bash
npx wrangler login     # opens a browser to authorise, once
npm run deploy         # builds and uploads
```

---

## 5. Put it on your own address (optional)

To serve it at `program.woodhouse.org.au` instead of `.workers.dev`, the domain
has to be on Cloudflare:

1. Add the domain to Cloudflare (**Add a site**) and point your registrar's
   nameservers at the ones Cloudflare gives you. This can take a few hours.
2. Open the Worker → **Settings** → **Domains & Routes** → **Add** → **Custom
   domain**.
3. Enter `program.woodhouse.org.au` and save. HTTPS is handled for you.

---

## 6. Lock it down (recommended)

By default anyone with the URL can open the app. To restrict it to your staff:

1. Cloudflare dashboard → **Zero Trust** → **Access** → **Applications** →
   **Add an application** → **Self-hosted**.
2. Point it at your Worker's hostname.
3. Add a policy — *Emails ending in* `@woodhouse.org.au`, or a list of specific
   addresses.

Staff then get a one-time email code the first time they visit. The free Zero
Trust plan covers up to 50 users.

Worth knowing: plans are stored in each person's own browser, so access control
protects the app, not the data. Whoever is doing the planning keeps the master
copy — see **File → Save to file**.

---

## Everyday use

### Making a change

```bash
git pull                       # get anything others changed
npm run dev                    # edit, with the browser reloading as you save
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
  category: 'adventure',
  colour: '#ffc000',             // from the Activities Colour Key sheet
  defaultDurationMin: 90,
  setupMin: 5,
  packdownMin: 5,
  venueIds: ['bouldering-wall'], // must match an id in venues.ts
  capacity: 30,                  // omit if uncapped
  minStaff: 1,
  exclusive: true,               // only one group on site can do it at a time
  conflictsWith: [],             // ids that mustn't run at the same time
  deliveries: ['staff', 'self_led'],
}
```

`conflictsWith` only needs to be set on one side of a pair — the check looks
both ways.

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

## Next step: shared plans across staff

Right now each person's plan lives in their own browser. Making plans shared
means adding a small backend, which this project is already shaped for: the
Worker that serves the app can also answer API requests, and all document
reading and writing already goes through one file, `src/store/persist.ts`.

Roughly:

1. Create a D1 database and bind it in `wrangler.jsonc`:

   ```bash
   npx wrangler d1 create wh-program
   ```

2. Add a Worker entry point (`src/worker.ts`) with `GET`/`PUT /api/program/:id`
   reading and writing a JSON blob, and point `main` at it in `wrangler.jsonc`.
3. Change `loadDocument` / `saveDocument` in `persist.ts` to call those
   endpoints, keeping `localStorage` as an offline cache.
4. Use the Cloudflare Access identity from step 6 to know who's editing.

Keep the `ProgramDocument` shape as it is and the rest of the app won't need to
change.

---

## Troubleshooting

**`npm install` fails** — check `node --version` is 20 or higher. If it still
fails, delete `node_modules` and `package-lock.json` and try again.

**Cloudflare build fails but it works locally** — make sure `package-lock.json`
is committed (`git status` should not list it as untracked).

**The app loads but the plan is gone** — plans are per browser. Check you're on
the same browser and profile, and that site data wasn't cleared. If you have a
`.json` export, **File → Open saved file**.

**Changes don't show up on the live site** — check the Cloudflare deployment
finished and succeeded, then hard-refresh (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>).

**A drag does nothing** — activities can only be dropped on a group column, and
a school must be selected. In *Whole site* view, drop onto a school's own
columns.
