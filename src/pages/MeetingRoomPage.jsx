import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoorClosed, Users, Clock, Calendar, Search, Filter, Plus, CheckCircle2, XCircle, Eye, ClipboardList, User, ShieldCheck } from 'lucide-react';

export default function MeetingRoomPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modal states
  const [activeBookingPages, setActiveBookingPages] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [customRoomImages, setCustomRoomImages] = useState(() => {
    try {
      const stored = localStorage.getItem('custom_room_images');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageModalRoomId, setImageModalRoomId] = useState(null);
  const [tempImageUrl, setTempImageUrl] = useState('');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [moderator, setModerator] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('10:25');
  const [endTime, setEndTime] = useState('12:00');
  const [participantCount, setParticipantCount] = useState('');
  const [requiredEquipment, setRequiredEquipment] = useState('');
  const [technicianNeeded, setTechnicianNeeded] = useState('មិនមាន');
  const [remarks, setRemarks] = useState('');

  const [databaseBookings, setDatabaseBookings] = useState([]);

  const API_BASE_RAW = (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/+$/, '')) || '';
  const API_PREFIX = API_BASE_RAW ? `${API_BASE_RAW}/api` : '/api';

  const fetchBookings = async () => {
    try {
      const res = await fetch(`${API_PREFIX}/meeting-rooms`);
      if (res.ok) {
        const data = await res.json();
        setDatabaseBookings(data);
      }
    } catch (err) {
      console.error("Error fetching bookings:", err);
    }
  };

  useEffect(() => {
    fetchBookings();
    
    // Silently sync Google Sheets in background when user opens the page
    const silentSync = async () => {
      try {
        const res = await fetch(`${API_PREFIX}/meeting-rooms/sync-google-sheet`, {
          method: 'POST'
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            fetchBookings();
          }
        }
      } catch (err) {
        console.warn('[SilentSync] Background sync failed:', err);
      }
    };
    silentSync();

    const interval = setInterval(fetchBookings, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const getYYYYMMDD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const parseTimeString = (timeStr) => {
    const now = new Date(); 
    const [time, ampm] = timeStr.split(" "); 
    let [hours, minutes] = time.split(":").map(Number);
    if (ampm === "PM" && hours < 12) hours += 12; 
    if (ampm === "AM" && hours === 12) hours = 0;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  };

  const checkActualBookingStatus = (bookingInfo) => {
    const now = new Date();
    const start = parseTimeString(bookingInfo.startTime);
    const end = parseTimeString(bookingInfo.endTime);
    const diffToStart = (start - now) / (1000 * 60);
    const diffToEnd = (end - now) / (1000 * 60);

    if (now > end) return { type: "ended", label: "បញ្ចប់" };
    if (now >= start && now <= end) {
      if (diffToEnd <= 15) return { type: "ongoing", label: "ជិតបញ្ចប់" };
      return { type: "ongoing", label: "កំពុងប្រជុំ" };
    }
    if (now < start) {
      if (diffToStart <= 15 && diffToStart > 0) return { type: "pending_start", label: "ជិតចូល" };
      return { type: "booked", label: "កក់រួច" };
    }
    return { type: "booked", label: "កក់រួច" };
  };

  const getSlotFromTime = (timeStr) => {
    if (!timeStr) return "08:00 - 10:00";
    const [hour] = timeStr.split(':').map(Number);
    if (hour < 10) return "08:00 - 10:00";
    if (hour < 12) return "10:00 - 12:00";
    if (hour < 14) return "12:00 - 14:00";
    if (hour < 16) return "14:00 - 16:00";
    return "16:00 - 18:00";
  };

  const baseRooms = [
    { 
      id: "bayon", 
      name: 'បន្ទប់ប្រជុំបាយ័ន', 
      capacity: 20, 
      image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=500&auto=format&fit=crop&q=60', 
      equipment: ['Projector', 'Sound System', 'AC'] 
    },
    { 
      id: "neakpoan", 
      name: 'បន្ទប់នាគព័ន្ធ', 
      capacity: 12, 
      image: 'https://images.unsplash.com/photo-1503418895522-46f9804cda40?w=500&auto=format&fit=crop&q=60', 
      equipment: ['TV', 'Sound System'] 
    },
    { 
      id: "banteaysrei", 
      name: 'បន្ទប់បន្ទាយស្រី', 
      capacity: 8, 
      image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=500&auto=format&fit=crop&q=60', 
      equipment: ['TV', 'Whiteboard', 'AC'] 
    },
    { 
      id: "preahkhan", 
      name: 'បន្ទប់ព្រះខ័ណ', 
      capacity: 25, 
      image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=500&auto=format&fit=crop&q=60', 
      equipment: ['Full Tech', 'Stage'] 
    },
    { 
      id: "administration", 
      name: 'បន្ទប់រដ្ឋបាល', 
      capacity: 10, 
      image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format&fit=crop&q=60', 
      equipment: ['Printer', 'Scanner'] 
    },
    { 
      id: "waiting", 
      name: 'បន្ទប់រង់ចាំ', 
      capacity: 15, 
      image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=500&auto=format&fit=crop&q=60', 
      equipment: ['Lounge', 'Drinks'] 
    }
  ];

  const todayStr = getYYYYMMDD(new Date());

  const rooms = baseRooms.map(room => {
    const roomBookings = databaseBookings.filter(b => 
      !b.isCancelled && 
      b.roomId === room.id && 
      b.dateStr === todayStr
    );

    let status = 'available';
    roomBookings.forEach(booking => {
      const bStatus = checkActualBookingStatus(booking);
      if (bStatus.type === 'ongoing') {
        status = 'busy';
      }
    });

    // Filter out ended bookings
    const activeTodayBookings = roomBookings.filter(booking => {
      const bStatus = checkActualBookingStatus(booking);
      return bStatus.type !== 'ended';
    });

    // Sort bookings by closeness to current time (prioritize ongoing first, then by startTime ascending)
    const sortedTodayBookings = [...activeTodayBookings].sort((a, b) => {
      const statusA = checkActualBookingStatus(a).type;
      const statusB = checkActualBookingStatus(b).type;
      
      // Prioritize ongoing
      if (statusA === 'ongoing' && statusB !== 'ongoing') return -1;
      if (statusB === 'ongoing' && statusA !== 'ongoing') return 1;
      
      // Prioritize pending_start
      if (statusA === 'pending_start' && statusB !== 'pending_start') return -1;
      if (statusB === 'pending_start' && statusA !== 'pending_start') return 1;
      
      // Otherwise sort by start time ascending
      return parseTimeString(a.startTime) - parseTimeString(b.startTime);
    });

    const bookings = sortedTodayBookings.map(b => ({
      date: b.dateStr,
      time: `${b.startTime} - ${b.endTime}`,
      title: b.title,
      moderator: b.user,
      participants: b.participants || '5 នាក់',
      equipment: b.amenities || '',
      technician: 'មិនមាន',
      remarks: b.note || ''
    }));

    const customImg = customRoomImages[room.id];

    return {
      ...room,
      image: customImg || room.image,
      status,
      bookings
    };
  });

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || room.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const toKhmerDigits = (num) => {
    if (num === undefined || num === null) return '០';
    const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
    return num.toString().split('').map(digit => khmerDigits[parseInt(digit)] || digit).join('');
  };

  const openBookingModal = (room) => {
    setSelectedRoom(room);
    setIsModalOpen(true);
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hour, minute] = timeStr.split(':');
    let h = parseInt(hour);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h.toString().padStart(2, '0')}:${minute} ${ampm}`;
  };

  const formatDateKhmer = (date) => {
    const months = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
    const days = ["អាទិត្យ", "ច័ន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const handleBook = async () => {
    if (!meetingTitle || !meetingDate || !startTime || !endTime || !moderator) {
      alert('សូមបំពេញព័ត៌មានកាតព្វកិច្ច (មានសញ្ញា *) ឱ្យបានគ្រប់គ្រាន់!');
      return;
    }

    const startAMPM = formatTime(startTime);
    const endAMPM = formatTime(endTime);
    const slot = getSlotFromTime(startTime);

    const bookingPayload = {
      title: meetingTitle,
      user: moderator,
      roomId: selectedRoom.id,
      slot: slot,
      roomName: selectedRoom.name,
      dateStr: meetingDate,
      dateText: formatDateKhmer(new Date(meetingDate)),
      startTime: startAMPM,
      endTime: endAMPM,
      participants: participantCount ? `${participantCount} នាក់` : "5 នាក់",
      amenities: requiredEquipment || "",
      attachmentUrl: "",
      attachmentName: "",
      attachmentSize: 0,
      note: remarks || "",
      isCancelled: false
    };

    try {
      const res = await fetch(`${API_PREFIX}/meeting-rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload)
      });

      if (res.ok) {
        await fetchBookings();
        
        // Reset and close
        setIsModalOpen(false);
        setSelectedRoom(null);
        setMeetingTitle('');
        setModerator('');
        setMeetingDate(new Date().toISOString().slice(0, 10));
        setStartTime('10:25');
        setEndTime('12:00');
        setParticipantCount('');
        setRequiredEquipment('');
        setTechnicianNeeded('មិនមាន');
        setRemarks('');
      } else {
        const errText = await res.text();
        alert("បរាជ័យក្នុងការរក្សាទុក៖ " + errText);
      }
    } catch (err) {
      console.error("Error saving booking:", err);
      alert("មានបញ្ហាក្នុងការតភ្ជាប់ទៅកាន់ម៉ាស៊ីនមេ!");
    }
  };

  const openImageModal = (roomId, currentImage) => {
    setImageModalRoomId(roomId);
    setTempImageUrl(currentImage || '');
    setIsImageModalOpen(true);
  };

  const handleSaveImage = (url) => {
    if (!url) return;
    const updated = { ...customRoomImages, [imageModalRoomId]: url };
    setCustomRoomImages(updated);
    localStorage.setItem('custom_room_images', JSON.stringify(updated));
    setIsImageModalOpen(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      handleSaveImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen relative">
      {/* Header, Search (A), Filter (B) and Action Tabs merged into 1 Row */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        {/* Left Side: Header, Search (A), and Filter (B) */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
          {/* Header */}
          <div className="flex-shrink-0">
            <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <span className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-md shadow-indigo-200 text-base">🚪</span>
              បន្ទប់ប្រជុំ
            </h3>
            <p className="text-gray-500 mt-0.5 text-xs">
              គ្រប់គ្រង និងកក់បន្ទប់ប្រជុំសម្រាប់ការពិភាក្សាការងារ
            </p>
          </div>

          {/* Search Input (A) */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="ស្វែងរកបន្ទប់ប្រជុំ..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter Dropdown (B) */}
          <div className="relative w-full md:w-44">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              className="w-full pl-10 pr-8 py-2 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-medium appearance-none"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">ស្ថានភាពទាំងអស់</option>
              <option value="available">ទំនេរ</option>
              <option value="busy">កំពុងប្រើប្រាស់</option>
            </select>
          </div>
        </div>

        {/* Right Side: Status Tabs */}
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100 flex-wrap flex-shrink-0">
          <button
            onClick={() => setSelectedStatus('all')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${selectedStatus === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            ទាំងអស់ ({toKhmerDigits(rooms.length)})
          </button>
          <button
            onClick={() => setSelectedStatus('available')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${selectedStatus === 'available' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            ទំនេរ ({toKhmerDigits(rooms.filter(r => r.status === 'available').length)})
          </button>
          <button
            onClick={() => setSelectedStatus('busy')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${selectedStatus === 'busy' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            កំពុងប្រើប្រាស់ ({toKhmerDigits(rooms.filter(r => r.status === 'busy').length)})
          </button>
        </div>
      </div>

      {/* Rooms Horizontal Scroll Container */}
      {(() => {
        const getRoomSortPriority = (room) => {
          if (room.status === 'busy') return 1; // កំពុងប្រជុំ
          if (room.bookings.length > 0) return 2; // ជិតប្រជុំ / មានការកក់
          return 3; // ទំនេរ (គ្មានការកក់សោះ)
        };

        const sortedRooms = [...filteredRooms].sort((a, b) => {
          const prioA = getRoomSortPriority(a);
          const prioB = getRoomSortPriority(b);
          if (prioA !== prioB) {
            return prioA - prioB;
          }
          
          const hasA = a.bookings && a.bookings.length > 0;
          const hasB = b.bookings && b.bookings.length > 0;
          if (hasA && hasB) {
            const timeAStr = a.bookings[0].time.split(' - ')[0];
            const timeBStr = b.bookings[0].time.split(' - ')[0];
            return parseTimeString(timeAStr) - parseTimeString(timeBStr);
          }
          return 0;
        });

        return (
          <div className="flex gap-6 overflow-x-auto pb-6 scroll-smooth snap-x snap-mandatory scrollbar-thin select-none">
            {sortedRooms.map(room => (
              <div key={room.id} className="group bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 min-w-[320px] md:min-w-[350px] max-w-[350px] w-full flex-shrink-0 snap-start flex flex-col justify-between">
                <div>
                  <div className="h-48 overflow-hidden relative">
                    <img 
                      src={room.image} 
                      alt={room.name} 
                      onClick={() => {
                        setPreviewImageUrl(room.image);
                        setIsPreviewModalOpen(true);
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                      title="ចុចដើម្បីពង្រីករូបភាព"
                    />
                    <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold ${room.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {room.status === 'available' ? 'ទំនេរ' : 'កំពុងប្រើប្រាស់'}
                    </div>
                    {/* Change Image Overlay Button */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        openImageModal(room.id, room.image);
                      }}
                      className="absolute top-4 left-4 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 backdrop-blur-sm cursor-pointer"
                      title="ប្តូររូបភាព"
                    >
                      📷
                    </button>
                  </div>
                  <div className="p-6">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-sm">
                      <span className="font-bold text-gray-900">{room.name}</span>
                      <span className="text-gray-500 flex items-center gap-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        ចំណុះ៖ {toKhmerDigits(room.capacity)} នាក់
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {room.equipment.map((eq, idx) => (
                          <span key={idx} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold">{eq}</span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Bookings List (Paginated / Sliding Pages) */}
                    <div className="mt-4 border-t pt-4 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-gray-400 uppercase">ការកក់សរុប ({toKhmerDigits(room.bookings.length)})</p>
                        {room.bookings.length > 1 && (
                          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200/50">
                            {room.bookings.map((_, idx) => (
                              <button
                                key={idx}
                                onClick={() => setActiveBookingPages(prev => ({ ...prev, [room.id]: idx }))}
                                className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black transition-all ${
                                  (activeBookingPages[room.id] || 0) === idx
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-gray-500 hover:bg-white hover:text-gray-800'
                                }`}
                              >
                                {toKhmerDigits(idx + 1)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="min-h-[220px] flex flex-col justify-between">
                        {room.bookings.length > 0 ? (
                          (() => {
                            const activeIdx = activeBookingPages[room.id] || 0;
                            const b = room.bookings[activeIdx] || room.bookings[0];
                            if (!b) return null;
                            return (
                              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs space-y-1.5 animate-fade-in-up flex-1 flex flex-col justify-between">
                                <div className="space-y-1.5">
                                  <div className="font-bold text-gray-800 text-sm flex items-center gap-1.5 leading-snug">
                                    👉📚 {b.title}
                                  </div>
                                  <div className="text-gray-600 flex items-center gap-1.5">
                                    👨‍🏫 អ្នកសម្របសម្រួល: {b.moderator}
                                  </div>
                                  <div className="text-gray-600 flex items-center gap-1.5">
                                    📍 ទីតាំង: {room.name}
                                  </div>
                                  <div className="text-gray-600 flex items-center gap-1.5">
                                    📅 កាលបរិច្ឆេទ: {b.date}
                                  </div>
                                  <div className="text-gray-600 flex items-center gap-1.5 flex-wrap">
                                    ⏰ ម៉ោង: <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold">{b.time}</span>
                                  </div>
                                  {b.equipment && (
                                    <div className="text-gray-600 flex items-center gap-1.5">
                                      🛠️ សម្ភារៈ: {b.equipment}
                                    </div>
                                  )}
                                  {b.technician && (
                                    <div className="text-gray-600 flex items-center gap-1.5">
                                      👩‍💻 អ្នកបច្ចេកទេស: {b.technician}
                                    </div>
                                  )}
                                  {b.participants && (
                                    <div className="text-gray-600 flex items-center gap-1.5">
                                      👥 ចូលរួម: {toKhmerDigits(b.participants)} នាក់
                                    </div>
                                  )}
                                </div>
                                {b.remarks && (
                                  <div className="text-gray-500 italic mt-2 border-t pt-1.5 text-[10.5px]">
                                    📝 ចំណាំ: {b.remarks}
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200 flex items-center justify-center flex-1">
                            <p className="text-xs text-gray-400 font-medium">មិនទាន់មានការកក់នៅឡើយទេ</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0">
                  <button 
                    onClick={() => navigate('/meeting-rooms-v2')}
                    className={`w-full py-3 rounded-xl font-bold transition-all shadow-lg text-white ${
                      room.bookings.length > 0 
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-orange-100/50' 
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                    }`}
                  >
                    {room.bookings.length > 0 ? 'កែប្រែ' : 'កក់បន្ទប់ឥឡូវនេះ'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Booking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">កក់បន្ទប់ប្រជុំ</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-1">បន្ទប់</label>
                    <input 
                      type="text" 
                      value={selectedRoom?.name || ''} 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-500"
                      disabled 
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-1">កាលបរិច្ឆេទ <span className="text-red-500">*</span></label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-1">ប្រធានបទប្រជុំ <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      placeholder="ឧទាហរណ៍៖ ប្រជុំពិភាក្សាគម្រោង" 
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-1">អ្នកសម្របសម្រួល <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      placeholder="ឧទាហរណ៍៖ លោក នេត ចន្ថា" 
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={moderator}
                      onChange={(e) => setModerator(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-1">ម៉ោងចាប់ផ្តើម <span className="text-red-500">*</span></label>
                    <input 
                      type="time" 
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-1">ម៉ោងបញ្ចប់ <span className="text-red-500">*</span></label>
                    <input 
                      type="time" 
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-1">ចំនួនអ្នកចូលរួម</label>
                    <input 
                      type="number" 
                      placeholder="ឧទាហរណ៍៖ ១៥" 
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={participantCount}
                      onChange={(e) => setParticipantCount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-1">ស្នើសុំអ្នកបច្ចេកទេស</label>
                    <input 
                      type="text" 
                      placeholder="ឧទាហរណ៍៖ មិនមាន ឬ ត្រូវការម្នាក់" 
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={technicianNeeded}
                      onChange={(e) => setTechnicianNeeded(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-1">ស្នើសុំសម្ភារៈ</label>
                  <input 
                    type="text" 
                    placeholder="ឧទាហរណ៍៖ សំភារៈ បទបង្ហាញ, សំភារៈ សម្លេង" 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={requiredEquipment}
                    onChange={(e) => setRequiredEquipment(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-1">ផ្សេងៗ (ចំណាំ)</label>
                  <textarea 
                    placeholder="ឧទាហរណ៍៖ ទឹកសុទ្ធ" 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all h-20"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  បោះបង់
                </button>
                <button 
                  onClick={handleBook}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                >
                  យល់ព្រម
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Image Modal */}
      {isImageModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">ប្តូររូបភាពបន្ទប់ប្រជុំ</h3>
                <button 
                  onClick={() => setIsImageModalOpen(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Preview */}
                <div className="h-40 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center relative">
                  {tempImageUrl ? (
                    <img src={tempImageUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-gray-400">គ្មានរូបភាពគំរូឡើយ</span>
                  )}
                </div>

                {/* Option 1: File Upload */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">ផ្ទុកឡើងរូបភាពពីកុំព្យូទ័រ</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 file:cursor-pointer"
                  />
                </div>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="flex-shrink mx-4 text-gray-400 text-xs font-bold">ឬ</span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>

                {/* Option 2: Image URL */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">បញ្ចូលលីងរូបភាព (Image URL)</label>
                  <input 
                    type="text" 
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                    value={tempImageUrl && tempImageUrl.startsWith('data:') ? '' : tempImageUrl}
                    onChange={(e) => setTempImageUrl(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsImageModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-xs font-bold"
                  >
                    បោះបង់
                  </button>
                  <button
                    onClick={() => handleSaveImage(tempImageUrl)}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors text-xs font-bold shadow-md shadow-indigo-100"
                  >
                    រក្សាទុក
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Zoom Image Modal */}
      {isPreviewModalOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm transition-opacity duration-350 cursor-pointer"
          onClick={() => setIsPreviewModalOpen(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center select-none" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button 
              onClick={() => setIsPreviewModalOpen(false)}
              className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white rounded-full p-2.5 transition-all outline-none border border-white/10 cursor-pointer text-sm font-bold"
            >
              ✕
            </button>
            
            <img 
              src={previewImageUrl} 
              alt="Preview" 
              className="rounded-2xl max-w-full max-h-[85vh] object-contain shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
}
