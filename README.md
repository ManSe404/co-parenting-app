# co-parenting-app

A shared space for two parents who look after one child separately: questions and agreements, a calendar of who
has the child and of the child's activities, the child's record and documents. Nothing that concerns both parents
changes without the other's consent: closing an agreement, any change to the calendar and deleting a document for
good all need the other parent, and the database enforces that rule, not only the app. The interface is in Serbian
(Latin script).

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
