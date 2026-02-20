# 🚀 ការចាប់ផ្តើមរហ័ស - Telegram Notifications

## ជំហានរហ័ស ៥ ជំហាន

### ជំហាន ១: បង្កើត Telegram Bot (៥ នាទី)

1. បើក Telegram និងស្វែងរក: **@BotFather**
2. ចុច `/start` បន្ទាប់មក `/newbot`
3. ដាក់ឈ្មោះ bot: `KSHF Hospital Bot`
4. ដាក់ username: `kshf_hospital_bot` (ត្រូវបញ្ចប់ដោយ `bot`)
5. **Copy Bot Token** ដែល BotFather ផ្តល់ឲ្យ

ឧទាហរណ៍ Token:
```
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
```

---

### ជំហាន ២: បន្ថែម Token ក្នុង Backend (២ នាទី)

បើកឯកសារ: `backend/.env`

បន្ថែមបន្ទាត់នេះ (ជំនួស token ដោយ token របស់អ្នក):
```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
```

រក្សាទុកឯកសារ ✅

---

### ជំហាន ៣: Restart Backend Server (១ នាទី)

នៅក្នុង terminal:
```bash
cd backend
node server.js
```

ឬប្រើ npm:
```bash
npm run dev
```

---

### ជំហាន ៤: ទទួលបាន Telegram ID (៣ នាទី)

**វិធីងាយស្រួលបំផុត:**

1. ស្វែងរក **@userinfobot** នៅក្នុង Telegram
2. ចុច `/start`
3. Bot នឹងបង្ហាញ Chat ID របស់អ្នក (ឧទាហរណ៍: `123456789`)
4. Copy លេខនេះ

---

### ជំហាន ៥: កំណត់ Telegram ID ក្នុងប្រព័ន្ធ (២ នាទី)

1. ចូលទៅទំព័រ **Users** ក្នុងប្រព័ន្ធ
2. Edit user profile របស់អ្នក
3. បញ្ចូល Chat ID ក្នុងចំណុច **"Telegram ID"**: `123456789`
4. រក្សាទុក ✅

---

## 🧪 ធ្វើតេស្ត

### វិធីទី ១: ប្រើទំព័រធ្វើតេស្ត

1. ចូលទៅ: **http://localhost:5173/telegram-test**
2. ជ្រើសរើសឈ្មោះអ្នកប្រើប្រាស់
3. ចុច "ផ្ញើសាកល្បង"
4. ពិនិត្យ Telegram app របស់អ្នក! 📱

### វិធីទី ២: ប្រើទំព័រផ្ញើមតិ

1. ចូលទៅ: **http://localhost:5173/send-feedback**
2. ជ្រើសរើសអ្នកទទួល
3. ចុច "ផ្ញើមតិ"
4. អ្នកទទួលនឹងទទួលបានសារ Telegram! 🎉

---

## ⚠️ បញ្ហាដែលជួបញឹកញាប់

### បញ្ហា: មិនទទួលបានសារ Telegram

**ដំណោះស្រាយ:**

1. ✅ ពិនិត្យថា Bot Token ត្រឹមត្រូវក្នុង `backend/.env`
2. ✅ Restart backend server បន្ទាប់ពីបន្ថែម token
3. ✅ ចុច `/start` នៅលើ bot របស់អ្នក (សំខាន់!)
4. ✅ ពិនិត្យថា Telegram ID ត្រឹមត្រូវ

### បញ្ហា: "Could not find user/signature to notify"

**ដំណោះស្រាយ:**

1. ✅ ពិនិត្យថា user មាននៅក្នុងប្រព័ន្ធ
2. ✅ ពិនិត្យថា user មាន Telegram ID កំណត់

---

## 📱 ឧទាហរណ៍សារដែលទទួលបាន

នៅពេលផ្ញើមតិ អ្នកទទួលនឹងទទួលបាន:

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

## ✅ Checklist

- [ ] បានបង្កើត bot តាមរយៈ @BotFather
- [ ] បានទទួល bot token
- [ ] បានបន្ថែម token ក្នុង `backend/.env`
- [ ] បាន restart backend
- [ ] បានទទួល Chat ID ពី @userinfobot
- [ ] បានកំណត់ Telegram ID ក្នុង Users page
- [ ] បានចុច `/start` លើ bot
- [ ] បានធ្វើតេស្ត និងទទួលបានសារ Telegram ✅

---

## 📚 ឯកសារលម្អិតបន្ថែម

សម្រាប់ព័ត៌មានលម្អិត សូមមើល: **TELEGRAM_SETUP_GUIDE.md**

---

**ពេលវេលាសរុប:** ~15 នាទី  
**កម្រិតពិបាក:** ⭐⭐☆☆☆ (ងាយស្រួល)
