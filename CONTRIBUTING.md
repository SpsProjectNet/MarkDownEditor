# Contributing

Thanks for your interest in contributing to **Markdown Editor**!

To keep the project stable, **no change is applied directly to the `main` branch**: every contribution goes through a Pull Request that must be **reviewed and approved** by a maintainer before it can be merged.

## Workflow

1. **Fork** the repository (or, if you are a collaborator, create a branch).
2. **Create a descriptive branch** from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```
3. **Make your changes** and commit with clear messages:
   ```bash
   git commit -m "Add ..."
   ```
4. **Push the branch** and open a **Pull Request** against `main`:
   ```bash
   git push origin feature/my-feature
   ```
5. Wait for **review**. A maintainer may request changes, or approve and merge.

## Requirements for a PR to be accepted

- The PR must target `main`.
- It must receive at least **1 approval** from a maintainer.
- All review conversations must be resolved.

## Running locally

```bash
npm install
npm start
```

## Build

```bash
npm run dist:win    # Windows
npm run dist:mac    # macOS
npm run dist:linux  # Linux
```
