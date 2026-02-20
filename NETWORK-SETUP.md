# 🌐 HRMS System Network Access Guide
# ការណែនាំប្រើប្រាស់ HRMS តាមបណ្តាញ

## 📋 ជំហានដំឡើងសម្រាប់ Network Access

### 1️⃣ រកអាសយដ្ឋាន IP របស់កុំព្យូទ័រ Host
```bash
# Run network setup script
npm run network-setup
```

### 2️⃣ កំណត់ Firewall Settings
**Windows Firewall:**
- បើក Windows Defender Firewall
- Allow apps through firewall
- បន្ថែម Node.js និង Chrome/Browser
- Allow ports 5000 និង 5173

**ឬប្រើ Command:**
```powershell
# Allow ports in Windows Firewall
netsh advfirewall firewall add rule name="HRMS Backend" dir=in action=allow protocol=TCP localport=5000
netsh advfirewall firewall add rule name="HRMS Frontend" dir=in action=allow protocol=TCP localport=5173
```

**ចំណាំ (HTTPS សម្រាប់ Camera):**
- Frontend dev server បច្ចុប្បន្នប្រើ HTTPS ដើម្បីឲ្យ Camera API ដំណើរការ (secure context)
- លើទូរស័ព្ទ អាចត្រូវចុច “Advanced / Proceed” ដើម្បីទុកចិត្ត self‑signed certificate

### 3️⃣ ចាប់ផ្តើម Servers
```bash
# Backend (Terminal 1)
cd backend
npm run dev

# Frontend (Terminal 2) 
npm run dev-network
```

### 4️⃣ Access URLs

**ពីកុំព្យូទ័រ Host:**
- Frontend: https://localhost:5173
- Backend: http://localhost:5000

**ពីកុំព្យូទ័រផ្សេង (Network):**
- Frontend: https://[YOUR_IP]:5173
- Backend: http://[YOUR_IP]:5000

## 🔧 Configuration Files

### .env File Configuration
```env
# Local development
VITE_API_BASE_URL=http://localhost:5000/api

# Network access (replace with your IP)
VITE_API_BASE_URL=http://192.168.8.79:5000/api
```

### vite.config.js
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listen on all interfaces
    port: 5173
  }
})
```

## 🔍 Network Troubleshooting

### 1. មិនអាចចូលបាន
- ពិនិត្យ IP address តែមួយ
- ពិនិត្យ Firewall settings
- ពិនិត្យ Network connection
- ប្រាកដថាកុំព្យូទ័រទាំងអស់នៅលើ network តែមួយ

### 2. API calls មិនដំណើរការ
- ពិនិត្យ .env file configuration
- ពិនិត្យ CORS settings in backend
- ពិនិត្យ browser console for errors

### 3. រក IP Address
```bash
# Windows Command Prompt
ipconfig

# PowerShell
Get-NetIPAddress -AddressFamily IPv4

# Alternative
hostname -I
```

## 📱 Mobile Access

កុំព្យូទ័រនេះអាចចូលបានពីទូរស័ព្ទដែរ:
1. ភ្ជាប់ទូរស័ព្ទទៅ WiFi តែមួយ
2. បើក browser 
3. ចូលទៅ https://[YOUR_IP]:5173
4. បើមាន Security warning សូមចុច “Advanced / Proceed” (dev certificate)

## 🚀 Production Deployment

សម្រាប់ Production:
1. Build frontend: `npm run build`
2. Deploy backend to server (DigitalOcean, Heroku, AWS)
3. Configure domain name
4. Setup SSL certificate
5. Configure environment variables

## 📞 Support

តើមានបញ្ហា? ពិនិត្យ:
- Network connectivity
- Firewall settings
- Port availability
- IP address correctness

---
**ចំណាំ:** ប្រយ័ត្នសុវត្ថិភាពបណ្តាញ និងកុំបើកចូលពីខាងក្រៅបើមិនចាំបាច់។
