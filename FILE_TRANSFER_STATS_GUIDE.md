# ស្ថិតិឯកសារផ្ទេរ (File Transfer Statistics)

## ការពិពណ៌នា

ប្រព័ន្ធនេះធ្វើការបូកសរុបទិន្នន័យឯកសារផ្ទេរតាមស្ថានភាពនៃការបំពេញមតិ។ វាបានចាត់ថ្នាក់ឯកសារទៅក្នុង ៣ ប្រភេទដូចខាងក្រោម៖

## ប្រភេទស្ថានភាព

### 1. រួចរាល់ (Completed)
- **និយមន័យ**: ឯកសារដែលមានមតិបំពេញរួចរាល់យ៉ាងហោចណាស់មួយវគ្គ
- **លក្ខណៈវិនិច្ឆ័យ**: មានទិន្នន័យក្នុងវាលមតិ (CourseNote, Course1Note, Course2Note, ...)
- **ពណ៌បង្ហាញ**: បៃតង (Green)

### 2. មិនទាន់រួច (Not Yet Completed)
- **និយមន័យ**: ឯកសារដែលមានការកំណត់វគ្គមតិ ប៉ុន្តែមិនទាន់មានមតិបំពេញ
- **លក្ខណៈវិនិច្ឆ័យ**: មាន feedbackStages កំណត់ ប៉ុន្តែគ្មានការបំពេញមតិ
- **ពណ៌បង្ហាញ**: លឿង (Yellow)

### 3. មិនមានផ្ញើមតិ (No Feedback Sent)
- **និយមន័យ**: ឯកសារដែលមិនទាន់មានការកំណត់វគ្គមតិណាមួយ
- **លក្ខណៈវិនិច្ឆ័យ**: គ្មាន feedbackStages ឬ feedbackStages ទទេ
- **ពណ៌បង្ហាញ**: ក្រហម (Red)

## API Endpoints

### 1. GET `/api/file-transfer-stats`
ទាញយកស្ថិតិសង្ខេប

**Response Example:**
```json
{
  "summary": {
    "រួចរាល់": 15,
    "មិនទាន់រួច": 8, 
    "មិនមានផ្ញើមតិ": 12,
    "សរុប": 35
  },
  "typeBreakdown": {
    "លិខិតផ្ទៃក្នុង": {
      "completed": 10,
      "notCompleted": 5,
      "noFeedback": 3,
      "total": 18
    },
    "លិខិតចេញ": {
      "completed": 5,
      "notCompleted": 3,
      "noFeedback": 9,
      "total": 17
    }
  }
}
```

### 2. GET `/api/file-transfer-stats/detailed?status=completed`
ទាញយកបញ្ជីលម្អិតតាមស្ថានភាព

**Parameters:**
- `status`: completed, notCompleted, noFeedback (optional)

**Response Example:**
```json
{
  "status": "completed",
  "records": [
    {
      "_id": "64f123...",
      "type": "លិខិតផ្ទៃក្នុង",
      "letterNo": "001/2024",
      "source": "ការិយាល័យនាយក",
      "date": "2024-01-15",
      "content": "ស្នើសុំ...",
      "status": "រួចរាល់",
      "lastCompletedStage": {
        "stage": "S1",
        "note": "អនុម័តអោយប្រើ...",
        "date": "2024-01-20"
      }
    }
  ],
  "total": 15
}
```

## Frontend Components

### 1. FileTransferStats (Full Statistics Page)
- ទំព័រពេញលេញសម្រាប់មើលស្ថិតិ
- បង្ហាញទិន្នន័យជារូបភាពបារ និងតាราង
- មានមុខងារបង្ហាញលម្អិតបន្ថែម

### 2. FileTransferSummaryCards (Compact Summary)
- កាតសង្ខេបសម្រាប់បង្ហាញក្នុងទំព័រមេ
- អាចលាក់/បង្ហាញបាន
- ធ្វើ refresh ស្វ័យប្រវត្តិ

## การใช้งาน Code

### Backend - Aggregation Logic
```javascript
// ក្នុង backend/routes/fileTransferStats.js
const fileTransfers = await FileTransfer.find({}).lean();
const stageNoteKeys = {
  'S': 'CourseNote',
  'S1': 'Course1Note',
  'S2': 'Course2Note'
  // ...
};

fileTransfers.forEach(ft => {
  const meta = ft.meta || {};
  const feedbackStages = meta.feedbackStages || {};
  
  // ពិនិត្យមើលវគ្គដែលកំណត់
  const hasAssignedStages = Object.keys(feedbackStages)
    .some(key => feedbackStages[key] && String(feedbackStages[key]).trim() !== '');
  
  if (!hasAssignedStages) {
    noFeedback++;
  } else {
    // ពិនិត្យមើលការបំពេញមតិ
    let hasCompletedStage = false;
    for (const stageKey of stageSequence) {
      const noteKey = stageNoteKeys[stageKey];
      if (noteKey && meta[noteKey] && String(meta[noteKey]).trim()) {
        hasCompletedStage = true;
        break;
      }
    }
    
    if (hasCompletedStage) completed++;
    else notCompleted++;
  }
});
```

### Frontend - Display Component
```jsx
// ក្នុង src/components/FileTransferStats.jsx
import { getFileTransferStats } from '../api/fileTransferStats';

function FileTransferStats() {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    fetchStats();
  }, []);
  
  const fetchStats = async () => {
    const data = await getFileTransferStats();
    setStats(data);
  };
  
  return (
    <div>
      <div className="grid grid-cols-4 gap-6">
        <StatCard 
          title="រួចរាល់" 
          value={stats?.summary?.រួចរាល់} 
          color="green" 
        />
        <StatCard 
          title="មិនទាន់រួច" 
          value={stats?.summary?.មិនទាន់រួច} 
          color="yellow" 
        />
        <StatCard 
          title="មិនមានផ្ញើមតិ" 
          value={stats?.summary?.មិនមានផ្ញើមតិ} 
          color="red" 
        />
      </div>
    </div>
  );
}
```

## Testing

ដើម្បីសាកល្បងប្រព័ន្ធ:

1. **Backend API Test:**
```bash
cd backend
node test-file-transfer-stats.js
```

2. **Frontend Test:**
- ចូលទៅកាន់ `/file-transfer-stats` 
- ឬបើកស្ថិតិសង្ខេបក្នុងទំព័រ `/file-transfer`

## Database Schema

ការចាត់ថ្នាក់ស្ថានភាពគឺផ្អែកលើ:

```javascript
// FileTransfer document structure
{
  _id: ObjectId,
  type: String,
  letterNo: String,
  source: String,
  date: Date,
  content: String,
  meta: {
    feedbackStages: {
      s: "userId1",    // Stage assignments
      s1: "userId2",
      s2: "userId3"
    },
    CourseNote: "មតិវគ្គ S",      // Feedback content
    Course1Note: "មតិវគ្គ S1",    
    Course2Note: "មតិវគ្គ S2",
    CourseDate: ISODate,          // Feedback dates
    Course1Date: ISODate,
    Course2Date: ISODate
  }
}
```

## Performance Considerations

- ការបូកសរុបធ្វើនៅ backend ដើម្បីកាត់បន្ថយការផ្ទេរទិន្នន័យ
- ប្រើ `.lean()` សម្រាប់ MongoDB query ដើម្បីឱ្យលឿន
- Frontend cache ទិន្នន័យតាមតម្រូវការ
- មានមុខងារ refresh manual និង auto-refresh

## Next Steps

1. បន្ថែម filter តាមកាលបរិច្ឆេទ
2. Export ទិន្នន័យជា CSV/PDF
3. Real-time updates ដោយប្រើ WebSocket
4. Dashboard widget សម្រាប់ទំព័រដើម