# HRMS (Human Resource Management System)

ប្រព័ន្ធគ្រប់គ្រងធនធានមនុស្សដែលបង្កើតដោយប្រើ React + Vite (Frontend) និង Node.js + MongoDB (Backend)

## 🚀 Features / លក្ខណៈពិសេស

- ✅ **CRUD Operations** - បន្ថែម កែប្រែ លុប និងមើលព័ត៌មានបុគ្គលិក
- ✅ **Responsive Design** - ត្រូវគ្នាជាមួយទូរស័ព្ទ និង Desktop
- ✅ **Search & Filter** - ស្វែងរក និងត្រងព័ត៌មានបុគ្គលិក
- ✅ **Pagination** - បែងចែកទំព័រ
- ✅ **Form Validation** - ពិនិត្យទិន្នន័យបញ្ចូល
- ✅ **Toast Notifications** - សារជូនដំណឹង
- ✅ **Khmer Language Support** - គាំទ្រភាសាខ្មែរ
- ✅ **Telegram Notifications** - ការជូនដំណឹងតាមរយៈ Telegram Bot 📱

## 🛠️ Technologies / បច្ចេកវិទ្យា

### Frontend
- **React 19** - JavaScript Library
- **Vite** - Build Tool
- **Tailwind CSS** - CSS Framework
- **React Hook Form** - Form Management
- **Axios** - HTTP Client
- **React Toastify** - Notifications
- **Lucide React** - Icons
- **Date-fns** - Date Utilities

### Backend
- **Node.js** - Runtime Environment
- **Express.js** - Web Framework
- **MongoDB** - Database
- **Mongoose** - ODM Library
- **CORS** - Cross-Origin Resource Sharing
- **dotenv** - Environment Variables

## 🚀 Running the Application / ដំណើរការកម្មវិធី

### Start Backend Server
```bash
# In backend directory
cd backend
npm run dev
```

### Start Frontend Development Server
```bash
# In root directory
npm run dev
```

### Run Both Servers Simultaneously
```bash
# In root directory
npm run dev-all
```

## 🌐 Access the Application / ចូលប្រើប្រាស់

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Telegram Test Page**: http://localhost:5173/telegram-test

## 📱 Telegram Notifications Setup / ការកំណត់រចនាសម្ព័ន្ធ Telegram

ប្រព័ន្ធគាំទ្រការផ្ញើការជូនដំណឹងតាមរយៈ Telegram Bot។ សម្រាប់ការកំណត់រចនាសម្ព័ន្ធ:

- 📖 **ការណែនាំលម្អិត**: មើល [TELEGRAM_SETUP_GUIDE.md](./TELEGRAM_SETUP_GUIDE.md)
- 🚀 **ការចាប់ផ្តើមរហ័ស (15 នាទី)**: មើល [TELEGRAM_QUICK_START.md](./TELEGRAM_QUICK_START.md)

**សេចក្តីសង្ខេប:**
1. បង្កើត bot តាមរយៈ @BotFather
2. បន្ថែម `TELEGRAM_BOT_TOKEN` ក្នុង `backend/.env`
3. កំណត់ Telegram ID សម្រាប់ users
4. ធ្វើតេស្តនៅ `/telegram-test`


## 📊 Employee Data Structure / រចនាសម្ព័ន្ធទិន្នន័យបុគ្គលិក

```javascript
{
  "status": "Active",                           // ស្ថានភាព
  "image": "profile_image_url",                 // រូបភាព
  "no": 1,                                      // លេខរៀង
  "staffId": "CS004",                           // លេខសម្គាល់បុគ្គលិក
  "khmerName": "សុខ សុភាព",                    // ឈ្មោះជាភាសាខ្មែរ
  "name": "Sok Sophea",                         // ឈ្មោះជាភាសាអង់គ្លេស
  "gender": "Male",                             // ភេទ
  "dob": "1985-03-15",                          // ថ្ងៃខែឆ្នាំកំណើត
  "salaryLevel": "Level 5",                     // កំរិតប្រាក់ខែ
  "officerId": "OF12345",                       // លេខសម្គាល់មន្ត្រី
  "skill": "Accounting",                   // ឯកទេស
  "position": "Accountant",                     // តួនាទី
  "phone": "012345678",                         // លេខទូរស័ព្ទ
  "department": "Finance",                      // ផ្នែក
  "degreeLevel": "Bachelor",                    // កម្រិតសញ្ញាបត្រ
  "degree": "Accounting",                       // វិស័យសិក្សា
  "maritalStatus": "Married",                   // ស្ថានភាពគ្រួសារ
  "bloodGroup": "O+",                           // ក្រុមឈាម
  "officerType": "Civil Servant",               // ប្រភេទមន្ត្រី
  "joinDate": "2010-06-01",                     // កាលបរិច្ឆេទចូលបម្រើការងារ
  "cardNumber": "123456789012",                 // លេខអត្តសញ្ញាណប័ណ្ណ
  "nid": "987654321",                           // លេខសម្គាល់ជាតិ
  "bankAccount": "ACC123456789",                // គណនីធនាគារ
  "birthPlace": "Phnom Penh",                   // កន្លែងកំណើត
  "currentPlace": "Phnom Penh",                 // កន្លែងស្នាក់នៅបច្ចុប្បន្ន
  "other": ""                                   // អ្វីផ្សេងៗ
}
```

## 🔗 API Endpoints / ចំណុចប្រទាក់ API

### hr
- `GET /api/employees` - Get all employees with pagination and search
- `GET /api/employees/:id` - Get single employee
- `POST /api/employees` - Create new employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee
- `GET /api/employees/meta/departments` - Get departments list
- `GET /api/employees/meta/positions` - Get positions list

---

**Developed with ❤️ for efficient HR management**+ Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
