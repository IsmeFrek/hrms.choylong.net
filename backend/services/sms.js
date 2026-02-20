import dotenv from 'dotenv';
dotenv.config();

let client = null;
let provider = 'console';

// ESM-safe lazy load of twilio; fallback to console if not installed or env missing
async function ensureTwilioClient() {
  if (client || provider === 'console') return { client, provider };
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (sid && token) {
      const mod = await import('twilio');
      const twilio = mod?.default || mod; // CommonJS default export
      client = twilio(sid, token);
      provider = 'twilio';
    }
  } catch (e) {
    client = null;
    provider = 'console';
  }
  return { client, provider };
}

export async function sendSms(to, body) {
  const phone = String(to || '').trim();
  if (!phone) return { ok: false, message: 'No destination number' };

  // Try initialize twilio client if possible
  if (!client && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    await ensureTwilioClient();
  }

  if (provider === 'twilio' && client) {
    try {
      const from = process.env.TWILIO_FROM;
      if (!from) throw new Error('Missing TWILIO_FROM');
      const msg = await client.messages.create({ to: phone, from, body });
      return { ok: true, sid: msg.sid };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }
  // console fallback
  // eslint-disable-next-line no-console
  console.log(`[SMS] to=${phone} :: ${body}`);
  return { ok: true, provider: 'console' };
}

export default { sendSms };
