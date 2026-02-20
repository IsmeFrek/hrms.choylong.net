import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePermission from '../hooks/usePermission';

export default function DocumentViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const perms = usePermission();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const contentRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/letters/' + encodeURIComponent(id), { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        if (!res.ok) {
          const local = JSON.parse(localStorage.getItem('localLetters') || '[]');
          const found = local.find((x) => x._localId === id || x._id === id);
          setDoc(found || null);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setDoc(data);
      } catch (e) {
        console.error('load document failed', e);
        const local = JSON.parse(localStorage.getItem('localLetters') || '[]');
        const found = local.find((x) => x._localId === id || x._id === id);
        setDoc(found || null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, token]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!perms.canViewDocuments && !perms.canViewFiles) return (
    <div className="p-6">
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Permission required</h2>
        <p className="text-gray-600 mt-2">You don't have access to view this document.</p>
      </div>
    </div>
  );
  if (!doc) return <div className="p-6">Document not found</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">View Document</h2>
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-gray-600 text-white rounded" onClick={() => window.print()}>Print</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => navigate(-1)}>Back</button>
        </div>
      </div>
      <div ref={contentRef} className="bg-white p-6 shadow" style={{ maxWidth: 800, margin: '0 auto' }}>
        <h3 className="text-lg font-semibold">{doc.subject || '---'}</h3>
        <div className="text-sm text-gray-600 mb-4">លេខ: {doc.letterNo || '---'}</div>
        <div className="whitespace-pre-line">{doc.body}</div>
      </div>
    </div>
  );
}
