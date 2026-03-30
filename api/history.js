import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
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

    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return res.status(500).json({
        error: 'Failed to load history',
        details: error.message
      });
    }

    return res.status(200).json({ history: data });
  } catch (err) {
    return res.status(500).json({
      error: 'Server error',
      details: err.message
    });
  }
}
