// Test adding a new employee via API
const testAddEmployee = async () => {
  const testEmployee = {
    staffId: "CS0012",
    khmerName: "តេស្ត បុគ្គលិក",
    name: "Test Employee",
    gender: "Male",
    dob: "1990-01-01",
    maritalStatus: "Single",
    bloodGroup: "O+",
    phone: "012345678",
    birthPlace: "Phnom Penh",
    currentPlace: "Phnom Penh",
    department: "IT",
    position: "Developer",
    skill: "Software Development",
    salaryLevel: "Level 5",
    officerType: "Civil Servant",
    joinDate: "2025-01-01",
    degreeLevel: "Bachelor",
    degree: "Computer Science",
    educationLevel: "បរិញ្ញាបត្រ",
    officerId: "OF12346",
    cardNumber: "123456789013",
    nid: "987654322",
    bankAccount: "ACC123456790",
    // Civil servant fields
    dateJoinedGov: "01/01/2020",
    dateJoinedMinistry: "01/06/2022",
    yearsInCurrentRank: 3,
    lastSalaryIncrementDate: "01/01/2024",
    rankExitReason: "លទ្ធផលល្អ",
    rankExitDuration: 1,
    grade: "A",
    proposedBy: "នាយកដ្ឋាន",
    yearsInRank: 3,
    totalYearsWorked: 5,
    asOfDate: "08/08/2025",
    // Performance scores
    creativityScore: 8.5,
    responsibilityScore: 9.0,
    patriotismScore: 9.2,
    leadershipScore: 8.0,
    ethicsScore: 9.5,
    // Reasons
    reason1: "ការបំពេញភារកិច្ចល្អ",
    reason2: "មានភាពទំនួលខុសត្រូវខ្ពស់",
    reason3: "គោរពវិន័យ",
    reason4: "បំពេញការងារត្រឹមត្រូវ",
    reason5: "គាំទ្រកិច្ចការរដ្ឋ",
    reason6: "មានស្មារតីជាតិនិយម",
    status: "Active"
  };

  try {
  const base = process.env.API_BASE || 'http://localhost:5000';
  const response = await fetch(`${base}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testEmployee)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Employee created successfully:', result);
    } else {
      const error = await response.json();
      console.error('❌ Error creating employee:', error);
    }
  } catch (error) {
    console.error('❌ Network error:', error);
  }
};

console.log('🧪 Testing employee creation...');
testAddEmployee();
