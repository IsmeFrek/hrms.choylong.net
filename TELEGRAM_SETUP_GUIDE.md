# ការកំណត់រចនាសម្ព័ន្ធ Telegram Bot សម្រាប់ការជូនដំណឹង
# Telegram Bot Configuration Guide for Notifications

## មាតិកា (Contents)
1. [បង្កើត Telegram Bot](#១-បង្កើត-telegram-bot)
2. [កំណត់រចនាសម្ព័ន្ធ Backend](#២-កំណត់រចនាសម្ព័ន្ធ-backend)
3. [កំណត់រចនាសម្ព័ន្ធ User Telegram ID](#៣-កំណត់រចនាសម្ព័ន្ធ-user-telegram-id)
4. [ការធ្វើតេស្ត](#៤-ការធ្វើតេស្ត)
5. [ការដោះស្រាយបញ្ហា](#៥-ការដោះស្រាយបញ្ហា)

---

## ១. បង្កើត Telegram Bot

### ជំហានទី ១.១: ទាក់ទង BotFather

1. បើក Telegram app (លើទូរស័ព្ទ ឬកុំព្យូទ័រ)
2. ស្វែងរក `@BotFather` (Official Telegram Bot Creator)
3. ចាប់ផ្តើមការសន្ទនាដោយចុច `/start`

### ជំហានទី ១.២: បង្កើត Bot ថ្មី

1. ផ្ញើពាក្យបញ្ជា: `/newbot`
2. BotFather នឹងសួរឈ្មោះ bot របស់អ្នក (ឧទាហរណ៍: `KSHF Hospital Notification`)
3. BotFather នឹងសួរ username (ត្រូវបញ្ចប់ដោយ `bot`, ឧទាហរណ៍: `kshf_hospital_bot`)
4. BotFather នឹងផ្តល់ **Bot Token** ដែលមើលទៅដូចនេះ:
   ```
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
   ```

### ជំហានទី ១.៣: រក្សាទុក Bot Token
⚠️ **សំខាន់:** កុំចែករំលែក token នេះជាមួយនរណាម្នាក់! វាគឺជាសោរសម្ងាត់របស់ bot អ្នក។

---

## ២. កំណត់រចនាសម្ព័ន្ធ Backend

### ជំហានទី ២.១: បន្ថែម Token ទៅក្នុងឯកសារ `.env`

បើកឯកសារ `backend/.env` និងបន្ថែមបន្ទាត់នេះ:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
```

ឬអ្នកអាចប្រើឈ្មោះជំនួស:
```env
TG_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
```

### ជំហានទី ២.២: ឧទាហរណ៍ឯកសារ `.env` ពេញលេញ

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/kshf_hospital_app

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Secret
JWT_SECRET=your_jwt_secret_here_change_in_production

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
```

### ជំហានទី ២.៣: ចាប់ផ្តើម Backend ឡើងវិញ

បិទ backend server (Ctrl+C) និងចាប់ផ្តើមឡើងវិញ:

```bash
cd backend
node server.js
```

ឬប្រើ npm script:
```bash
npm run dev
```

---

## ៣. កំណត់រចនាសម្ព័ន្ធ User Telegram ID

### វិធីទី ១: ប្រើ Chat ID (លេខ) - **សម្រាប់គណនីឯកជន**

#### ជំហានទី ៣.១.១: ស្វែងរក Bot របស់អ្នក
1. នៅក្នុង Telegram ស្វែងរក username bot របស់អ្នក (ឧទាហរណ៍: `@kshf_hospital_bot`)
2. ចុច `/start` ដើម្បីចាប់ផ្តើមការសន្ទនា

#### ជំហានទី ៣.១.២: ទទួលបាន Chat ID របស់អ្នក
មានវិធីសាស្ត្រពីរ:

**វិធី A: ប្រើ Bot ពិសេស**
1. ស្វែងរក `@userinfobot` នៅក្នុង Telegram
2. ចុច `/start`
3. Bot នឹងបង្ហាញ Chat ID របស់អ្នក (ឧទាហរណ៍: `123456789`)

**វិធី B: ប្រើ Bot API**
1. ផ្ញើសារទៅកាន់ bot របស់អ្នក
2. បើកតំណនេះក្នុង browser (ជំនួស `YOUR_BOT_TOKEN`):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
3. ស្វែងរក `"chat":{"id":123456789}` ក្នុង response

#### ជំហានទី ៣.១.៣: បន្ថែម Chat ID ក្នុងប្រព័ន្ធ
នៅក្នុងទំព័រគ្រប់គ្រងអ្នកប្រើប្រាស់ (Users Page):
1. Edit user
2. បញ្ចូល Chat ID ក្នុងចំណុច "Telegram ID": `123456789`
3. រក្សាទុក

### វិធីទី ២: ប្រើ Username - **ងាយស្រួលប៉ុន្តែតម្រូវឲ្យមាន Public Username**

#### ជំហានទី ៣.២.១: កំណត់ Telegram Username
1. នៅក្នុង Telegram app ទៅកាន់ Settings
2. Edit Profile
3. កំណត់ Username (ឧទាហរណ៍: `john_doe`)

#### ជំហានទី ៣.២.២: បន្ថែម Username ក្នុងប្រព័ន្ធ
នៅក្នុងទំព័រគ្រប់គ្រងអ្នកប្រើប្រាស់:
1. Edit user
2. បញ្ចូល username ក្នុងចំណុច "Telegram ID" (ប្រើ `@` ឬមិនប្រើក៏បាន):
   - `@john_doe` ឬ
   - `john_doe`
3. រក្សាទុក

### វិធីទី ៣: ប្រើ Profile Link - **ងាយស្រួលបំផុត**

នៅក្នុង Telegram app:
1. ចុចលើ profile picture របស់អ្នក
2. ចុច "Share Contact" ឬ "Copy Profile Link"
3. អ្នកនឹងទទួលបានតំណដូចនេះ: `https://t.me/john_doe`
4. Copy តំណទាំងមូល និងបញ្ចូលក្នុង "Telegram ID" field

---

## ៤. ការធ្វើតេស្ត

### ជំហានទី ៤.១: ធ្វើតេស្តផ្ញើមតិ

1. ចូលទៅទំព័រផ្ញើមតិ (Send Feedback Page)
2. បញ្ចូលឈ្មោះអ្នកផ្ញើ
3. ជ្រើសរើសអ្នកទទួល (ដែលបានកំណត់ Telegram ID)
4. ជ្រើសរើសប្រភេទការងារ
5. ចុច "ផ្ញើមតិ" 📨

### ជំហានទី ៤.២: ពិនិត្យការជូនដំណឹង

អ្នកទទួលគួរទទួលបាន:
- ✅ ការជូនដំណឹងក្នុងប្រព័ន្ធ (Notification bell)
- ✅ សារ Telegram ពី bot របស់អ្នក

### ជំហានទី ៤.៣: ឧទាហរណ៍សារ Telegram

```
📄 មានឯកសាររង់ចាំការពិនិត្យ
សូមជំរាបសូមពិនិត្យឯកសារ
ប្រភេទការងារ: យោបល់ប្រធានការិយាល័យបច្ចេកទេស
អ្នកទទួល: សុខ សំបូរ
អ្នកផ្ញើ: វណ្ណារ៉េត
លេខកត់ត្រា: 6748a1234567890abcdef12

🔗 Open document
```

---

## ៥. ការដោះស្រាយបញ្ហា

### បញ្ហា: មិនទទួលបានសារ Telegram

**ដំណោះស្រាយ:**

1. **ពិនិត្យ Bot Token**
   - ត្រូវប្រាកដថា token ត្រឹមត្រូវក្នុង `backend/.env`
   - Restart backend server បន្ទាប់ពីកែប្រែ `.env`

2. **ពិនិត្យ Telegram ID**
   - ត្រូវប្រាកដថា user បានកំណត់ Telegram ID
   - សាកល្បងប្រើ Chat ID លេខជំនួសឲ្យ username

3. **ពិនិត្យការចាប់ផ្តើម Bot**
   - អ្នកប្រើប្រាស់ត្រូវចុច `/start` លើ bot មុន
   - Bot មិនអាចផ្ញើសារទៅកាន់អ្នកដែលមិនបានចាប់ផ្តើម bot

4. **ពិនិត្យ Backend Logs**
   ```bash
   # នៅក្នុង terminal ដែល backend កំពុងដំណើរការ
   # ស្វែងរកសារ error ពាក់ព័ន្ធនឹង Telegram
   ```

5. **ពិនិត្យ Network/Firewall**
   - ប្រាកដថា backend server អាចចូលដំណើរការ `api.telegram.org`
   - ពិនិត្យ firewall settings

### បញ្ហា: Backend Server មិនដំណើរការ

**ដំណោះស្រាយ:**

1. ពិនិត្យ syntax error ក្នុង `.env` file
2. ត្រូវប្រាកដថាមិនមាន space បន្ថែម
3. សាកល្បងដំណើរការ:
   ```bash
   cd backend
   node server.js
   ```

### បញ្ហា: "Could not find user/signature to notify"

**ដំណោះស្រាយ:**

1. ពិនិត្យថា user ដែលជ្រើសរើសមាននៅក្នុងប្រព័ន្ធ
2. ពិនិត្យថា signature document មាន `createdBy` field
3. សាកល្បងជ្រើសរើស user ផ្សេង

---

## 📚 ឯកសារយោង (References)

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [BotFather Commands](https://core.telegram.org/bots#botfather)
- [How to get your Chat ID](https://stackoverflow.com/questions/32423837/telegram-bot-how-to-get-a-group-chat-id)

---

## 🔒 សុវត្ថិភាព (Security Notes)

1. **កុំចែករំលែក Bot Token** - រក្សាវាសម្ងាត់
2. **កុំ commit `.env` file** - បន្ថែម `.env` ក្នុង `.gitignore`
3. **ប្រើ environment variables** - កុំរក្សា token ក្នុង source code
4. **ផ្លាស់ប្តូរ token ជាទៀងទាត់** - ប្រសិនបើមានការសង្ស័យអំពីការលេចធ្លាយ

---

## ✅ Checklist ការកំណត់រចនាសម្ព័ន្ធ

- [ ] បានបង្កើត Telegram Bot តាមរយៈ @BotFather
- [ ] បានទទួល Bot Token
- [ ] បានបន្ថែម `TELEGRAM_BOT_TOKEN` ក្នុង `backend/.env`
- [ ] បាន restart backend server
- [ ] បានកំណត់ Telegram ID សម្រាប់ users
- [ ] បានធ្វើតេស្តផ្ញើមតិ និងទទួលបានសារ Telegram
- [ ] បានពិនិត្យ backend logs សម្រាប់ errors

---

**កាលបរិច្ឆេទបង្កើត:** November 30, 2025
**កំណែ:** 1.0.0
