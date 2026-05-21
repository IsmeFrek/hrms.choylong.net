import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Replace this with your actual HTTPS URL (e.g. from ngrok)
const WEB_APP_URL = process.env.TELEGRAM_WEB_APP_URL || 'https://your-ngrok-url.ngrok-free.app/telegram-mini-app';

async function setup() {
  if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
    return;
  }

  console.log(`🚀 Setting up Menu Button for Bot...`);
  console.log(`App URL: ${WEB_APP_URL}`);

  try {
    const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
      menu_button: {
        type: 'web_app',
        text: 'ស្កេនវត្តមាន',
        web_app: {
          url: WEB_APP_URL
        }
      }
    });

    if (response.data.ok) {
      console.log('✅ Menu Button set successfully!');
    } else {
      console.error('❌ Failed to set Menu Button:', response.data);
    }
  } catch (error) {
    console.error('❌ Error calling Telegram API:', error.message);
  }
}

setup();
