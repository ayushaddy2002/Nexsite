require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const { v4: uuidv4 } = require('uuid');

// ── DB ─────────────────────────────────────────────────────────────────────
// Vercel has a read-only filesystem except /tmp
const dbPath = process.env.VERCEL
  ? '/tmp/db.json'
  : path.join(__dirname, 'data', 'db.json');
const adapter = new FileSync(dbPath);
const db = low(adapter);
db.defaults({ leads: [], contacts: [] }).write();

// ── App ────────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'nexsite-admin-2026';

app.use(express.json());
app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: false, // allow inline scripts in dev
  })
);

// ── Rate limiting ──────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { error: 'Too many requests. Please try again later.' },
});

// ── Static files ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ────────────────────────────────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidPhone(phone) {
  if (!phone) return true; // optional
  return /^[+\d\s\-().]{7,20}$/.test(phone);
}

// ── API: Submit lead (booking request) ────────────────────────────────────
app.post('/api/leads', apiLimiter, (req, res) => {
  const { name, email, phone, company, plan, message } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });
  if (!isValidPhone(phone)) return res.status(400).json({ error: 'Invalid phone number.' });

  // Duplicate check (same email within 24h)
  const recent = db.get('leads')
    .find(l => l.email.toLowerCase() === email.toLowerCase() &&
               Date.now() - l.createdAt < 86400000)
    .value();
  if (recent) return res.status(409).json({ error: 'We already received your request. Our team will reach out soon!' });

  const lead = {
    id: uuidv4(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone ? phone.trim() : null,
    company: company ? company.trim() : null,
    plan: plan || 'Not specified',
    message: message ? message.trim() : null,
    status: 'new',        // new | contacted | closed
    createdAt: Date.now(),
  };

  db.get('leads').push(lead).write();

  console.log(`[LEAD] ${lead.name} <${lead.email}> — ${lead.plan}`);
  res.status(201).json({ success: true, message: 'Thanks! We\'ll be in touch within 24 hours.' });
});

// ── API: Contact form ──────────────────────────────────────────────────────
app.post('/api/contact', apiLimiter, (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required.' });

  const contact = {
    id: uuidv4(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    subject: subject ? subject.trim() : 'General Enquiry',
    message: message.trim(),
    createdAt: Date.now(),
  };

  db.get('contacts').push(contact).write();
  console.log(`[CONTACT] ${contact.name} <${contact.email}> — "${contact.subject}"`);
  res.status(201).json({ success: true, message: 'Message received. We\'ll reply within 24 hours.' });
});

// ── API: Stats (public, no sensitive data) ────────────────────────────────
app.get('/api/stats', (req, res) => {
  const leads = db.get('leads').value();
  res.json({
    totalLeads: leads.length,
    newLeads: leads.filter(l => l.status === 'new').length,
  });
});

// ── Admin middleware ───────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── Admin API: get all leads ───────────────────────────────────────────────
app.get('/api/admin/leads', adminAuth, (req, res) => {
  const leads = db.get('leads').orderBy('createdAt', 'desc').value();
  res.json(leads);
});

// ── Admin API: update lead status ─────────────────────────────────────────
app.patch('/api/admin/leads/:id', adminAuth, (req, res) => {
  const { status } = req.body;
  const valid = ['new', 'contacted', 'closed'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const lead = db.get('leads').find({ id: req.params.id }).value();
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  db.get('leads').find({ id: req.params.id }).assign({ status }).write();
  res.json({ success: true });
});

// ── Admin API: delete lead ─────────────────────────────────────────────────
app.delete('/api/admin/leads/:id', adminAuth, (req, res) => {
  db.get('leads').remove({ id: req.params.id }).write();
  res.json({ success: true });
});

// ── Admin API: get contacts ────────────────────────────────────────────────
app.get('/api/admin/contacts', adminAuth, (req, res) => {
  const contacts = db.get('contacts').orderBy('createdAt', 'desc').value();
  res.json(contacts);
});

// ── Catch-all → index.html ─────────────────────────────────────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ──────────────────────────────────────────────────────────────────
const fs = require('fs');
if (!process.env.VERCEL) {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
}

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║         Nexsite Server               ║
║  http://localhost:${PORT}              ║
║  Admin: http://localhost:${PORT}/admin ║
║  Admin Key: ${ADMIN_KEY.slice(0,8)}...           ║
╚══════════════════════════════════════╝
  `);
});

module.exports = app;
