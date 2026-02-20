import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function TelegramTestPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [testMessage, setTestMessage] = useState({
    title: '🔔 សាកល្បងការជូនដំណឹង Telegram',
    message: 'នេះគឺជាសារសាកល្បងពីប្រព័ន្ធ KSHF Hospital\nប្រសិនបើអ្នកទទួលបានសារនេះ មានន័យថា Telegram bot កំពុងដំណើរការបានល្អ!',
    link: window.location.origin
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/users');
      const userList = res.data || [];
      // Filter only users with telegramId
      const usersWithTelegram = userList.filter(u => u.telegramId);
      setUsers(usersWithTelegram);
    } catch (error) {
      console.error('Failed to load users:', error);
      alert('មិនអាចទាញបញ្ជីអ្នកប្រើប្រាស់បានទេ');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSendTest = async () => {
    if (!selectedUser) {
      alert('សូមជ្រើសរើសអ្នកប្រើប្រាស់');
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const response = await api.post('/notifications/send-test', {
        userId: selectedUser,
        title: testMessage.title,
        message: testMessage.message,
        link: testMessage.link
      });

      setResult({
        success: true,
        message: 'បានផ្ញើការជូនដំណឹងសាកល្បងដោយជោគជ័យ! ពិនិត្យ Telegram របស់អ្នក។',
        data: response.data
      });
    } catch (error) {
      console.error('Test send failed:', error);
      setResult({
        success: false,
        message: 'មិនអាចផ្ញើការជូនដំណឹងបានទេ',
        error: error.response?.data?.message || error.message
      });
    } finally {
      setSending(false);
    }
  };

  const selectedUserObj = users.find(u => u._id === selectedUser);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">🧪 ធ្វើតេស្ត Telegram Notifications</h1>
      <p className="text-gray-600 mb-6">សាកល្បងផ្ញើការជូនដំណឹងតាមរយៈ Telegram Bot</p>

      {/* Configuration Status */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="font-semibold mb-2">📋 ស្ថានភាពការកំណត់រចនាសម្ព័ន្ធ</h3>
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Backend API:</span>
            <span className="font-mono text-xs bg-white px-2 py-1 rounded">{import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">អ្នកប្រើប្រាស់ដែលមាន Telegram ID:</span>
            <span className="font-semibold text-green-600">{users.length} នាក់</span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <span>💡</span>
          <span>មុនពេលធ្វើតេស្ត</span>
        </h3>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li>ត្រូវប្រាកដថាបានកំណត់ <code className="bg-white px-1 rounded">TELEGRAM_BOT_TOKEN</code> ក្នុង <code className="bg-white px-1 rounded">backend/.env</code></li>
          <li>អ្នកប្រើប្រាស់ត្រូវចុច <code className="bg-white px-1 rounded">/start</code> លើ Telegram bot មុន</li>
          <li>អ្នកប្រើប្រាស់ត្រូវមាន Telegram ID កំណត់ក្នុងប្រវត្តិរូប</li>
          <li>Backend server ត្រូវដំណើរការ</li>
        </ol>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column - User Selection */}
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">១. ជ្រើសរើសអ្នកទទួល</h3>
            
            {loadingUsers ? (
              <div className="text-center py-4 text-gray-500">កំពុងទាញបញ្ជី...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-2">មិនមានអ្នកប្រើប្រាស់ដែលកំណត់ Telegram ID</p>
                <p className="text-xs text-gray-400">សូមចូលទៅ Users page ដើម្បីបន្ថែម Telegram ID</p>
              </div>
            ) : (
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">-- ជ្រើសរើសអ្នកប្រើប្រាស់ --</option>
                {users.map(user => (
                  <option key={user._id} value={user._id}>
                    {user.fullName} ({user.telegramId})
                  </option>
                ))}
              </select>
            )}

            {selectedUserObj && (
              <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                <div className="font-semibold">{selectedUserObj.fullName}</div>
                <div className="text-gray-600">Telegram: {selectedUserObj.telegramId}</div>
                {selectedUserObj.email && <div className="text-gray-600">Email: {selectedUserObj.email}</div>}
              </div>
            )}
          </div>

          {/* Message Preview */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">២. មើលសារមុន</h3>
            <div className="bg-gray-100 rounded p-3 text-sm space-y-2">
              <div className="font-semibold">{testMessage.title}</div>
              <div className="whitespace-pre-wrap">{testMessage.message}</div>
              {testMessage.link && (
                <div className="text-blue-600 text-xs">🔗 {testMessage.link}</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Message Editor */}
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">៣. កែប្រែសារ (ស្រេចចិត្ត)</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">ចំណងជើង</label>
                <input
                  type="text"
                  value={testMessage.title}
                  onChange={(e) => setTestMessage(m => ({ ...m, title: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  placeholder="ចំណងជើងការជូនដំណឹង"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">សារ</label>
                <textarea
                  value={testMessage.message}
                  onChange={(e) => setTestMessage(m => ({ ...m, message: e.target.value }))}
                  className="w-full border rounded px-3 py-2 h-32"
                  placeholder="សារការជូនដំណឹង"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">តំណភ្ជាប់ (Link)</label>
                <input
                  type="text"
                  value={testMessage.link}
                  onChange={(e) => setTestMessage(m => ({ ...m, link: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </div>

          {/* Send Button */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">៤. ផ្ញើសាកល្បង</h3>
            <button
              onClick={handleSendTest}
              disabled={sending || !selectedUser}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
            >
              {sending ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  កំពុងផ្ញើ...
                </>
              ) : (
                <>
                  <span>📤</span>
                  ផ្ញើសាកល្បង
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Result Display */}
      {result && (
        <div className={`mt-6 p-4 rounded-lg border-2 ${
          result.success 
            ? 'bg-green-50 border-green-300' 
            : 'bg-red-50 border-red-300'
        }`}>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <span>{result.success ? '✅' : '❌'}</span>
            <span>លទ្ធផល</span>
          </h3>
          <p className="mb-2">{result.message}</p>
          {result.error && (
            <div className="mt-2 p-2 bg-white rounded text-sm">
              <strong>Error:</strong> {result.error}
            </div>
          )}
          {result.data && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                មើលព័ត៌មានលម្អិត (Debug Info)
              </summary>
              <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Help Section */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">❓ ជំនួយ</h3>
        <div className="text-sm space-y-2">
          <p>ប្រសិនបើមិនទទួលបានសារ Telegram ពិនិត្យ:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Backend console logs សម្រាប់ error messages</li>
            <li>ត្រូវប្រាកដថា <code className="bg-white px-1 rounded">TELEGRAM_BOT_TOKEN</code> ត្រឹមត្រូវ</li>
            <li>អ្នកប្រើប្រាស់បានចុច <code className="bg-white px-1 rounded">/start</code> លើ bot</li>
            <li>Telegram ID ត្រឹមត្រូវ (Chat ID, @username, ឬ t.me link)</li>
            <li>Network/Firewall មិនបាន block api.telegram.org</li>
          </ul>
          <p className="mt-3">
            <a href="/TELEGRAM_SETUP_GUIDE.md" target="_blank" className="text-blue-600 hover:underline">
              📖 អានណែនាំពេញលេញ (TELEGRAM_SETUP_GUIDE.md)
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
