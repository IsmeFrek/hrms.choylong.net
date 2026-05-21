import React, { useEffect, useState } from 'react';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import { Settings, Save, Layout, Type, FastForward, CheckCircle2 } from 'lucide-react';

export default function SystemSettingsPage() {
  const perms = usePermission();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState({
    footer_text: 'សូមស្វាគមន៍មកកាន់ប្រព័ន្ធគ្រប់គ្រងបុគ្គលិក (HRMS) នៃមន្ទីរពេទ្យបង្អែកខេត្តកោះកុង | រក្សាសិទ្ធិគ្រប់យ៉ាងដោយមន្ទីរពេទ្យបង្អែកខេត្តកោះកុង (២០២៦)',
    footer_speed: 25,
    show_footer_logo: true,
    footer_logo_url: '/hospital_logo.png'
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/report-settings/group/ui-settings');
        if (res.data && res.data.settings) {
          setSettings(prev => ({
            ...prev,
            ...res.data.settings,
            show_footer_logo: res.data.settings.show_footer_logo !== undefined ? res.data.settings.show_footer_logo : true,
            footer_logo_url: res.data.settings.footer_logo_url || '/hospital_logo.png'
          }));
        }
      } catch (err) {
        console.error('Fetch settings failed:', err);
      }
    };
    if (perms.isAdmin) fetchSettings();
  }, [perms.isAdmin]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.url) {
        setSettings({ ...settings, footer_logo_url: res.data.url });
      }
    } catch (err) {
      console.error('Logo upload failed:', err);
      alert('ការបង្ហោះរូបភាពមិនបានសម្រេច!');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      await api.post('/report-settings/group/ui-settings', { settings });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Save settings failed:', err);
      const msg = err.response?.data?.message || 'ការរក្សាទុកបានបរាជ័យ!';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!perms.isAdmin) {
    return <div className="p-8 text-center text-gray-500">អ្នកមិនមានសិទ្ធិចូលមើលទំព័រនេះទេ។</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">កំណត់ប្រព័ន្ធ (System Settings)</h1>
          <p className="text-sm text-gray-500">រៀបចំការបង្ហាញ និងមុខងារទូទៅរបស់ប្រព័ន្ធ</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
          <Layout className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-gray-800">ការកំណត់ Footer (អក្សររត់)</h2>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Logo Selection & Toggle */}
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-lg border border-blue-200 flex items-center justify-center p-1 overflow-hidden">
                  <img src={settings.footer_logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
                <div>
                  <div className="font-bold text-gray-800 text-sm">រូបភាព Logo ក្នុងអក្សររត់</div>
                  <div className="text-[11px] text-gray-500">ជ្រើសរើសរូបភាពដើម្បីបង្ហាញនៅខាងមុខអត្ថបទ</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <input 
                  type="file" 
                  id="logo-upload" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleLogoUpload}
                />
                <button 
                  onClick={() => document.getElementById('logo-upload').click()}
                  className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-blue-600 text-xs font-bold hover:bg-blue-50 transition-colors"
                >
                  ប្តូររូបភាព
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={settings.show_footer_logo}
                    onChange={(e) => setSettings({ ...settings, show_footer_logo: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Footer Text */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <Type className="w-4 h-4 text-gray-400" />
              ខ្លឹមសារអត្ថបទរត់ (Footer Text)
            </label>
            <textarea 
              value={settings.footer_text}
              onChange={(e) => setSettings({ ...settings, footer_text: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 text-sm leading-relaxed"
              placeholder="បញ្ចូលអត្ថបទដែលលោកអ្នកចង់ឱ្យរត់នៅផ្នែកខាងក្រោម..."
            />
            <p className="text-[11px] text-gray-400">អត្ថបទនេះនឹងបង្ហាញនៅផ្នែកខាងក្រោមបំផុតនៃគ្រប់ទំព័រទាំងអស់។</p>
          </div>

          {/* Footer Speed */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <FastForward className="w-4 h-4 text-gray-400" />
              ល្បឿននៃការរត់ (វិនាទី)
            </label>
            <div className="flex items-center gap-4">
              <input 
                type="range" 
                min="5" 
                max="60" 
                step="5"
                value={65 - settings.footer_speed}
                onChange={(e) => setSettings({ ...settings, footer_speed: 65 - Number(e.target.value) })}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="w-20 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-center font-bold text-blue-700 text-sm">
                {settings.footer_speed}s
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 px-1">
              <span>យឺត (60s)</span>
              <span>លឿន (5s)</span>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-gray-900 rounded-xl space-y-2">
            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">មើលជាមុន (Preview)</div>
            <div className="h-8 bg-blue-600 flex items-center overflow-hidden rounded border border-blue-500">
              <div 
                className="flex animate-marquee"
                style={{ animationDuration: `${settings.footer_speed}s` }}
              >
                <div className="flex-shrink-0 min-w-[100%] flex items-center justify-around pr-[20%]">
                  <div className="flex items-center gap-3">
                    {settings.show_footer_logo && <img src={settings.footer_logo_url} alt="" className="w-5 h-5 object-contain" />}
                    <span className="text-[12px] text-white whitespace-nowrap">{settings.footer_text}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 min-w-[100%] flex items-center justify-around pr-[20%]">
                  <div className="flex items-center gap-3">
                    {settings.show_footer_logo && <img src={settings.footer_logo_url} alt="" className="w-5 h-5 object-contain" />}
                    <span className="text-[12px] text-white whitespace-nowrap">{settings.footer_text}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          {success && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-bold animate-in fade-in slide-in-from-right-2">
              <CheckCircle2 className="w-4 h-4" />
              រក្សាទុកដោយជោគជ័យ!
            </div>
          )}
          <button 
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition-all active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកការកំណត់'}
          </button>
        </div>
      </div>
    </div>
  );
}
