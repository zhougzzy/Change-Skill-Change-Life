# Skill Swap API

Node/Express API for the Skill Swap demo. Data is stored in memory and resets when the process restarts.

## Start

```bash
npm install
npm start
```

The default URL is `http://localhost:3001`. Set `PORT` to use another port. For development, use `npm run dev` with Node 18+.

## Endpoints

- `GET /api/health` - service health and timestamp.
- `GET /api/skills?q=javascript` - search name, category, or description.
- `GET /api/skills?format=csv` - return skills as CSV; `q` can be combined with it.
- `GET /api/exchanges` - list exchanges; optionally filter with `?status=pending`.
- `POST /api/exchanges` - create an exchange.
- `PATCH /api/exchanges/:id` - update editable exchange fields.

### Create example

```json
{
  "offeredSkillId": "skill-2",
  "requestedSkillId": "skill-1",
  "requesterId": "user-505",
  "partnerId": "user-202",
  "message": "I can help with JavaScript."
}
```

The four ID fields are required non-empty strings. Skill IDs must exist and differ. Statuses are `pending`, `accepted`, `declined`, `completed`, and `cancelled`.

Successful resource responses use `{ "data": ... }`; errors use `{ "error": "..." }`. CORS is enabled for all origins for local demo use.
