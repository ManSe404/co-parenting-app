# co-parenting-app

Two parents who look after one child separately still decide together about school, health, activities and who has
the child when, but in a chat those decisions get lost and one parent can change a plan alone. This app gives both
parents one shared space for questions and agreements, the calendar, the child's record and documents, where nothing
that concerns both changes without the other parent's consent, a rule the database enforces, not only the screens.
The problem, the solution and why it is built this way: [docs/product/vision.md](docs/product/vision.md). The
interface is in Serbian (Latin script).

It is for the two parents of one child, and for anyone who wants to run their own copy for their family on a free
Supabase project.

**Try it without an account:** https://manse404.github.io/co-parenting-app/?demo=1. The demo runs on example data
in your browser; the Tata / Mama switcher at the top lets you play both parents.

## Run it in five minutes

```bash
npm install
npm run dev         # http://127.0.0.1:8040, demo data in the browser
```

With a local database (needs Docker): `npm run baza`, then `npm run dev:baza`. Details are in
[docs/guides/setup.md](docs/guides/setup.md); deploying your own copy is in
[docs/operations/deployment.md](docs/operations/deployment.md).

## Documentation

Start at [docs/README.md](docs/README.md): what the app does, how it is built and protected, the map of the code,
the checks and the roadmap.

## Licence

[MIT](LICENSE)
