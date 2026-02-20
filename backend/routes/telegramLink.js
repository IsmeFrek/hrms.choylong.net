import { Router } from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// In-memory store for linking codes (in production, use Redis or database)
const linkingCodes = new Map(); // { code: { userId, expiresAt } }

// Cleanup expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of linkingCodes.entries()) {
    if (data.expiresAt < now) {
      linkingCodes.delete(code);
    }
  }
}, 5 * 60 * 1000);

// POST /api/telegram/generate-link-code - Generate unique code for current user
router.post('/generate-link-code', authRequired, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Check if user already has telegram linked
    const user = await User.findById(userId);
    if (user && (user.telegramChatId || user.telegramChatId2)) {
      return res.json({ 
        success: true, 
        alreadyLinked: true,
        telegramChatId: user.telegramChatId,
        message: 'Telegram account already linked'
      });
    }
    
    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    
    // Store code with 10 minute expiration
    const expiresAt = Date.now() + 10 * 60 * 1000;
    linkingCodes.set(code, { userId: userId.toString(), expiresAt });
    
    return res.json({
      success: true,
      code,
      expiresIn: 600, // seconds
      botUsername: process.env.TELEGRAM_BOT_USERNAME || '@YourBot'
    });
  } catch (err) {
    console.error('Generate link code error:', err);
    return res.status(500).json({ message: 'Failed to generate code' });
  }
});

// GET /api/telegram/link-status - Check if user has telegram linked
router.get('/link-status', authRequired, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('telegramChatId telegramChatId2 telegramId');
    
    return res.json({
      success: true,
      linked: !!(user.telegramChatId || user.telegramChatId2 || user.telegramId),
      telegramChatId: user.telegramChatId || null,
      telegramChatId2: user.telegramChatId2 || null
    });
  } catch (err) {
    console.error('Check link status error:', err);
    return res.status(500).json({ message: 'Failed to check status' });
  }
});

// POST /api/telegram/verify-link - Internal endpoint called by webhook
// body: { code, chatId, firstName, lastName, username }
export async function verifyLinkCode(code, chatId, userData = {}) {
  try {
    const linkData = linkingCodes.get(code);
    
    if (!linkData) {
      return { success: false, message: 'Invalid or expired code' };
    }
    
    if (linkData.expiresAt < Date.now()) {
      linkingCodes.delete(code);
      return { success: false, message: 'Code expired' };
    }
    
    // Update user with telegram chat ID
    const user = await User.findById(linkData.userId);
    if (!user) {
      linkingCodes.delete(code);
      return { success: false, message: 'User not found' };
    }
    
    // Update primary telegram chat ID (Bot 1)
    user.telegramChatId = chatId.toString();
    if (userData.username) {
      user.telegramId = userData.username;
    }
    
    await user.save();
    
    // Remove used code
    linkingCodes.delete(code);
    
    console.log(`✅ Successfully linked Telegram for user: ${user.fullName} (Chat ID: ${chatId})`);
    
    return { 
      success: true, 
      message: `Successfully linked to ${user.fullName}`,
      userName: user.fullName 
    };
  } catch (err) {
    console.error('Verify link code error:', err);
    return { success: false, message: 'Internal error' };
  }
}

export default router;
