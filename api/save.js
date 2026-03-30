import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'Missing auth token' });
    }

    const token = authHeader.replace('Bearer ', '');

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid user' });
    }

    const body = req.body;

    const { error } = await supabase.from('scans').insert({
      url: body.url,
      score: body.score,
      data: {
        scanData: body.scanData,
        issues: body.issues,
        feedback: body.feedback,
        priorityFixes: body.priorityFixes
      },
      user_id: user.id
    });

    if (error) {
      return res.status(500).json({
        error: 'Failed to save scan',
        details: error.message
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({
      error: 'Server error',
      details: err.message
    });
  }
}
