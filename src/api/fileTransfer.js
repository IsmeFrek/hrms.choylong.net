import axios from 'axios';
import { API_BASE } from '../config';
import api from '../services/api';

const LEGACY_BASE = `${API_BASE.replace(/\/+$/, '')}/kshf_hospital_app/file-transfers`;

// Fetch file transfer records (server-side paging)
// type: filter type string (optional)
// page: 1-based page number
// pageSize: number of items per page
export async function fetchFileTransfers(type, page = 1, pageSize = 10) {
  const params = { page, pageSize };
  if (type && type !== 'ទាំងអស់') params.type = type;
  const res = await api.get(LEGACY_BASE, { params });
  return res.data; // { items, total }
}

export async function createFileTransfer(payload) {
  const res = await api.post(LEGACY_BASE, payload);
  return res.data; // { item, total }
}


export async function getFileTransfer(id) {
  const res = await api.get(`${LEGACY_BASE}/${id}`);
  return res.data;
}

export async function updateFileTransfer(id, payload) {
  // Protect against attempting to modify server-managed meta fields
  // (e.g. `feedbackSenderName`) which can cause 403 errors.
  const safePayload = { ...payload };
  try {
    if (safePayload && safePayload.meta && typeof safePayload.meta === 'object') {
      // remove known read-only/managed meta keys before sending
      const { feedbackSenderName, ...rest } = safePayload.meta;
      // if meta becomes empty, avoid sending an empty object
      safePayload.meta = Object.keys(rest).length ? rest : undefined;
    }
  } catch (e) {
    // if anything goes wrong cleaning meta, fall back to original payload
    // and let the server return an appropriate error
  }

  const res = await api.put(`${LEGACY_BASE}/${id}`, safePayload);
  return res.data; // { item }
}

export async function deleteFileTransfer(id) {
  const res = await api.delete(`${LEGACY_BASE}/${id}`);
  return res.data; // { success, total }
}

export default { fetchFileTransfers, createFileTransfer, getFileTransfer, updateFileTransfer, deleteFileTransfer };
