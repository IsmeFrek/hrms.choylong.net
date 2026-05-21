import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Clock, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  FileText, 
  Bell, 
  Users, 
  Monitor, 
  Wifi, 
  Coffee, 
  ShieldCheck,
  Video,
  CheckCircle2,
  Hourglass,
  X,
  Copy,
  PenLine,
  LayoutDashboard,
  Trash2
} from 'lucide-react';

const TelegramIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.4.52-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.42-1.4-.88.03-.24.36-.49.99-.75 3.87-1.69 6.45-2.8 7.74-3.34 3.69-1.54 4.45-1.81 4.95-1.82.11 0 .36.03.52.16.14.11.18.27.2.42.02.13-.01.29-.02.39z"/>
  </svg>
);

const getYYYYMMDD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const todayStr = getYYYYMMDD(new Date());

export default function MeetingRoomV2Page() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentFilterMode, setCurrentFilterMode] = useState("all");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [reportText, setReportText] = useState("");
  const [viewMode, setViewMode] = useState("rooms-rows"); // "rooms-rows" | "rooms-cols"
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [originalBookingForEdit, setOriginalBookingForEdit] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [newBookingData, setNewBookingData] = useState({
    title: "",
    user: "",
    roomId: "bayon",
    slot: "08:00 - 10:00",
    startTime: "08:00 AM",
    endTime: "09:30 AM",
    participants: "5 នាក់",
    amenities: "",
    attachmentUrl: "",
    attachmentName: "",
    attachmentSize: 0,
    note: ""
  });

  const handleOpenCreateModal = (roomId, slot) => {
    const [start, end] = slot.split(" - ");
    const formatAMPM = (timeStr) => {
      const [h, m] = timeStr.split(":").map(Number);
      const suffix = h >= 12 ? "PM" : "AM";
      const displayH = h % 12 || 12;
      const displayHStr = String(displayH).padStart(2, '0');
      return `${displayHStr}:${String(m).padStart(2, '0')} ${suffix}`;
    };
    
    const roomInfo = rooms.find(r => r.id === roomId);
    setNewBookingData({
      title: "",
      user: "",
      roomId: roomId,
      slot: slot,
      startTime: formatAMPM(start),
      endTime: formatAMPM(end),
      participants: "5 នាក់",
      amenities: roomInfo ? roomInfo.amenities.join(", ") : "",
      attachmentUrl: "",
      attachmentName: "",
      attachmentSize: 0,
      note: ""
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenCreateModalDefault = () => {
    const defaultRoom = rooms[0];
    setNewBookingData({
      title: "",
      user: "",
      roomId: defaultRoom?.id || "bayon",
      slot: columns[0] || "08:00 - 10:00",
      startTime: "08:00 AM",
      endTime: "09:30 AM",
      participants: "5 នាក់",
      amenities: defaultRoom ? defaultRoom.amenities.join(", ") : "",
      attachmentUrl: "",
      attachmentName: "",
      attachmentSize: 0,
      note: ""
    });
    setIsCreateModalOpen(true);
  };

  const formatBookingsFromDb = (dbBookings) => {
    const map = {};
    dbBookings.forEach(booking => {
      const { dateStr, roomId, slot } = booking;
      if (!map[dateStr]) map[dateStr] = {};
      if (!map[dateStr][roomId]) map[dateStr][roomId] = {};
      if (!map[dateStr][roomId][slot]) map[dateStr][roomId][slot] = [];
      
      map[dateStr][roomId][slot].push(booking);
    });
    return map;
  };

  const API_BASE_RAW = (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/+$/, '')) || '';
  const API_PREFIX = API_BASE_RAW ? `${API_BASE_RAW}/api` : '/api';

  const fetchBookings = async () => {
    try {
      const res = await fetch(`${API_PREFIX}/meeting-rooms`);
      if (res.ok) {
        const data = await res.json();
        setDatabaseBookings(formatBookingsFromDb(data));
      }
    } catch (err) {
      console.error("Error fetching bookings:", err);
    }
  };

  const handleSyncGoogleSheet = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_PREFIX}/meeting-rooms/sync-google-sheet`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        // Refresh bookings list
        await fetchBookings();
      } else {
        alert("បរាជ័យក្នុងការទាញទិន្នន័យ៖ " + (data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Error syncing Google Sheet:", err);
      alert("មានបញ្ហាក្នុងការតភ្ជាប់ទៅកាន់ម៉ាស៊ីនមេ!");
    } finally {
      setIsSyncing(false);
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
  }, []);

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("ទំហំឯកសារធំពេក! អនុញ្ញាតត្រឹម 20MB ប៉ុណ្ណោះ។");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_PREFIX}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setNewBookingData(prev => ({
          ...prev,
          attachmentUrl: data.url,
          attachmentName: data.originalName || data.filename,
          attachmentSize: data.size
        }));
      } else {
        const errData = await res.json();
        alert("បរាជ័យក្នុងការបង្ហោះឯកសារ៖ " + (errData.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Error uploading file:", err);
      alert("មានបញ្ហាក្នុងការបង្ហោះឯកសារទៅកាន់ម៉ាស៊ីនមេ!");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = () => {
    setNewBookingData(prev => ({
      ...prev,
      attachmentUrl: "",
      attachmentName: "",
      attachmentSize: 0
    }));
  };

  const handleSaveBooking = async (e) => {
    e.preventDefault();
    if (!newBookingData.title || !newBookingData.user) {
      alert("សូមបំពេញប្រធានបទ និងអ្នកដឹកនាំប្រជុំ!");
      return;
    }

    const { roomId, slot, title, user, startTime, endTime, participants, amenities, attachmentUrl, attachmentName, attachmentSize, note } = newBookingData;
    const roomInfo = rooms.find(r => r.id === roomId);

    const bookingPayload = {
      title,
      user,
      roomId,
      slot,
      roomName: roomInfo ? roomInfo.name : roomId,
      dateStr: dateStr,
      dateText: formatDateKhmer(currentDate),
      startTime,
      endTime,
      participants,
      amenities,
      attachmentUrl,
      attachmentName,
      attachmentSize,
      note,
      isCancelled: isEditMode && originalBookingForEdit ? originalBookingForEdit.isCancelled : false,
      cancelledAt: isEditMode && originalBookingForEdit ? originalBookingForEdit.cancelledAt : undefined
    };

    try {
      let res;
      if (isEditMode && originalBookingForEdit?._id) {
        res = await fetch(`${API_PREFIX}/meeting-rooms/${originalBookingForEdit._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingPayload)
        });
      } else {
        res = await fetch(`${API_PREFIX}/meeting-rooms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingPayload)
        });
      }

      if (res.ok) {
        await fetchBookings();
        setIsCreateModalOpen(false);
        setIsEditMode(false);
        setOriginalBookingForEdit(null);
      } else {
        const errText = await res.text();
        alert("បរាជ័យក្នុងការរក្សាទុក៖ " + errText);
      }
    } catch (err) {
      console.error("Error saving booking:", err);
      alert("មានបញ្ហាក្នុងការតភ្ជាប់ទៅកាន់ម៉ាស៊ីនមេ!");
    }
  };

  const handleOpenEditModal = (booking) => {
    setNewBookingData({
      title: booking.title,
      user: booking.user,
      roomId: booking.roomId || rooms[0]?.id,
      slot: booking.slot || columns[0],
      startTime: booking.startTime,
      endTime: booking.endTime,
      participants: booking.participants || "15 នាក់",
      amenities: booking.amenities || "",
      attachmentUrl: booking.attachmentUrl || "",
      attachmentName: booking.attachmentName || "",
      attachmentSize: booking.attachmentSize || 0,
      note: booking.note || ""
    });
    setIsEditMode(true);
    setOriginalBookingForEdit(booking);
    setIsDetailModalOpen(false);
    setIsCreateModalOpen(true);
  };

  const handleDeleteSelectedBooking = async (bookingToCancel) => {
    if (!bookingToCancel) return;
    if (window.confirm("តើលោកអ្នកពិតជាចង់រំសាយការកក់ប្រជុំនេះមែនទេ?")) {
      try {
        const res = await fetch(`${API_PREFIX}/meeting-rooms/${bookingToCancel._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...bookingToCancel,
            isCancelled: true,
            cancelledAt: new Date().toISOString()
          })
        });

        if (res.ok) {
          await fetchBookings();
          setIsDetailModalOpen(false);
        } else {
          const errText = await res.text();
          alert("បរាជ័យក្នុងការរំសាយ៖ " + errText);
        }
      } catch (err) {
        console.error("Error cancelling booking:", err);
        alert("មានបញ្ហាក្នុងការតភ្ជាប់ទៅកាន់ម៉ាស៊ីនមេ!");
      }
    }
  };

  const columns = ["08:00 - 10:00", "10:00 - 12:00", "12:00 - 14:00", "14:00 - 16:00", "16:00 - 18:00"];
  const rooms = [
    { id: "bayon", name: "បន្ទប់បាយ័ន", capacity: 20, icon: <Building2 />, color: "indigo", amenities: ["Projector", "TV", "Coffee"] },
    { id: "neakpoan", name: "បន្ទប់នាគព័ន្ធ", capacity: 12, icon: <Building2 />, color: "violet", amenities: ["TV", "Sound System"] },
    { id: "banteaysrei", name: "បន្ទប់បន្ទាយស្រី", capacity: 8, icon: <Building2 />, color: "rose", amenities: ["TV", "Whiteboard"] },
    { id: "preahkhan", name: "បន្ទប់ព្រះខ័ណ", capacity: 25, icon: <Building2 />, color: "emerald", amenities: ["Full Tech", "Stage"] },
    { id: "administration", name: "បន្ទប់រដ្ឋបាល", capacity: 10, icon: <Building2 />, color: "amber", amenities: ["Printer", "Scanner"] },
    { id: "waiting", name: "បន្ទប់រង់ចាំ", capacity: 15, icon: <Building2 />, color: "slate", amenities: ["Lounge", "Drinks"] }
  ];

  const [databaseBookings, setDatabaseBookings] = useState({});

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDateKhmer = (date) => {
    const months = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
    const days = ["អាទិត្យ", "ច័ន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
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

    if (now > end) return { type: "ended", label: "បញ្ចប់", style: "bg-slate-200 text-slate-400 border-transparent opacity-60" };
    if (now >= start && now <= end) {
      if (diffToEnd <= 15) return { type: "ongoing", label: "ជិតបញ្ចប់", style: "bg-gradient-to-br from-amber-500 to-orange-600 text-white animate-pulse" };
      return { type: "ongoing", label: "កំពុងប្រជុំ", style: "bg-gradient-to-br from-rose-500 to-pink-600 text-white" };
    }
    if (now < start) {
      if (diffToStart <= 15 && diffToStart > 0) return { type: "pending_start", label: "ជិតចូល", style: "bg-gradient-to-br from-indigo-500 to-blue-600 text-white animate-pulse" };
      return { type: "booked", label: "កក់រួច", style: "bg-gradient-to-br from-blue-500 to-sky-600 text-white" };
    }
    return { type: "booked", label: "កក់រួច", style: "bg-gradient-to-br from-blue-500 to-sky-600 text-white" };
  };

  const getSlotBookings = (roomBookings, slot) => {
    const val = roomBookings?.[slot];
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  };

  const dateStr = getYYYYMMDD(currentDate);
  const currentDayBookings = databaseBookings[dateStr] || {};

  let totalBooked = 0, totalOngoing = 0, totalPendingStart = 0, totalPendingEnd = 0, totalEnded = 0;
  let activeRoomsAtThisMoment = new Set();

  rooms.forEach(room => {
    columns.forEach(slot => {
      const bookingsList = getSlotBookings(currentDayBookings[room.id], slot);
      bookingsList.forEach(bookingInfo => {
        if (bookingInfo.isCancelled) return;
        
        totalBooked++;
        const isToday = getYYYYMMDD(new Date()) === dateStr;
        const status = isToday ? checkActualBookingStatus(bookingInfo) : { type: "booked", label: "កក់រួច" };
        if (status.type === "ongoing") { 
          totalOngoing++; 
          activeRoomsAtThisMoment.add(room.id); 
          if(status.label === "ជិតបញ្ចប់") totalPendingEnd++; 
        }
        if (status.type === "pending_start") totalPendingStart++;
        if (status.type === "ended") totalEnded++;
      });
    });
  });

  const getFullAttachmentUrl = (attachmentUrl) => {
    if (!attachmentUrl) return null;
    if (attachmentUrl.startsWith('http')) return attachmentUrl;
    let origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168.')) {
      origin = 'https://subdistinctively-extrorse-domonique.ngrok-free.dev';
    }
    return `${origin}${attachmentUrl}`;
  };

  const handleShareBookingTelegram = (booking) => {
    const roomObj = rooms.find(r => r.id === booking.roomId) || rooms.find(r => r.name === booking.roomName) || rooms[0];
    const fullAttachmentUrl = getFullAttachmentUrl(booking.attachmentUrl);

    let text = `📚 *ប្រធានបទ:* ${booking.title}
👨‍🏫 *អ្នកដឹកនាំប្រជុំ:* ${booking.user || "លោក នេត ចន្ថា"}
📍 *ទីតាំងប្រជុំ:* ${roomObj ? roomObj.name : "បន្ទប់ប្រជុំ ព្រះខ័ន"}
📅 *កាលបរិច្ឆេទកម្មវិធី:* ${formatDateKhmer(currentDate)}
⏰ *ម៉ោងចាប់ផ្តើម:* ${booking.startTime}
⏳ *ម៉ោងបញ្ចប់:* ${booking.endTime}
🛠️ *ស្នើសុំសម្ភារៈ:* ${booking.amenities || (roomObj?.amenities?.length ? roomObj.amenities.map(a => {
      if (a === "Projector") return "សំភារៈ បទបង្ហាញ";
      if (a === "TV") return "អេក្រង់ទូរទស្សន៍";
      if (a === "Coffee") return "កាហ្វេ និងទឹកសម្រន់";
      if (a === "Sound") return "សំភារៈ សម្លេង";
      return a;
    }).join(", ") : "សំភារៈ បទបង្ហាញ, សំភារៈ សម្លេង")}
👩‍💻 *ស្នើសុំអ្នកបច្គេកទេស:* មិនមាន
👥 *ចំនួនអ្នកចូលរួម:* ${booking.participants || "15 នាក់"}`;

    if (booking.note) {
      text += `\n📝 *ចំណាំ:* ${booking.note}`;
    }
    if (fullAttachmentUrl) {
      text += `\n📎 *ឯកសារភ្ជាប់:* ${booking.attachmentName || "ឯកសារភ្ជាប់"}`;
    }

    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(fullAttachmentUrl || "")}&text=${encodeURIComponent(text)}`;
    window.open(telegramUrl, '_blank');
  };

  const handleCopyBookingInfo = (booking) => {
    const roomObj = rooms.find(r => r.id === booking.roomId) || rooms.find(r => r.name === booking.roomName) || rooms[0];
    const fullAttachmentUrl = getFullAttachmentUrl(booking.attachmentUrl);

    let text = `📚 ប្រធានបទ: ${booking.title}
👨‍🏫 អ្នកដឹកនាំប្រជុំ: ${booking.user || "លោក នេត ចន្ថា"}
📍 ទីតាំងប្រជុំ: ${roomObj ? roomObj.name : "បន្ទប់ប្រជុំ ព្រះខ័ន"}
📅 កាលបរិច្ឆេទកម្មវិធី: ${formatDateKhmer(currentDate)}
⏰ ម៉ោងចាប់ផ្តើម: ${booking.startTime}
⏳ ម៉ោងបញ្ចប់: ${booking.endTime}
🛠️ ស្នើសុំសម្ភារៈ: ${booking.amenities || (roomObj?.amenities?.length ? roomObj.amenities.map(a => {
      if (a === "Projector") return "សំភារៈ បទបង្ហាញ";
      if (a === "TV") return "អេក្រង់ទូរទស្សន៍";
      if (a === "Coffee") return "កាហ្វេ និងទឹកសម្រន់";
      if (a === "Sound") return "សំភារៈ សម្លេង";
      return a;
    }).join(", ") : "សំភារៈ បទបង្ហាញ, សំភារៈ សម្លេង")}
👩‍💻 ស្នើសុំអ្នកបច្ចេកទេស: មិនមាន
👥 ចំនួនអ្នកចូលរួម: ${booking.participants || "15 នាក់"}`;

    if (booking.note) {
      text += `\n📝 ចំណាំ: ${booking.note}`;
    }
    if (fullAttachmentUrl) {
      text += `\n📎 ឯកសារភ្ជាប់: ${booking.attachmentName} (${fullAttachmentUrl})`;
    }

    navigator.clipboard.writeText(text);
    alert("ចម្លងព័ត៌មានលម្អិតរួចរាល់បាទ!");
  };

  const generateReport = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('km-KH', { hour12: false });
    
    let report = `📊 របាយការណ៍សង្ខេបកាលវិភាគបន្ទប់ប្រជុំ\n`;
    report += `📅 កាលបរិច្ឆេទ៖ ${formatDateKhmer(currentDate)}\n`;
    report += `⏱️ ម៉ោងគិត៖ ${timeStr}\n\n`;
    
    report += `១. ការកក់សរុបថ្ងៃនេះ៖ ${totalBooked} កម្មវិធី\n`;
    report += `២. កំពុងប្រជុំជាក់ស្តែង៖ ${totalOngoing} បន្ទប់\n`;
    report += `៣. ជិតចូលប្រជុំ៖ ${totalPendingStart} កម្មវិធី\n`;
    report += `៤. ជិតបញ្ចប់៖ ${totalPendingEnd} កម្មវិធី\n`;
    report += `៥. រំសាយ / ចប់៖ ${totalEnded} កម្មវិធី\n`;
    report += `៦. បន្ទប់ទំនេរពេលនេះ៖ ${rooms.length - activeRoomsAtThisMoment.size} / ${rooms.length} បន្ទប់\n\n`;
    
    report += `📋 បញ្ជីកម្មវិធី៖\n\n`;
    
    let programList = [];
    rooms.forEach(room => {
      columns.forEach(slot => {
        const bookingsList = getSlotBookings(currentDayBookings[room.id], slot);
        bookingsList.forEach(info => {
          const isToday = getYYYYMMDD(new Date()) === dateStr;
          const status = info.isCancelled
            ? { type: "cancelled", label: "រំសាយរួច" }
            : (isToday ? checkActualBookingStatus(info) : { label: "កក់រួច" });
          
          let statusLabel = status.label;
          if (status.type === "ended") statusLabel = "បញ្ចប់";
          if (info.isCancelled) statusLabel = "រំសាយរួច";
          
          programList.push(`🏢 ទីតាំង៖ ${info.roomName} | 📚 ប្រធានបទ៖ ${info.title} | ⏰ ម៉ោង៖ ${info.startTime} - ${info.endTime} (${statusLabel})`);
        });
      });
    });
    
    report += programList.join('\n\n');
    
    setReportText(report || "មិនមានការកក់ទុកសម្រាប់ថ្ងៃនេះទេ។");
    setIsReportModalOpen(true);
  };

  const copyReportText = () => {
    navigator.clipboard.writeText(reportText);
    alert('Copy Success!');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-['Siemreap'] overflow-x-hidden p-0 m-0 relative">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-200/30 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[35%] h-[35%] bg-blue-200/30 blur-[100px] rounded-full"></div>
      </div>

      <style>{`
        .glass-header {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(226, 232, 240, 0.8);
        }
        .vibrant-card {
          background: white;
          border: 1px solid rgba(226, 232, 240, 0.8);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .vibrant-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          border-color: rgba(59, 130, 246, 0.3);
        }
        .timeline-cell {
          transition: all 0.2s ease;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
      `}</style>

      {/* Header - Ultra Compact */}
      <nav className="sticky top-0 z-40 glass-header px-4 py-2 flex flex-col md:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
            <LayoutDashboard className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-800 leading-tight">បណ្ណាល័យបន្ទប់ប្រជុំ <span className="text-indigo-600">PRO</span></h1>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em]">Management System • V2.1</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono font-black text-xs flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {currentTime.toLocaleTimeString('km-KH', { hour12: false })}
          </div>
          <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all text-slate-400 shadow-sm">
            <Bell className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 ml-1">
            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-500 flex items-center justify-center font-bold text-white text-[10px] shadow-sm">
              AD
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 py-4 relative z-10">
        
        {/* Compact Stat Bar */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          {[
            { id: 'all', label: 'សរុប', value: totalBooked, icon: Calendar, color: 'text-indigo-600', bg: 'bg-indigo-50', bar: 'bg-indigo-500' },
            { id: 'ongoing', label: 'កំពុងប្រជុំ', value: totalOngoing, icon: Video, color: 'text-rose-600', bg: 'bg-rose-50', bar: 'bg-rose-500', pulse: true },
            { id: 'pending_start', label: 'ជិតចូល', value: totalPendingStart, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', bar: 'bg-amber-500' },
            { id: 'pending_end', label: 'ជិតបញ្ចប់', value: totalPendingEnd, icon: Hourglass, color: 'text-orange-600', bg: 'bg-orange-50', bar: 'bg-orange-500' },
            { id: 'ended', label: 'បញ្ចប់', value: totalEnded, icon: CheckCircle2, color: 'text-slate-600', bg: 'bg-slate-100', bar: 'bg-slate-500' },
            { id: 'free', label: 'បន្ទប់ទំនេរ', value: `${rooms.length - activeRoomsAtThisMoment.size}`, icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500' }
          ].map((stat) => (
            <div 
              key={stat.id}
              onClick={() => setCurrentFilterMode(stat.id)} 
              className={`vibrant-card relative p-2.5 rounded-xl cursor-pointer ${currentFilterMode === stat.id ? 'ring-2 ring-indigo-500 bg-indigo-50/30' : ''}`}
            >
              <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${stat.bar}`}></div>
              <div className="flex items-center justify-between">
                <div className={`w-7 h-7 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-3.5 h-3.5 ${stat.color} ${stat.pulse ? 'animate-pulse' : ''}`} />
                </div>
                <div className="text-lg font-black text-slate-800 tracking-tight">{stat.value}</div>
              </div>
              <div className="text-[9px] text-slate-400 font-bold uppercase mt-1 ml-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Toolbar - Ultra Compact */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
              <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)))} className="w-7 h-7 flex items-center justify-center hover:bg-slate-50 rounded text-slate-400"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <div className="px-3 py-1 text-[11px] font-black bg-indigo-600 text-white rounded shadow-md min-w-[140px] text-center mx-1">
                {formatDateKhmer(currentDate)}
              </div>
              <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)))} className="w-7 h-7 flex items-center justify-center hover:bg-slate-50 rounded text-slate-400"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
            <input type="date" value={getYYYYMMDD(currentDate)} onChange={(e) => setCurrentDate(new Date(e.target.value))} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600 focus:ring-1 focus:ring-indigo-500 shadow-sm" />
          </div>

          {/* New View Mode Selector */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-inner">
            <button 
              onClick={() => setViewMode("rooms-rows")} 
              className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all duration-200 ${viewMode === "rooms-rows" ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"}`}
            >
              បន្ទប់ជាជួរដេក
            </button>
            <button 
              onClick={() => setViewMode("rooms-cols")} 
              className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all duration-200 ${viewMode === "rooms-cols" ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"}`}
            >
              បន្ទប់ជាជួរឈរ (Header)
            </button>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={handleSyncGoogleSheet}
              disabled={isSyncing}
              className={`px-4 py-2 ${isSyncing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer'} rounded-lg text-[10px] font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95`}
            >
              🟢 {isSyncing ? 'កំពុងទាញទិន្នន័យ...' : 'ទាញទិន្នន័យពី Google Sheet'}
            </button>
            <button onClick={generateReport} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 flex items-center gap-2 shadow-sm transition-all">
              <FileText className="w-3.5 h-3.5 text-indigo-500" /> របាយការណ៍
            </button>
            <button 
              onClick={handleOpenCreateModalDefault}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> កក់ថ្មី
            </button>
          </div>
        </div>

        {/* Timeline Grid - Refined Compact */}
        <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-xl relative">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse">
              {viewMode === "rooms-rows" ? (
                <>
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <th className="p-3 w-[180px] sticky left-0 z-30 bg-slate-50 border-r border-slate-200 text-left">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">បន្ទប់ / Room</span>
                      </th>
                      {columns.map((slot, idx) => (
                        <th key={idx} className="p-2.5 text-center border-r border-slate-100 min-w-[160px]">
                          <span className="block text-[7px] font-black text-slate-300 uppercase mb-0.5">{idx < 2 ? 'Morning' : (idx === 2 ? 'Noon' : 'Afternoon')}</span>
                          <span className="text-[11px] font-black text-indigo-600">{slot}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rooms.map(room => {
                      if (currentFilterMode === 'free' && activeRoomsAtThisMoment.has(room.id)) return null;
                      
                      const roomColorMap = {
                        indigo: { bg: "bg-indigo-50", border: "border-indigo-100", text: "text-indigo-600" },
                        violet: { bg: "bg-violet-50", border: "border-violet-100", text: "text-violet-600" },
                        rose: { bg: "bg-rose-50", border: "border-rose-100", text: "text-rose-600" },
                        emerald: { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-600" },
                        amber: { bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-600" },
                        slate: { bg: "bg-slate-100", border: "border-slate-200", text: "text-slate-600" }
                      };
                      const colors = roomColorMap[room.color] || roomColorMap.indigo;

                      return (
                        <tr key={room.id} className="hover:bg-indigo-50/10 transition-colors">
                          <td className="p-3.5 sticky left-0 z-20 bg-white border-r border-slate-200 shadow-[4px_0_10px_-3px_rgba(0,0,0,0.02)]">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center ${colors.text} shadow-sm transition-all duration-300 hover:scale-105`}>
                                {React.cloneElement(room.icon, { size: 16 })}
                              </div>
                              <div className="space-y-0.5">
                                <div className="font-black text-slate-800 text-xs leading-tight">{room.name}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[7.5px] text-indigo-600 font-bold bg-indigo-50 px-1 py-0.5 rounded leading-none"><Users className="inline w-2.5 h-2.5 mr-0.5" /> {room.capacity}នាក់</span>
                                  <div className={`w-1.5 h-1.5 rounded-full ${activeRoomsAtThisMoment.has(room.id) ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'}`}></div>
                                </div>
                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                  {room.amenities.map(a => (
                                    <span key={a} className="text-[6.5px] bg-slate-50 text-slate-400 border border-slate-100/60 px-1 py-0.2 rounded font-medium">{a}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                          {columns.map((slot, idx) => {
                            const bookingsList = getSlotBookings(currentDayBookings[room.id], slot);
                            
                            if (bookingsList.length > 0) {
                              const activeBooking = bookingsList.find(b => !b.isCancelled);
                              const cancelledBookings = bookingsList.filter(b => b.isCancelled);
                              const isToday = getYYYYMMDD(new Date()) === dateStr;
                              
                              if (activeBooking) {
                                const status = isToday ? checkActualBookingStatus(activeBooking) : { type: "booked", label: "កក់រួច", style: "bg-gradient-to-br from-indigo-500 to-blue-600 text-white" };
                                if (currentFilterMode !== 'all' && currentFilterMode !== 'free' && currentFilterMode !== status.type) {
                                  return <td key={idx} className="p-2 border-r border-slate-50 opacity-10">•</td>;
                                }
                                const isEnded = status.type === 'ended';
                                return (
                                  <td key={idx} className="p-2 border-r border-slate-50">
                                    <div 
                                      onClick={() => { setSelectedBooking({ bookings: bookingsList, roomId: room.id, slot }); setIsDetailModalOpen(true); }}
                                      className={`p-3 rounded-xl ${status.style} cursor-pointer hover:scale-[1.03] hover:shadow-lg transition-all duration-300 min-h-[96px] flex flex-col justify-between shadow-md border border-white/10 relative overflow-hidden`}
                                    >
                                      <div className="absolute top-0 left-0 w-1 h-full bg-white/20"></div>
                                      <div className={`font-black text-[13.5px] line-clamp-2 leading-tight tracking-tight pl-1 ${isEnded ? 'text-slate-500' : 'text-white'}`}>
                                        {activeBooking.title}
                                      </div>
                                      <div className={`flex items-center justify-between pt-2 mt-auto border-t pl-1 ${isEnded ? 'border-slate-300' : 'border-white/10'}`}>
                                        <div className="flex flex-col min-w-0 flex-1">
                                          <span className={`text-[12.5px] font-black truncate ${isEnded ? 'text-slate-500' : 'text-white'}`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>{activeBooking.user}</span>
                                          <span className={`text-[11px] font-black mt-0.5 leading-none tracking-tighter ${isEnded ? 'text-slate-400' : 'text-white/95'}`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{activeBooking.startTime} - {activeBooking.endTime}</span>
                                          {cancelledBookings.length > 0 && (
                                            <span className="text-[5.5px] text-slate-300 font-bold bg-black/10 px-1 py-0.2 rounded mt-0.5 w-fit">⏱️ មានប្រវត្តិកែប្រែ</span>
                                          )}
                                        </div>
                                        <span className={`text-[6.5px] px-1.5 py-0.5 rounded-md uppercase font-black tracking-wider ml-1.5 shrink-0 ${isEnded ? 'bg-slate-300 text-slate-600' : 'bg-white/20 text-white'}`}>{status.label}</span>
                                      </div>
                                    </div>
                                  </td>
                                );
                              } else {
                                // ONLY cancelled bookings in this slot
                                const firstCancelled = cancelledBookings[0];
                                return (
                                  <td key={idx} className="p-2 border-r border-slate-50">
                                    <div 
                                      onClick={() => { setSelectedBooking({ bookings: bookingsList, roomId: room.id, slot }); setIsDetailModalOpen(true); }}
                                      className="p-3 rounded-xl bg-slate-100 hover:bg-slate-150 border border-dashed border-slate-300 text-slate-500 cursor-pointer hover:scale-[1.03] hover:shadow-md transition-all duration-300 min-h-[96px] flex flex-col justify-between shadow-sm relative overflow-hidden"
                                    >
                                      <div className="absolute top-0 left-0 w-1 h-full bg-slate-300"></div>
                                      <div className="font-black text-[13.5px] line-clamp-2 leading-tight tracking-tight pl-1 text-slate-400 line-through">
                                        {firstCancelled.title}
                                      </div>
                                      <div className="flex items-center justify-between pt-2 mt-auto border-t border-slate-200 pl-1">
                                        <div className="flex flex-col min-w-0 flex-1">
                                          <span className="text-[12.5px] font-black truncate text-slate-500">{firstCancelled.user}</span>
                                          <span className="text-[11px] font-black mt-0.5 leading-none tracking-tighter text-slate-400">{firstCancelled.startTime} - {firstCancelled.endTime}</span>
                                        </div>
                                        <span className="text-[6.5px] px-1.5 py-0.5 rounded-md uppercase font-black tracking-wider bg-slate-205 text-slate-600 shrink-0 ml-1.5">រំសាយរួច</span>
                                      </div>
                                    </div>
                                  </td>
                                );
                              }
                            }
                            
                            return (
                              <td key={idx} className="p-2 border-r border-slate-50">
                                <button 
                                  onClick={() => handleOpenCreateModal(room.id, slot)}
                                  className="w-full h-[78px] border border-dashed border-slate-200/80 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400/80 hover:bg-indigo-50/30 hover:text-indigo-600 transition-all duration-300 group shadow-sm bg-slate-50/40 relative overflow-hidden"
                                >
                                  <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                  <Plus className="w-4 h-4 mb-1 text-slate-300 group-hover:text-indigo-500 group-hover:scale-110 transition-all duration-300" />
                                  <span className="text-[7px] font-black uppercase tracking-wider group-hover:tracking-widest transition-all duration-300">Available</span>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </>
              ) : (
                <>
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <th className="p-3 w-[150px] sticky left-0 z-30 bg-slate-50 border-r border-slate-200 text-left">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ម៉ោង / Time</span>
                      </th>
                      {rooms.map(room => {
                        if (currentFilterMode === 'free' && activeRoomsAtThisMoment.has(room.id)) return null;
                        
                        const roomColorMap = {
                          indigo: { bg: "bg-indigo-50", border: "border-indigo-100", text: "text-indigo-600" },
                          violet: { bg: "bg-violet-50", border: "border-violet-100", text: "text-violet-600" },
                          rose: { bg: "bg-rose-50", border: "border-rose-100", text: "text-rose-600" },
                          emerald: { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-600" },
                          amber: { bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-600" },
                          slate: { bg: "bg-slate-100", border: "border-slate-200", text: "text-slate-600" }
                        };
                        const colors = roomColorMap[room.color] || roomColorMap.indigo;

                        return (
                          <th key={room.id} className="p-3 text-center border-r border-slate-100 min-w-[180px] bg-slate-50">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <div className={`w-9 h-9 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center ${colors.text} shadow-sm transition-all duration-300 hover:scale-105`}>
                                {React.cloneElement(room.icon, { size: 14 })}
                              </div>
                              <div className="font-black text-slate-800 text-xs leading-tight mt-1">{room.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[7.5px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded leading-none"><Users className="inline w-2.5 h-2.5 mr-0.5" /> {room.capacity}នាក់</span>
                                <div className={`w-1.5 h-1.5 rounded-full ${activeRoomsAtThisMoment.has(room.id) ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'}`}></div>
                              </div>
                              <div className="flex gap-1 mt-1 justify-center flex-wrap">
                                {room.amenities.map(a => (
                                  <span key={a} className="text-[6.5px] bg-white text-slate-400 border border-slate-200/60 px-1 py-0.2 rounded font-medium">{a}</span>
                                ))}
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {columns.map((slot, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/10 transition-colors">
                        <td className="p-3.5 sticky left-0 z-20 bg-white border-r border-slate-200 text-center shadow-[4px_0_10px_-3px_rgba(0,0,0,0.02)]">
                          <span className="block text-[7px] font-black text-slate-300 uppercase mb-0.5">{idx < 2 ? 'Morning' : (idx === 2 ? 'Noon' : 'Afternoon')}</span>
                          <span className="text-[11px] font-black text-indigo-600 leading-none">{slot}</span>
                        </td>
                        {rooms.map(room => {
                          if (currentFilterMode === 'free' && activeRoomsAtThisMoment.has(room.id)) return null;

                          const bookingsList = getSlotBookings(currentDayBookings[room.id], slot);
                          
                          if (bookingsList.length > 0) {
                            const activeBooking = bookingsList.find(b => !b.isCancelled);
                            const cancelledBookings = bookingsList.filter(b => b.isCancelled);
                            const isToday = getYYYYMMDD(new Date()) === dateStr;
                            
                            if (activeBooking) {
                              const status = isToday ? checkActualBookingStatus(activeBooking) : { type: "booked", label: "កក់រួច", style: "bg-gradient-to-br from-indigo-500 to-blue-600 text-white" };
                              if (currentFilterMode !== 'all' && currentFilterMode !== 'free' && currentFilterMode !== status.type) {
                                return <td key={room.id} className="p-2 border-r border-slate-50 opacity-10">•</td>;
                              }
                              const isEnded = status.type === 'ended';
                              return (
                                <td key={room.id} className="p-2 border-r border-slate-50">
                                  <div 
                                    onClick={() => { setSelectedBooking({ bookings: bookingsList, roomId: room.id, slot }); setIsDetailModalOpen(true); }}
                                    className={`p-3 rounded-xl ${status.style} cursor-pointer hover:scale-[1.03] hover:shadow-lg transition-all duration-300 min-h-[96px] flex flex-col justify-between shadow-md border border-white/10 relative overflow-hidden`}
                                  >
                                    <div className="absolute top-0 left-0 w-1 h-full bg-white/20"></div>
                                    <div className={`font-black text-[13.5px] line-clamp-2 leading-tight tracking-tight pl-1 ${isEnded ? 'text-slate-500' : 'text-white'}`}>
                                      {activeBooking.title}
                                    </div>
                                    <div className={`flex items-center justify-between pt-2 mt-auto border-t pl-1 ${isEnded ? 'border-slate-300' : 'border-white/10'}`}>
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className={`text-[12.5px] font-black truncate ${isEnded ? 'text-slate-500' : 'text-white'}`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>{activeBooking.user}</span>
                                        <span className={`text-[11px] font-black mt-0.5 leading-none tracking-tighter ${isEnded ? 'text-slate-400' : 'text-white/95'}`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{activeBooking.startTime} - {activeBooking.endTime}</span>
                                        {cancelledBookings.length > 0 && (
                                          <span className="text-[5.5px] text-slate-300 font-bold bg-black/10 px-1 py-0.2 rounded mt-0.5 w-fit">⏱️ មានប្រវត្តិកែប្រែ</span>
                                        )}
                                      </div>
                                      <span className={`text-[6.5px] px-1.5 py-0.5 rounded-md uppercase font-black tracking-wider ml-1.5 shrink-0 ${isEnded ? 'bg-slate-300 text-slate-600' : 'bg-white/20 text-white'}`}>{status.label}</span>
                                    </div>
                                  </div>
                                </td>
                              );
                            } else {
                              // ONLY cancelled bookings in this slot
                              const firstCancelled = cancelledBookings[0];
                              return (
                                <td key={room.id} className="p-2 border-r border-slate-50">
                                  <div 
                                    onClick={() => { setSelectedBooking({ bookings: bookingsList, roomId: room.id, slot }); setIsDetailModalOpen(true); }}
                                    className="p-3 rounded-xl bg-slate-100 hover:bg-slate-150 border border-dashed border-slate-300 text-slate-500 cursor-pointer hover:scale-[1.03] hover:shadow-md transition-all duration-300 min-h-[96px] flex flex-col justify-between shadow-sm relative overflow-hidden"
                                  >
                                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-300"></div>
                                    <div className="font-black text-[13.5px] line-clamp-2 leading-tight tracking-tight pl-1 text-slate-400 line-through">
                                      {firstCancelled.title}
                                    </div>
                                    <div className="flex items-center justify-between pt-2 mt-auto border-t border-slate-200 pl-1">
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-[12.5px] font-black truncate text-slate-500">{firstCancelled.user}</span>
                                        <span className="text-[11px] font-black mt-0.5 leading-none tracking-tighter text-slate-400">{firstCancelled.startTime} - {firstCancelled.endTime}</span>
                                      </div>
                                      <span className="text-[6.5px] px-1.5 py-0.5 rounded-md uppercase font-black tracking-wider bg-slate-205 text-slate-600 shrink-0 ml-1.5">រំសាយរួច</span>
                                    </div>
                                  </div>
                                </td>
                              );
                            }
                          }

                          return (
                            <td key={room.id} className="p-2 border-r border-slate-50">
                              <button 
                                onClick={() => handleOpenCreateModal(room.id, slot)}
                                className="w-full h-[78px] border border-dashed border-slate-200/80 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400/80 hover:bg-indigo-50/30 hover:text-indigo-600 transition-all duration-300 group shadow-sm bg-slate-50/40 relative overflow-hidden"
                              >
                                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <Plus className="w-4 h-4 mb-1 text-slate-300 group-hover:text-indigo-500 group-hover:scale-110 transition-all duration-300" />
                                <span className="text-[7px] font-black uppercase tracking-wider group-hover:tracking-widest transition-all duration-300">Available</span>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
        </div>

        <footer className="mt-6 flex justify-between items-center px-1">
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest opacity-60">© 2026 KSFH Hospital • Advanced Meeting Management</p>
          <div className="flex gap-3">
            <span className="flex items-center gap-1 text-[8px] text-slate-400 font-bold"><div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div> SYSTEM ONLINE</span>
            <span className="flex items-center gap-1 text-[8px] text-slate-400 font-bold tracking-tighter">V2.1 PREM</span>
          </div>
        </footer>
      </main>

      {/* Detail Modal - Compact & Elegant */}
      {isDetailModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-white animate-in zoom-in-95 duration-200">
            <div className="bg-indigo-600 p-4 flex justify-between items-center">
              <h3 className="text-sm font-black text-white tracking-tight">ព័ត៌មានលម្អិតការកក់</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="w-7 h-7 rounded-lg bg-white/10 text-white hover:bg-white/20 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar bg-slate-50/40">
              <div className="space-y-4">
                {selectedBooking.bookings.map((booking, index) => {
                  const roomObj = rooms.find(r => r.id === selectedBooking.roomId) || rooms[0];
                  const isCancelled = booking.isCancelled;
                  
                  return (
                    <div 
                      key={index} 
                      className={`space-y-3.5 text-xs p-4.5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
                        isCancelled 
                          ? "bg-slate-100/80 border-slate-200/80 text-slate-500 shadow-inner" 
                          : "bg-white border-slate-100 shadow-sm"
                      }`}
                    >
                      {/* Cancellation Banner */}
                      {isCancelled && (
                        <div className="absolute top-0 right-0 bg-slate-200 text-[6.5px] text-slate-500 font-black px-2.5 py-0.5 rounded-bl-lg uppercase tracking-wider">
                          រំសាយរួច / Cancelled
                        </div>
                      )}

                      {/* Header with badge and copy/share buttons */}
                      <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                          isCancelled ? "bg-slate-200 text-slate-600" : "bg-indigo-50 text-indigo-700"
                        }`}>
                          កាលវិភាគទី {index + 1} {isCancelled ? "(រំសាយ)" : "(សកម្ម)"}
                        </span>
                        
                        <div className="flex gap-1.5">
                          <button 
                            type="button"
                            onClick={() => handleCopyBookingInfo(booking)} 
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors border border-slate-200/40"
                            title="ចម្លងព័ត៌មាន"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleShareBookingTelegram(booking)} 
                            className="w-6 h-6 rounded bg-sky-50 hover:bg-sky-100 text-[#0088cc] flex items-center justify-center transition-colors border border-sky-150"
                            title="ចែករំលែក"
                          >
                            <TelegramIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 📚 ប្រធានបទ */}
                      <div className="flex items-start gap-2.5">
                        <span className="text-sm select-none">📚</span>
                        <div className="space-y-0.5">
                          <span className={`text-[10px] font-black uppercase tracking-wider block ${isCancelled ? 'text-slate-400' : 'text-indigo-600'}`}>ប្រធានបទ / Subject</span>
                          <span className={`font-black text-[12px] leading-tight block ${isCancelled ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{booking.title}</span>
                        </div>
                      </div>

                      {/* 👨‍🏫 អ្នកសម្របសម្រួល */}
                      <div className="flex items-start gap-2.5">
                        <span className="text-sm select-none">👨‍🏫</span>
                        <div className="space-y-0.5">
                          <span className={`text-[10px] font-black uppercase tracking-wider block ${isCancelled ? 'text-slate-400' : 'text-indigo-600'}`}>អ្នកដឹកនាំប្រជុំ / Moderator</span>
                          <span className={`font-black text-[11.5px] block ${isCancelled ? 'text-slate-550' : 'text-slate-800'}`}>{booking.user}</span>
                        </div>
                      </div>

                      {/* 📍 ទីតាំងប្រជុំ */}
                      <div className="flex items-start gap-2.5">
                        <span className="text-sm select-none">📍</span>
                        <div className="space-y-0.5">
                          <span className={`text-[10px] font-black uppercase tracking-wider block ${isCancelled ? 'text-slate-400' : 'text-indigo-600'}`}>ទីតាំងប្រជុំ / Location</span>
                          <span className={`font-black text-[11.5px] block ${isCancelled ? 'text-slate-550' : 'text-slate-800'}`}>{booking.roomName || roomObj.name}</span>
                        </div>
                      </div>

                      {/* 📅 កាលបរិច្ឆេទកម្មវិធី */}
                      <div className="flex items-start gap-2.5">
                        <span className="text-sm select-none">📅</span>
                        <div className="space-y-0.5">
                          <span className={`text-[10px] font-black uppercase tracking-wider block ${isCancelled ? 'text-slate-400' : 'text-indigo-600'}`}>កាលបរិច្ឆេទកម្មវិធី / Date</span>
                          <span className={`font-black text-[11.5px] block ${isCancelled ? 'text-slate-550' : 'text-slate-800'}`}>{booking.dateText || formatDateKhmer(currentDate)}</span>
                        </div>
                      </div>

                      {/* Time Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* ⏰ ម៉ោងចាប់ផ្តើម */}
                        <div className="flex items-start gap-2.5">
                          <span className="text-sm select-none">⏰</span>
                          <div className="space-y-0.5">
                            <span className={`text-[10px] font-black uppercase tracking-wider block ${isCancelled ? 'text-slate-400' : 'text-indigo-600'}`}>ម៉ោងចាប់ផ្តើម / Start</span>
                            <span className={`font-black text-[11.5px] block ${isCancelled ? 'text-slate-550' : 'text-slate-800'}`}>{booking.startTime}</span>
                          </div>
                        </div>
                        {/* ⏳ ម៉ោងបញ្ចប់ */}
                        <div className="flex items-start gap-2.5">
                          <span className="text-sm select-none">⏳</span>
                          <div className="space-y-0.5">
                            <span className={`text-[10px] font-black uppercase tracking-wider block ${isCancelled ? 'text-slate-400' : 'text-indigo-600'}`}>ម៉ោងបញ្ចប់ / End</span>
                            <span className={`font-black text-[11.5px] block ${isCancelled ? 'text-slate-550' : 'text-slate-800'}`}>{booking.endTime}</span>
                          </div>
                        </div>
                      </div>

                      {/* 🛠️ ស្នើសុំសម្ភារៈ */}
                      <div className="flex items-start gap-2.5">
                        <span className="text-sm select-none">🛠️</span>
                        <div className="space-y-0.5">
                          <span className={`text-[10px] font-black uppercase tracking-wider block ${isCancelled ? 'text-slate-400' : 'text-indigo-600'}`}>ស្នើសុំសម្ភារៈ / Equipment</span>
                          <span className={`font-black text-[11.5px] block ${isCancelled ? 'text-slate-550' : 'text-slate-800'}`}>
                            {booking.amenities || (roomObj?.amenities?.length ? roomObj.amenities.map(a => {
                              if (a === "Projector") return "សំភារៈ បទបង្ហាញ";
                              if (a === "TV") return "អេក្រង់ទូរទស្សន៍";
                              if (a === "Coffee") return "កាហ្វេ និងទឹកសម្រន់";
                              if (a === "Sound") return "សំភារៈ សម្លេង";
                              return a;
                            }).join(", ") : "សំភារៈ បទបង្ហាញ, សំភារៈ សម្លេង")}
                          </span>
                        </div>
                      </div>

                      {/* 👥 ចំនួនអ្នកចូលរួម */}
                      <div className="flex items-start gap-2.5">
                        <span className="text-sm select-none">👥</span>
                        <div className="space-y-0.5">
                          <span className={`text-[10px] font-black uppercase tracking-wider block ${isCancelled ? 'text-slate-400' : 'text-indigo-600'}`}>ចំនួនអ្នកចូលរួម / Participants</span>
                          <span className={`font-black text-[11.5px] block ${isCancelled ? 'text-slate-550' : 'text-slate-800'}`}>{booking.participants || "15នាក់"}</span>
                        </div>
                      </div>

                      {/* 📝 ចំណាំ */}
                      {booking.note && (
                        <div className="flex items-start gap-2.5">
                          <span className="text-sm select-none">📝</span>
                          <div className="space-y-0.5">
                            <span className={`text-[10px] font-black tracking-wider block ${isCancelled ? 'text-slate-400' : 'text-indigo-600'}`}>ចំណាំ / Note</span>
                            <span className={`font-black text-[11.5px] block italic ${isCancelled ? 'text-slate-500' : 'text-slate-800'}`}>"{booking.note}"</span>
                          </div>
                        </div>
                      )}

                      {/* 📎 ឯកសារភ្ជាប់ */}
                      {booking.attachmentUrl && (
                        <div className="flex items-start gap-2.5">
                          <span className="text-sm select-none">📎</span>
                          <div className="space-y-1 w-full">
                            <span className={`text-[10px] font-black uppercase tracking-wider block ${isCancelled ? 'text-slate-400' : 'text-indigo-600'}`}>ឯកសារភ្ជាប់ / Attachment</span>
                            <a 
                              href={`${API_BASE_RAW}${booking.attachmentUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between bg-slate-50 hover:bg-rose-50/20 p-2 rounded-lg border border-slate-100/80 shadow-sm cursor-pointer transition-all group w-full"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-rose-50 flex items-center justify-center text-rose-600 group-hover:bg-rose-100 transition-colors">
                                  <FileText className="w-3.5 h-3.5" />
                                </div>
                                <div className="text-left">
                                  <div className="text-[9.5px] font-black text-slate-800 leading-tight truncate max-w-[150px]">{booking.attachmentName}</div>
                                  <div className="text-[7.5px] text-slate-400 font-medium">{formatFileSize(booking.attachmentSize)}</div>
                                </div>
                              </div>
                              <span className="text-[8.5px] font-black text-rose-600 hover:underline px-2">មើល / ទាញយក</span>
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Card Action Buttons (Edit/Cancel specific to this booking) */}
                      <div className="flex gap-2 pt-3 border-t border-slate-100 mt-3">
                        {!isCancelled ? (
                          <>
                            <button 
                              type="button"
                              onClick={() => handleOpenEditModal({ ...booking, roomId: selectedBooking.roomId, slot: selectedBooking.slot })}
                              className="flex-1 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-black rounded-lg text-[9.5px] flex items-center justify-center gap-1 transition-colors border border-amber-200"
                            >
                              <PenLine className="w-3.5 h-3.5" /> កែប្រែការកក់
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDeleteSelectedBooking(booking)}
                              className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-black rounded-lg text-[9.5px] flex items-center justify-center gap-1 transition-colors border border-rose-200"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> រំសាយការកក់
                            </button>
                          </>
                        ) : (
                          <div className="w-full text-center text-[9px] text-slate-400 font-bold bg-slate-100 py-1.5 rounded-lg border border-slate-200/40">
                            ⏱️ រំសាយរួច៖ {booking.cancelledAt ? new Date(booking.cancelledAt).toLocaleTimeString() : "មិនបានបញ្ជាក់"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Modal Footer with Glowing "➕ កក់ជំនួសថ្មី" button */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
              {!selectedBooking.bookings.some(b => !b.isCancelled) && (
                <button 
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenCreateModal(selectedBooking.roomId, selectedBooking.slot);
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black rounded-lg text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 animate-pulse"
                >
                  <Plus className="w-3.5 h-3.5" /> កក់ជំនួសថ្មី / Book New
                </button>
              )}
              <button 
                type="button" 
                onClick={() => setIsDetailModalOpen(false)} 
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-400 font-black rounded-lg text-[11px] hover:bg-slate-50 transition-colors"
              >
                បិទ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-white">
            <div className="p-4 flex justify-between items-center border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" /> របាយការណ៍
              </h3>
              <button onClick={() => setIsReportModalOpen(false)} className="text-slate-300 hover:text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              <textarea 
                value={reportText} 
                readOnly 
                rows="8" 
                className="w-full bg-slate-50 rounded-xl border border-slate-100 p-4 text-slate-600 text-[10px] font-mono focus:ring-0 resize-none custom-scrollbar" 
              />
            </div>
            <div className="p-4 bg-slate-50 flex justify-end gap-2 border-t border-slate-100">
              <button onClick={copyReportText} className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg text-[10px] flex items-center gap-1.5 shadow-md">
                <Copy className="w-3.5 h-3.5 text-indigo-400" /> Copy
              </button>
              <button onClick={() => setIsReportModalOpen(false)} className="px-5 py-2 bg-white border border-slate-200 text-slate-400 font-black rounded-lg text-[10px]">បិទ</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Booking Modal - Premium & High Quality */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSaveBooking} className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-4 flex justify-between items-center shadow-md">
              <h3 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
                <Plus className="w-4 h-4 animate-pulse" /> {isEditMode ? "កែប្រែកាលវិភាគប្រជុំ" : "កក់បន្ទប់ប្រជុំថ្មី"}
              </h3>
              <button type="button" onClick={() => { setIsCreateModalOpen(false); setIsEditMode(false); setOriginalBookingForEdit(null); }} className="w-7 h-7 rounded-lg bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-[11px] font-black text-indigo-700 mb-1 flex items-center gap-1">
                  ប្រធានបទប្រជុំ <span className="text-[8px] text-slate-400 font-normal uppercase tracking-wider">/ Subject</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="បញ្ចូលប្រធានបទប្រជុំ..."
                  value={newBookingData.title}
                  onChange={(e) => setNewBookingData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-violet-700 mb-1 flex items-center gap-1">
                  អ្នកដឹកនាំប្រជុំ <span className="text-[8px] text-slate-400 font-normal uppercase tracking-wider">/ Moderator</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="បញ្ចូលឈ្មោះអ្នកដឹកនាំ..."
                  value={newBookingData.user}
                  onChange={(e) => setNewBookingData(prev => ({ ...prev, user: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-emerald-700 mb-1 flex items-center gap-1">
                    ជ្រើសរើសបន្ទប់ <span className="text-[8px] text-slate-400 font-normal uppercase tracking-wider">/ Room</span>
                  </label>
                  <select 
                    value={newBookingData.roomId}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, roomId: e.target.value }))}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-amber-700 mb-1 flex items-center gap-1">
                    ល្វែងម៉ោង <span className="text-[8px] text-slate-400 font-normal uppercase tracking-wider">/ Time Slot</span>
                  </label>
                  <select 
                    value={newBookingData.slot}
                    onChange={(e) => {
                      const slot = e.target.value;
                      const [start, end] = slot.split(" - ");
                      const formatAMPM = (timeStr) => {
                        const [h, m] = timeStr.split(":").map(Number);
                        const suffix = h >= 12 ? "PM" : "AM";
                        const displayH = h % 12 || 12;
                        const displayHStr = String(displayH).padStart(2, '0');
                        return `${displayHStr}:${String(m).padStart(2, '0')} ${suffix}`;
                      };
                      setNewBookingData(prev => ({
                        ...prev,
                        slot: slot,
                        startTime: formatAMPM(start),
                        endTime: formatAMPM(end)
                      }));
                    }}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {columns.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-blue-700 mb-1 flex items-center gap-1">
                    ម៉ោងចាប់ផ្តើម <span className="text-[8px] text-slate-400 font-normal uppercase tracking-wider">/ Start</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={newBookingData.startTime}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-rose-700 mb-1 flex items-center gap-1">
                    ម៉ោងបញ្ចប់ <span className="text-[8px] text-slate-400 font-normal uppercase tracking-wider">/ End</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={newBookingData.endTime}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-cyan-700 mb-1 flex items-center gap-1">
                    ចំនួនចូលរួម <span className="text-[8px] text-slate-400 font-normal uppercase tracking-wider">/ Participants</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={newBookingData.participants}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, participants: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-teal-700 mb-1 flex items-center gap-1">
                    គ្រឿងបរិក្ខារ <span className="text-[8px] text-slate-400 font-normal uppercase tracking-wider">/ Amenities</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="បញ្ចូលគ្រឿងបរិក្ខារ..."
                    value={newBookingData.amenities || ""}
                    onChange={(e) => setNewBookingData(prev => ({ ...prev, amenities: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-rose-700 mb-1 flex items-center gap-1">
                  ឯកសារភ្ជាប់ <span className="text-[8px] text-slate-400 font-normal uppercase tracking-wider">/ Attachment</span>
                </label>
                {uploading ? (
                  <div className="border border-dashed border-rose-300 rounded-xl p-4 bg-rose-50/10 flex flex-col items-center justify-center text-center animate-pulse">
                    <Clock className="w-5 h-5 text-rose-500 animate-spin mb-1" />
                    <span className="text-[9.5px] font-black text-rose-600">កំពុងបង្ហោះឯកសារ...</span>
                    <span className="text-[7.5px] text-slate-400">សូមរង់ចាំមួយភ្លែត</span>
                  </div>
                ) : newBookingData.attachmentUrl ? (
                  <div className="flex items-center justify-between bg-emerald-50/30 p-2.5 rounded-xl border border-emerald-100 shadow-sm transition-all">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="text-[9.5px] font-black text-slate-800 leading-tight truncate max-w-[180px]">{newBookingData.attachmentName}</div>
                        <div className="text-[7.5px] text-slate-400 font-medium">{formatFileSize(newBookingData.attachmentSize)}</div>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 font-black rounded-lg text-[8.5px] transition-colors border border-rose-100"
                    >
                      លុបចេញ
                    </button>
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-rose-50/10 hover:border-rose-300 transition-all group relative overflow-hidden">
                    <FileText className="w-5 h-5 text-slate-300 group-hover:text-rose-500 transition-colors mb-1" />
                    <span className="text-[9.5px] font-black text-slate-600 group-hover:text-rose-600 transition-colors">ជ្រើសរើសឯកសារ ឬអូសចូលទីនេះ</span>
                    <span className="text-[7.5px] text-slate-400">PDF, Word, Excel, Slides (អតិបរមា 20MB)</span>
                    <input 
                      type="file" 
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-black text-indigo-700 mb-1 flex items-center gap-1">
                  កំណត់សម្គាល់ (បើមាន) <span className="text-[8px] text-slate-400 font-normal uppercase tracking-wider">/ Note</span>
                </label>
                <textarea 
                  rows="2"
                  placeholder="ឧ. ត្រូវការតែ និងនំសម្រន់..."
                  value={newBookingData.note}
                  onChange={(e) => setNewBookingData(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button type="submit" className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black rounded-lg text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95">
                <CheckCircle2 className="w-3.5 h-3.5" /> {isEditMode ? "រក្សាទុកការកែប្រែ" : "រក្សាទុកការកក់"}
              </button>
              <button type="button" onClick={() => { setIsCreateModalOpen(false); setIsEditMode(false); setOriginalBookingForEdit(null); }} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-400 font-black rounded-lg text-[11px] hover:bg-slate-50 transition-all">បដិសេធ</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
