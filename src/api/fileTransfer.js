import axios from 'axios';
import { API_BASE } from '../config';
import api from '../services/api';

const LEGACY_BASE = `${API_BASE.replace(/\/+$/, '')}/kshf_hospital_app/file-transfers`;
const OUT_BASE = `${API_BASE.replace(/\/+$/, '')}/kshf_hospital_app/file-transfers-out`;

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
  const safePayload = { ...payload };
  try {
    if (safePayload && safePayload.meta && typeof safePayload.meta === 'object') {
      const { feedbackSenderName, ...rest } = safePayload.meta;
      safePayload.meta = Object.keys(rest).length ? rest : undefined;
    }
  } catch (e) { }

  const res = await api.put(`${LEGACY_BASE}/${id}`, safePayload);
  return res.data; // { item }
}

export async function deleteFileTransfer(id) {
  const res = await api.delete(`${LEGACY_BASE}/${id}`);
  return res.data; // { success, total }
}

// ===== Outgoing File Transfers (filetransfers-out collection) =====

export async function fetchFileTransfersOut(type, page = 1, pageSize = 10) {
  const params = { page, pageSize };
  if (type && type !== 'ទាំងអស់') params.type = type;
  const res = await api.get(OUT_BASE, { params });
  return res.data;
}

export async function createFileTransferOut(payload) {
  const res = await api.post(OUT_BASE, payload);
  return res.data;
}

export async function getFileTransferOut(id) {
  const res = await api.get(`${OUT_BASE}/${id}`);
  return res.data;
}

export async function updateFileTransferOut(id, payload) {
  const safePayload = { ...payload };
  try {
    if (safePayload && safePayload.meta && typeof safePayload.meta === 'object') {
      const { feedbackSenderName, ...rest } = safePayload.meta;
      safePayload.meta = Object.keys(rest).length ? rest : undefined;
    }
  } catch (e) { }

  const res = await api.put(`${OUT_BASE}/${id}`, safePayload);
  return res.data;
}

export async function deleteFileTransferOut(id) {
  const res = await api.delete(`${OUT_BASE}/${id}`);
  return res.data;
}

export default { fetchFileTransfers, createFileTransfer, getFileTransfer, updateFileTransfer, deleteFileTransfer };
