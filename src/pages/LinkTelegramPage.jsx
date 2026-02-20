import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function LinkTelegramPage() {
  const [loading, setLoading] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);
  const [linked, setLinked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [botUsername, setBotUsername] = useState('@YourBot');
  const [error, setError] = useState('');

  // Check if already linked
  useEffect(() => {
    checkLinkStatus();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (expiresIn > 0) {
      const timer = setInterval(() => {
        setExpiresIn(prev => {
          if (prev <= 1) {
            setLinkCode('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [expiresIn]);

  const checkLinkStatus = async () => {
    try {
      setChecking(true);
      const res = await api.get('/telegram/link-status');
      if (res.data.linked) {
        setLinked(true);
      }
    } catch (err) {
      console.error('Failed to check link status:', err);
    } finally {
      setChecking(false);
    }
  };

  const generateCode = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.post('/telegram/generate-link-code');
      
      if (res.data.alreadyLinked) {
        setLinked(true);
        return;
      }
      
      setLinkCode(res.data.code);
      setExpiresIn(res.data.expiresIn);
      setBotUsername(res.data.botUsername);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate code');
      console.error('Failed to generate code:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">កំពុងពិនិត្យ...</p>
        </div>
      </div>
    );
  }

  if (linked) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-green-50 border-2 border-green-500 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-700 mb-2">
            បានភ្ជាប់ Telegram រួចហើយ!
          </h2>
          <p className="text-green-600">
            គណនី Telegram របស់អ្នកត្រូវបានភ្ជាប់ជាមួយប្រព័ន្ធដោយជោគជ័យ។
          </p>
          <p className="text-sm text-gray-600 mt-4">
            អ្នកនឹងទទួលបានការជូនដំណឹងតាម Telegram នៅពេលមានឯកសារថ្មី។
          </p>
          <button
            onClick={() => window.history.back()}
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ត្រឡប់ក្រោយ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">📱</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            ភ្ជាប់គណនី Telegram
          </h1>
          <p className="text-gray-600">
            ភ្ជាប់គណនី Telegram របស់អ្នកដើម្បីទទួលបានការជូនដំណឹងពីប្រព័ន្ធ
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-6">
          <h3 className="font-semibold text-blue-800 mb-3">📋 របៀបភ្ជាប់៖</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>ចុចប៊ូតុង "ទទួលយករកូដ" ខាងក្រោម</li>
            <li>បើក Telegram និងស្វែងរក bot <code className="bg-blue-100 px-2 py-1 rounded">{botUsername}</code></li>
            <li>ចុច <strong>Start</strong> ប្រសិនបើអ្នកមិនទាន់បានធ្វើ</li>
            <li>ផ្ញើសារទៅ bot៖ <code className="bg-blue-100 px-2 py-1 rounded">/link YOUR_CODE</code></li>
            <li>រង់ចាំសារបញ្ជាក់ពី bot</li>
          </ol>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <p className="text-red-700">❌ {error}</p>
          </div>
        )}

        {/* Code Display */}
        {linkCode ? (
          <div className="mb-6">
            <div className="bg-gradient-to-r from-purple-100 to-blue-100 border-2 border-purple-300 rounded-lg p-8 text-center">
              <p className="text-sm text-gray-600 mb-2">រកូដភ្ជាប់របស់អ្នក៖</p>
              <div className="text-6xl font-bold text-purple-700 mb-4 tracking-wider">
                {linkCode}
              </div>
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-gray-600">ផុតកំណត់ក្នុង៖</span>
                <span className={`font-mono font-bold ${expiresIn < 60 ? 'text-red-600' : 'text-blue-600'}`}>
                  {formatTime(expiresIn)}
                </span>
              </div>
            </div>

            {/* Instructions with code */}
            <div className="mt-6 bg-gray-50 border border-gray-300 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-3">
                <strong>ជំហានបន្ទាប់៖</strong>
              </p>
              <div className="bg-white border border-gray-300 rounded p-3 font-mono text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">/link {linkCode}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`/link ${linkCode}`);
                      alert('បានចម្លងពាក្យបញ្ជា!');
                    }}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    📋 ចម្លង
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ចម្លងពាក្យបញ្ជាខាងលើ ហើយផ្ញើទៅ {botUsername} ក្នុង Telegram
              </p>
            </div>

            {/* Telegram Link */}
            <div className="mt-4 text-center">
              <a
                href={`https://t.me/${botUsername.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.015-.15-.056-.212s-.174-.041-.248-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.324-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.14.121.099.155.232.171.326.016.094.036.308.02.476z"/>
                </svg>
                បើក Telegram Bot
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <button
              onClick={generateCode}
              disabled={loading}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-lg font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
            >
              {loading ? '⏳ កំពុងដំណើរការ...' : '🎫 ទទួលយករកូដភ្ជាប់'}
            </button>
            <p className="text-sm text-gray-500 mt-4">
              រកូដនឹងមានសុពលភាពរយៈពេល ១០ នាទី
            </p>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 border-t pt-6">
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-gray-700 hover:text-blue-600">
              ❓ មានបញ្ហា? ចុចទីនេះ
            </summary>
            <div className="mt-4 space-y-3 text-gray-600">
              <div>
                <strong>Q: រកូដផុតកំណត់ហើយ?</strong>
                <p>A: ចុចប៊ូតុង "ទទួលយករកូដ" ម្តងទៀតដើម្បីទទួលរកូដថ្មី</p>
              </div>
              <div>
                <strong>Q: Bot មិនឆ្លើយតប?</strong>
                <p>A: សូមប្រាកដថាអ្នកបានចុច "Start" ក្នុង bot ជាមុនសិន</p>
              </div>
              <div>
                <strong>Q: មិនដឹង bot username?</strong>
                <p>A: Bot username គឺ <code className="bg-gray-100 px-2 py-1 rounded">{botUsername}</code></p>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
