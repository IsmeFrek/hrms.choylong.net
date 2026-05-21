import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Resolve API base
  const API_BASE_RAW =
    (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/+$/, '')) ||
    '';
  const API_PREFIX = API_BASE_RAW ? `${API_BASE_RAW}/api` : '/api';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_PREFIX}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to send reset link');
      }

      setMessage(data.message || 'Reset link has been sent to your email or phone');
      setIdentifier('');
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white border rounded-lg shadow p-6">
        <h1 className="text-xl font-semibold mb-1 text-center">Change password</h1>
        <p className="text-sm text-gray-500 mb-4 text-center">
          Enter your email or phone number to reset your password
        </p>

        {error && <div className="mb-3 text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">{error}</div>}

        {message && (
          <div className="mb-3 text-green-700 text-sm bg-green-50 border border-green-200 rounded p-3">
            {message}
          </div>
        )}

        {!message && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Email or Phone</label>
              <input
                type="text"
                className="border rounded w-full px-3 py-2"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="email@example.com or 070123456"
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="mt-4 pt-3 border-t text-center">
          <button
            onClick={() => navigate('/login')}
            className="text-blue-600 text-sm hover:underline"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
