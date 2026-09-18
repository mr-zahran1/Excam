# GitHub → Cloudflare setup

1. Create a new GitHub repository and upload the contents of this folder to the repository root.
2. In Cloudflare Dashboard open Workers & Pages → Create → Import a repository.
3. Select the GitHub repository.
4. Keep the deployment command as `npx wrangler deploy` (or `npm run deploy`).
5. Before the first successful deploy, replace your D1 database ID in `wrangler.toml` with the D1 database ID created in Cloudflare.
6. Create the D1 database with the same name shown in `wrangler.toml`: `english-teacher-db`.
7. Apply all migrations in `migrations/` to the remote D1 database. You can use Cloudflare D1 Console to run the migration SQL, or Wrangler if you later use a local terminal.
8. In Workers → Settings → Variables and Secrets, add `ADMIN_BOOTSTRAP_SECRET` as an encrypted secret.
9. Deploy again.
10. Create the first super admin using the one-time `/api/setup/admin` endpoint with the secret. After the first admin exists, the endpoint permanently locks itself.

Do not commit the real D1 ID or any secret to a public repository.

11. After this version, keep all migrations in `migrations/` and run `npx wrangler d1 migrations apply DB --remote` before or during deployment.
