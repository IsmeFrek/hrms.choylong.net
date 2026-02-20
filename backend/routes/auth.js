import { Router } from 'express';
import User from '../models/User.js';
import Role from '../models/Role.js';
import { authRequired, signToken, toUserDTO } from '../middleware/auth.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) return res.status(400).json({ message: 'Identifier and password are required' });

    let user = null;
    const id = String(identifier).trim();
    if (id.includes('@')) {
      user = await User.findOne({ email: id.toLowerCase() }).populate('roles');
    } else {
      // simple phone normalization: remove spaces and dashes
      const phone = id.replace(/\s|-/g, '');
      user = await User.findOne({ phone }).populate('roles');
    }

    if (!user || !user.active) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await user.validatePassword(password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = signToken(user);
    return res.json({ token, user: toUserDTO(user) });
  } catch (e) {
    console.error('login failed', e);
    return res.status(500).json({ message: 'Login failed' });
  }
});

// POST /api/auth/register - Create a new user account (phone-based)
router.post('/register', async (req, res) => {
  try {
    const { fullName, phone, email, password } = req.body || {};
    if (!fullName || !phone || !password) {
      return res.status(400).json({ message: 'fullName, phone and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const normalizedPhone = String(phone).trim().replace(/\s|-/g, '');
    if (!/^[+]?\d{6,20}$/.test(normalizedPhone)) {
      return res.status(400).json({ message: 'Invalid phone number' });
    }

    const normalizedEmail = email ? String(email).trim().toLowerCase() : null;

    // prevent duplicates
    const existingByPhone = await User.findOne({ phone: normalizedPhone }).lean();
    if (existingByPhone) return res.status(409).json({ message: 'Phone already registered' });

    if (normalizedEmail) {
      const existingByEmail = await User.findOne({ emailCanonical: normalizedEmail }).lean();
      if (existingByEmail) return res.status(409).json({ message: 'Email already registered' });
    }

    // New staff signups should be pending until admin approves
    let pendingRole = await Role.findOne({ name: 'Pending' }).lean();
    if (!pendingRole) {
      pendingRole = await Role.create({ name: 'Pending', permissions: [] });
    }

    const user = new User({
      username: normalizedPhone.toLowerCase(),
      fullName: String(fullName).trim(),
      email: normalizedEmail || undefined,
      phone: normalizedPhone,
      active: true,
      roles: [pendingRole._id],
    });
    await user.setPassword(String(password));
    await user.save();

    // Create an approval request for admins (ChangeRequest)
    try {
      const { default: ChangeRequest } = await import('../models/ChangeRequest.js');
      await ChangeRequest.create({
        targetType: 'user',
        targetId: user._id,
        payload: {
          titleText: 'New staff signup',
          subText: 'Waiting for admin approval',
          fields: {
            fullName: String(fullName).trim(),
            phone: normalizedPhone,
          },
          notes: { source: 'public_register' },
          attachments: [],
          meta: { staffId: normalizedPhone },
        },
        reason: 'Staff created account and is waiting for admin to add HR data',
        requestedBy: user._id,
        status: 'pending',
      });
    } catch (e) {
      console.warn('Could not create signup ChangeRequest', e?.message || e);
    }

    const populated = await User.findById(user._id).populate('roles');
    const token = signToken(populated);
    return res.json({ token, user: toUserDTO(populated) });
  } catch (e) {
    console.error('register failed', e);
    return res.status(500).json({ message: 'Register failed' });
  }
});

router.get('/me', authRequired, (req, res) => {
  res.json({ user: toUserDTO(req.auth.user) });
});

// GET /api/auth/token - Get a new token for the current user
router.get('/token', authRequired, (req, res) => {
  try {
    const user = req.auth.user;
    const token = signToken(user);
    return res.json({ 
      token,
      user: toUserDTO(user),
      expiresIn: '7d',
      type: 'Bearer'
    });
  } catch (e) {
    console.error('token generation failed', e);
    return res.status(500).json({ message: 'Token generation failed' });
  }
});

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { identifier } = req.body || {};
    if (!identifier) {
      return res.status(400).json({ message: 'Email or phone is required' });
    }

    let user = null;
    const id = String(identifier).trim();
    if (id.includes('@')) {
      user = await User.findOne({ email: id.toLowerCase() });
    } else {
      // simple phone normalization
      const phone = id.replace(/\s|-/g, '');
      user = await User.findOne({ phone });
    }

    // Always return success message to prevent user enumeration
    if (!user || !user.active) {
      return res.json({ message: 'If an account exists with that email or phone, a reset link will be sent.' });
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    // In a production system, you would:
    // 1. Save resetToken hash to user document with expiration time
    // 2. Send email with reset link containing the token
    // For now, we'll just return the token to the client (for testing)
    
    // Store reset token in user document temporarily
    user.resetToken = resetToken;
    user.resetTokenExpire = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // In production, send email here:
    // await sendResetEmail(user.email, resetToken);

    return res.json({ 
      message: 'Reset link has been sent to your email or phone',
      // For testing/development - remove in production
      resetLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`
    });
  } catch (e) {
    console.error('Chang password failed', e);
    return res.status(500).json({ message: 'Failed to process reset request' });
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (e) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Find user with matching token
    const user = await User.findById(decoded.userId);
    if (!user || !user.resetToken || user.resetToken !== token) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Check if token has expired
    if (new Date() > user.resetTokenExpire) {
      return res.status(400).json({ message: 'Reset token has expired' });
    }

    // Update password
    await user.setPassword(password);
    user.resetToken = undefined;
    user.resetTokenExpire = undefined;
    await user.save();

    return res.json({ message: 'Password reset successfully' });
  } catch (e) {
    console.error('reset password failed', e);
    return res.status(500).json({ message: 'Failed to reset password' });
  }
});

// POST /api/auth/change-password - Change password (authenticated users)
router.post('/change-password', authRequired, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Old and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = req.auth.user;

    // Verify old password
    const ok = await user.validatePassword(oldPassword);
    if (!ok) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Update password
    await user.setPassword(newPassword);
    await user.save();

    return res.json({ message: 'Password changed successfully' });
  } catch (e) {
    console.error('change password failed', e);
    return res.status(500).json({ message: 'Failed to change password' });
  }
});

export default router;
