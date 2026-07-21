# How to Run the Budget App

## Start it

Open Terminal and run:

```bash
cd "/Users/sebimcfarland/Desktop/Budgeting Project"
bash start.sh
```

That's it. The script creates the `.venv` (first time only), installs deps, and starts Flask.

## Open it in your browser

Once you see `Running on http://127.0.0.1:5001`, open this in any browser:

**[http://127.0.0.1:5001](http://127.0.0.1:5001)**

(Not port 5000 — Apple's AirPlay grabs that on macOS. We use **5001**.)

## Stop it

In the Terminal window: press `Ctrl + C`.

---

## 🛠 Fix: "Address already in use" / "Port 5001 already in use"

This means an old server is still running in the background. Kill it with:

```bash
lsof -i :5001 -t | xargs kill -9
```

Then start the app again:

```bash
bash start.sh
```

### What that command does

- `lsof -i :5001 -t` — finds the process IDs using port 5001
- `xargs kill -9` — force-quits them

Safe to run anytime. If nothing's using the port, it just does nothing.

---

## 🛠 Fix: nothing loads in the browser

1. Check the Terminal — is Flask actually running? You should see `Running on http://127.0.0.1:5001`.
2. If you see a Python error instead, copy it and ask an AI agent to fix it.
3. Make sure you typed `127.0.0.1:5001`, not `localhost:5000`.

---

## 🛠 Fix: "command not found: python3" or similar

You're not in the project folder. Run:

```bash
cd "/Users/sebimcfarland/Desktop/Budgeting Project"
```

then try again.