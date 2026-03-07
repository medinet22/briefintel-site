import { readJobs, appendOpsEvent } from './_lib.js';

export default async function handler(req, res) {
  const { secret } = req.query;
  const ADMIN_SECRET = process.env.BRIEFINTEL_ADMIN_SECRET;

  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const jobs = await readJobs();
    // Sort newest first
    jobs.sort((a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at));
    res.status(200).json({ jobs });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
}
