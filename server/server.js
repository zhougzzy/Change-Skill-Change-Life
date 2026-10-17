const express = require('express');
const cors = require('cors');

const app = express();
const port = Number(process.env.PORT) || 3001;
app.use(cors());
app.use(express.json({ limit: '32kb' }));

const skills = [
  { id: 'skill-1', name: 'Product Design', category: 'Design', description: 'User flows, wireframes, and interface critique.' },
  { id: 'skill-2', name: 'JavaScript', category: 'Engineering', description: 'Modern JavaScript, APIs, and frontend fundamentals.' },
  { id: 'skill-3', name: 'Photography', category: 'Creative', description: 'Portrait, street, and basic photo editing.' },
  { id: 'skill-4', name: 'Spanish Conversation', category: 'Language', description: 'Practice everyday Spanish with a conversation partner.' },
  { id: 'skill-5', name: 'Public Speaking', category: 'Professional', description: 'Clear presentations, storytelling, and delivery.' }
];

let exchanges = [
  { id: 'exchange-1', offeredSkillId: 'skill-2', requestedSkillId: 'skill-1', requesterId: 'user-101', partnerId: 'user-202', message: 'I can help with JavaScript in exchange for a product critique.', status: 'pending', createdAt: '2026-10-16T09:00:00.000Z', updatedAt: '2026-10-16T09:00:00.000Z' },
  { id: 'exchange-2', offeredSkillId: 'skill-3', requestedSkillId: 'skill-4', requesterId: 'user-303', partnerId: 'user-404', message: 'Looking for weekly Spanish conversation practice.', status: 'accepted', createdAt: '2026-10-15T14:30:00.000Z', updatedAt: '2026-10-15T15:00:00.000Z' }
];

const allowedStatuses = new Set(['pending', 'accepted', 'declined', 'completed', 'cancelled']);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const findSkill = (id) => skills.find((skill) => skill.id === id);
const nextId = (prefix, collection) => `${prefix}-${collection.length + 1}-${Date.now().toString(36)}`;

function validateExchangePayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Request body must be a JSON object.';
  const required = ['offeredSkillId', 'requestedSkillId', 'requesterId', 'partnerId'];
  if (!partial) {
    const missing = required.filter((field) => !isNonEmptyString(payload[field]));
    if (missing.length) return `Missing required field(s): ${missing.join(', ')}.`;
  }
  for (const field of required) {
    if (payload[field] !== undefined && !isNonEmptyString(payload[field])) return `${field} must be a non-empty string.`;
  }
  if (payload.message !== undefined && typeof payload.message !== 'string') return 'message must be a string.';
  if (payload.status !== undefined && !allowedStatuses.has(payload.status)) return `status must be one of: ${Array.from(allowedStatuses).join(', ')}.`;
  if (payload.offeredSkillId && payload.offeredSkillId === payload.requestedSkillId) return 'offeredSkillId and requestedSkillId must be different.';
  return null;
}

const csvEscape = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'skill-swap-api', timestamp: new Date().toISOString() }));

app.get('/api/skills', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const format = typeof req.query.format === 'string' ? req.query.format.toLowerCase() : 'json';
  if (!['json', 'csv'].includes(format)) return res.status(400).json({ error: 'format must be json or csv.' });
  const filtered = query ? skills.filter((skill) => [skill.name, skill.category, skill.description].some((value) => value.toLowerCase().includes(query))) : skills;
  if (format === 'csv') {
    const rows = filtered.map((skill) => [skill.id, skill.name, skill.category, skill.description].map(csvEscape).join(','));
    return res.type('text/csv').send(['id,name,category,description', ...rows].join('\n'));
  }
  return res.json({ data: filtered, count: filtered.length, query: query || null });
});

app.get('/api/exchanges', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  if (status && !allowedStatuses.has(status)) return res.status(400).json({ error: `status must be one of: ${Array.from(allowedStatuses).join(', ')}.` });
  const data = status ? exchanges.filter((exchange) => exchange.status === status) : exchanges;
  return res.json({ data, count: data.length });
});

app.post('/api/exchanges', (req, res) => {
  const validationError = validateExchangePayload(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  if (!findSkill(req.body.offeredSkillId) || !findSkill(req.body.requestedSkillId)) return res.status(400).json({ error: 'offeredSkillId and requestedSkillId must reference existing skills.' });
  const now = new Date().toISOString();
  const exchange = { id: nextId('exchange', exchanges), offeredSkillId: req.body.offeredSkillId, requestedSkillId: req.body.requestedSkillId, requesterId: req.body.requesterId, partnerId: req.body.partnerId, message: req.body.message || '', status: 'pending', createdAt: now, updatedAt: now };
  exchanges.push(exchange);
  return res.status(201).json({ data: exchange });
});

app.patch('/api/exchanges/:id', (req, res) => {
  const exchange = exchanges.find((item) => item.id === req.params.id);
  if (!exchange) return res.status(404).json({ error: 'Exchange not found.' });
  const validationError = validateExchangePayload(req.body, { partial: true });
  if (validationError) return res.status(400).json({ error: validationError });
  for (const field of ['offeredSkillId', 'requestedSkillId']) {
    if (req.body[field] && !findSkill(req.body[field])) return res.status(400).json({ error: `${field} must reference an existing skill.` });
  }
  const nextOffered = req.body.offeredSkillId || exchange.offeredSkillId;
  const nextRequested = req.body.requestedSkillId || exchange.requestedSkillId;
  if (nextOffered === nextRequested) return res.status(400).json({ error: 'offeredSkillId and requestedSkillId must be different.' });
  for (const field of ['offeredSkillId', 'requestedSkillId', 'requesterId', 'partnerId', 'message', 'status']) {
    if (req.body[field] !== undefined) exchange[field] = req.body[field];
  }
  exchange.updatedAt = new Date().toISOString();
  return res.json({ data: exchange });
});

app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) return res.status(400).json({ error: 'Request body must contain valid JSON.' });
  return next(error);
});

app.listen(port, () => console.log(`Skill Swap API listening on http://localhost:${port}`));
