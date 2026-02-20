# Telegram Reply System - របៀបប្រើប្រាស់

## 🎯 មុខងារ

ប្រព័ន្ធនេះអនុញ្ញាតឲ្យ users ឆ្លើយតប (reply) សារជូនដំណឹងពី Telegram ហើយមតិនោះនឹងភ្ជាប់ទៅឯកសារក្នុងប្រព័ន្ធដោយស្វ័យប្រវត្តិ។

## 📋 របៀប Setup

### ជំហានទី 1: បើក Server

```bash
cd backend
node server.js
```

Server រត់នៅ `http://localhost:5000`

### ជំហានទី 2: Setup Webhook (ប្រើ ngrok)

ព្រោះ Telegram ត្រូវការ HTTPS URL, អ្នកត្រូវប្រើ **ngrok**:

#### 2.1 ទាញយក ngrok
```bash
# ទៅ https://ngrok.com/download
# ឬប្រើ chocolatey (Windows):
choco install ngrok
```

#### 2.2 Run ngrok
```bash
ngrok http 5000
```

Output នឹងបង្ហាញ:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:5000
```

#### 2.3 Copy URL និង Setup Webhook
```bash
cd backend
node setup-telegram-webhook.js https://abc123.ngrok.io/api/telegram/webhook
```

Output:
```
✅ Webhook setup successful!
```

### ជំហានទី 3: Test

#### 3.1 ផ្ញើ Notification
1. ចូលទៅ SendfeedbackPage
2. ជ្រើសរើសឯកសារ និង users
3. ចុច "រក្សាទុក"
4. Users នឹងទទួល notification នៅ Telegram

#### 3.2 Reply ក្នុង Telegram
1. បើក Telegram នៅ phone
2. នឹងមាន notification មួយ
3. **ចុច "Reply"** (ឆ្លើយតប) នៅលើសារនោះ
4. សរសេរមតិ ឧទាហរណ៍: "យល់ព្រម"
5. ចុច Send

#### 3.3 ពិនិត្យ Database
```bash
cd backend
node
```
```javascript
const mongoose = require('mongoose');
await mongoose.connect('mongodb://localhost:27017/kshf_hospital_app');
const FileTransfer = require('./models/FileTransfer.js').default;

const doc = await FileTransfer.findById('YOUR_RECORD_ID');
console.log(doc.meta.telegramFeedback);
// Output:
// [
//   {
//     userId: '...',
//     userName: 'លោក នេត ចន្ថា',
//     message: 'យល់ព្រម',
//     timestamp: 2025-11-30T...,
//     chatId: '123456789'
//   }
// ]
```

## 📱 Commands

### /start
ចាប់ផ្តើមប្រើ bot

### /help
បង្ហាញការណែនាំ

### Reply to Notification
ឆ្លើយតបនៅលើសារជូនដំណឹង → មតិនឹងរក្សាទុកក្នុងប្រព័ន្ធ

## 🗂️ Database Structure

### FileTransfer.meta.telegramFeedback
```javascript
{
  meta: {
    telegramFeedback: [
      {
        userId: ObjectId,        // User ID ក្នុង database
        userName: String,         // ឈ្មោះ user
        message: String,          // មតិដែលផ្ញើ
        timestamp: Date,          // ថ្ងៃម៉ោងផ្ញើ
        chatId: String           // Telegram chat ID
      }
    ]
  }
}
```

### FileTransfer.others
មតិចុងក្រោយនឹងបន្ថែមទៅ `others` field:
```
[Telegram - លោក នេត ចន្ថា]: យល់ព្រម
```

## 🔧 Troubleshooting

### ❌ Webhook មិនដំណើរការ

**Check webhook status:**
```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

**Re-setup webhook:**
```bash
node backend/setup-telegram-webhook.js https://your-new-ngrok-url/api/telegram/webhook
```

### ❌ Server មិនទទួល webhook

**Check backend logs:**
- នៅពេល user ផ្ញើសារ, backend គួរ log: `Telegram webhook received: {...}`
- ប្រសិនបើមិនឃើញ → webhook URL មិនត្រឹមត្រូវ

**Verify ngrok:**
```bash
# ពិនិត្យថា ngrok រត់ និង URL ត្រឹមត្រូវ
curl https://your-ngrok-url/api/telegram/webhook-info
```

### ❌ Reply មិនរក្សាទុក

**Check console:**
- User មាន `telegramId` ហើយឬនៅ? → Run `node backend/list-users.js`
- Message format ត្រឹមត្រូវទេ? → ត្រូវ reply directly to notification message

## 🎯 របៀបដំណើរការ

```
1. SendfeedbackPage → ផ្ញើ notification
                    ↓
2. Backend → createNotification + sendTelegramMessage
                    ↓
3. Telegram Server → ផ្ញើទៅ user's phone
                    ↓
4. User → ចុច Reply + សរសេរមតិ
                    ↓
5. Telegram Server → POST /api/telegram/webhook
                    ↓
6. Backend → extract recordId → save to FileTransfer.meta.telegramFeedback
                    ↓
7. Backend → send confirmation "✅ មតិរបស់អ្នកត្រូវបានរក្សាទុក"
                    ↓
8. Database → updated with feedback
```

## 🔐 Security Notes

- **Bot Token** ជា sensitive - កុំ share ជាមួយនរណា
- **Webhook** ត្រូវតែ HTTPS (ngrok provide បាន)
- **Validation** - backend check user exists មុនពេលរក្សាទុក

## 📊 Monitoring

### Check webhook activity:
```bash
# ពិនិត្យ webhook info
GET http://localhost:5000/api/telegram/webhook-info
```

### View feedback in database:
```javascript
// In MongoDB shell or Node.js:
db.filetransfers.find(
  { 'meta.telegramFeedback': { $exists: true } }
).pretty()
```

## 🚀 Production Deployment

សម្រាប់ production, ជំនួស ngrok ជាមួយ:
- **Real domain** with SSL certificate
- **Set webhook** to your production URL:
  ```bash
  node setup-telegram-webhook.js https://yourdomain.com/api/telegram/webhook
  ```

---

✅ រួចរាល់! Users អាចឆ្លើយតបសារជូនដំណឹងនៅក្នុង Telegram ហើយមតិនឹងរក្សាទុកក្នុងប្រព័ន្ធដោយស្វ័យប្រវត្តិ។
