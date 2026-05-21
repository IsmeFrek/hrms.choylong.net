const axios = require('axios');

async function checkHr() {
    try {
        const { data } = await axios.get('http://localhost:5000/api/hr', {
            params: { q: 'D0489' }
        });
        console.log('D0489:', JSON.stringify(data, null, 2));
        
        const { data: data2 } = await axios.get('http://localhost:5000/api/hr', {
            params: { q: 'D0490' }
        });
        console.log('D0490:', JSON.stringify(data2, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkHr();
