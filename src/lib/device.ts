'use client';

import { nanoid } from 'nanoid';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'laptop' | 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
}

const DEVICE_ID_KEY = 'vaultdrop_device_id';
const DEVICE_NAME_KEY = 'vaultdrop_device_name';

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'dev_' + nanoid(16);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function detectBrowserAndOS(): { browser: string; os: string; deviceType: 'laptop' | 'desktop' | 'mobile' | 'tablet' } {
  if (typeof window === 'undefined') {
    return { browser: 'Unknown', os: 'Unknown', deviceType: 'desktop' };
  }

  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';

  let browser = 'Unknown Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/OPR\//i.test(ua)) browser = 'Opera';

  let deviceType: 'laptop' | 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/Mobi|Android/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/iPad|Tablet/i.test(ua) || (os === 'macOS' && navigator.maxTouchPoints > 1)) {
    deviceType = 'tablet';
  } else if (os === 'Windows' || os === 'macOS' || os === 'Linux') {
    // Distinguish laptops/desktops via screen or battery API heuristic if available
    deviceType = window.screen.width <= 1600 && window.screen.height <= 1080 ? 'laptop' : 'desktop';
  }

  return { browser, os, deviceType };
}

export function getDefaultDeviceName(): string {
  if (typeof window === 'undefined') return 'Device';
  const savedName = localStorage.getItem(DEVICE_NAME_KEY);
  if (savedName) return savedName;

  const { os, browser, deviceType } = detectBrowserAndOS();
  const typeLabel = deviceType.charAt(0).toUpperCase() + deviceType.slice(1);
  return `${os} ${typeLabel} (${browser})`;
}

export function saveCustomDeviceName(name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEVICE_NAME_KEY, name.trim());
}

export function getClientDeviceInfo(): DeviceInfo {
  const deviceId = getOrCreateDeviceId();
  const { browser, os, deviceType } = detectBrowserAndOS();
  const deviceName = getDefaultDeviceName();

  return {
    deviceId,
    deviceName,
    deviceType,
    browser,
    os,
  };
}

export async function registerCurrentDevice(): Promise<void> {
  if (typeof window === 'undefined') return;
  const info = getClientDeviceInfo();
  try {
    await fetch('/api/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(info),
    });
  } catch (err) {
    console.warn('Failed to register device:', err);
  }
}

export async function sendDeviceHeartbeat(): Promise<void> {
  if (typeof window === 'undefined') return;
  const deviceId = getOrCreateDeviceId();
  try {
    await fetch('/api/devices/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
  } catch {}
}

export const getDeviceId = getOrCreateDeviceId;

