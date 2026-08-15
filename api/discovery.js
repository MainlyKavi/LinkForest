const VISITORS_KEY = 'mainlykavi:star:01:visitors';
const COUNTER_KEY = 'mainlykavi:star:01:counter';

const SCRIPT = `
local existing = redis.call('HGET', KEYS[1], ARGV[1])
if existing then
  local current = tonumber(redis.call('GET', KEYS[2]) or existing)
  local assigned = tonumber(existing)
  if current < assigned then current = assigned end
  return {assigned, 0, current}
end
local assigned = redis.call('INCR', KEYS[2])
redis.call('HSET', KEYS[1], ARGV[1], assigned)
return {assigned, 1, assigned}
`;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return json(res, 503, { error: 'counter_not_configured', configured: false });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }

  const visitorId = body && typeof body.visitorId === 'string' ? body.visitorId.trim() : '';
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(visitorId)) {
    return json(res, 400, { error: 'invalid_visitor_id' });
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(['EVAL', SCRIPT, 2, VISITORS_KEY, COUNTER_KEY, visitorId])
    });
    const payload = await response.json();
    if (!response.ok || payload.error || !Array.isArray(payload.result)) {
      console.error('star discovery redis error', payload.error || response.status);
      return json(res, 502, { error: 'counter_unavailable' });
    }

    const discoveryNumber = Number(payload.result[0]);
    const isNew = Number(payload.result[1]) === 1;
    const count = Number(payload.result[2]);
    if (!Number.isInteger(discoveryNumber) || discoveryNumber < 1 || !Number.isInteger(count) || count < 1) {
      return json(res, 502, { error: 'counter_invalid_response' });
    }

    return json(res, 200, { discoveryNumber, count, isNew });
  } catch (error) {
    console.error('star discovery request failed', error instanceof Error ? error.message : String(error));
    return json(res, 502, { error: 'counter_unavailable' });
  }
}
