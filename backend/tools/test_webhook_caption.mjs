#!/usr/bin/env node
import http from 'http';

const payload = {
  update_id: 681247747,
  message: {
    message_id: 1062,
    from: { id: 776393689, is_bot: false, first_name: 'Net Chantha', username: 'Netchanth' },
    chat: { id: 776393689, first_name: 'Net Chantha', username: 'Netchanth', type: 'private' },
    date: Math.floor(Date.now() / 1000),
    reply_to_message: {
      message_id: 1061,
      from: { id: 8378547640, is_bot: true, first_name: 'Chantha Notification S', username: 'Chantha_hospital_bot' },
      chat: { id: 776393689, first_name: 'Net Chantha', username: 'Netchanth', type: 'private' },
      date: Math.floor(Date.now() / 1000) - 10,
      document: {
        file_name: '036-1770781279029-947674848.pdf',
        mime_type: 'application/pdf',
        file_id: 'BQACAgUAAxkDAAIEJWmR2l6rAtAmUuY1-dFp83IxOcSCAAKBGwAC4gKRVJPA3awNFGHrOgQ',
        file_unique_id: 'AgADgRsAAuICkVQ',
        file_size: 390036
      },
      caption: "📄 មានឯកសាររង់ចាំការពិនិត្យនិងមានមតិយោប់\nកំណត់បង្ហាញ\n🔢 លេខលិខិត ៖ NA\n📂 ប្រភពឯកសារ ៖ ផ្នែកសណ្តំ និងក្រោយសណ្តំ\n📝 កម្មវត្ថុ ៖ សំណើសុំស្ថិតក្នុងភាពទំនេរគ្មានប្រាក់បៀវត្សរយៈពេល២ឆ្នាំ មូលហេតុត្រូវមើលថែកូនតូចៗ និងម្តាយចាស់ជរានៅស្រុកកំណើត ចាប់ពីថ្ងៃ ទី ១ ខែឧសភា ឆ្នាំ២០២៦ ដល់ថ្ងៃទី៣០ ខែមេសា ឆ្នាំ២០២៨។\n📅 ថ្ងៃខែឆ្នាំផ្ញើមតិ ៖ February 15, 2026\n⏰ វេលាម៉ោង ៖ 09:38 PM\n👤 អ្នកទទួល ៖ វេជ្ជបណ្ឌិត ហ៊ុល វណ្ណថុន\nវគ្គ ៖ ប្រធានការិយាល័យ\nមតិ ៖ មិនទាន់ reply មតិបាន\nឯកសារ ៖ 698bfaece711c83574387bf0\n\n📅 ចូលថ្ងៃទី ៖ February 11, 2026\n\n⏰ ម៉ោង ៖ 10:43 AM\n🔢 លេខកត់ត្រា ៖ 698bfaece711c83574387bf0\n💬 សូមចុច Reply នៅលើសារនេះ ដើម្បីផ្ញើមតិរបស់អ្នក\nSTAGE_KEY៖ s1\n🔗 បើកការឆ្លើយតប",
      caption_entities: []
    },
    text: 'អនុម័ត'
  }
};

const data = JSON.stringify(payload);

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/telegram/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Webhook response status:', res.statusCode);
    try { console.log('Body:', JSON.parse(body)); } catch (e) { console.log('Body:', body); }
  });
});

req.on('error', (e) => { console.error('Request error:', e); process.exit(2); });
req.write(data);
req.end();
