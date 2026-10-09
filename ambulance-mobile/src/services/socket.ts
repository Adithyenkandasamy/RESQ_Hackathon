import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../api/client';
import { SecureStorageService } from './secureStorage';

type EventHandler = (data: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private currentAmbulanceId: string | null = null;
  private currentEmergencyId: string | null = null;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();

  async connect(ambulanceId?: string): Promise<void> {
    if (this.socket && this.socket.connected) {
      if (ambulanceId && ambulanceId !== this.currentAmbulanceId) {
        this.currentAmbulanceId = ambulanceId;
        this.joinRoom(`ambulance:${ambulanceId}`);
      }
      return;
    }

    const token = await SecureStorageService.getToken();
    if (!token) return;

    if (ambulanceId) {
      this.currentAmbulanceId = ambulanceId;
    }

    this.socket = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      if (this.currentAmbulanceId) {
        this.joinRoom(`ambulance:${this.currentAmbulanceId}`);
      }
      if (this.currentEmergencyId) {
        this.joinRoom(`emergency:${this.currentEmergencyId}`);
      }
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
    });

    // Wire global event forwarding
    const events = [
      'hospital.assigned',
      'emergency.status.updated',
      'hospital_request.declined',
      'hospital_request.accepted',
    ];

    events.forEach((eventName) => {
      this.socket?.on(eventName, (data) => {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers) {
          handlers.forEach((h) => h(data));
        }
      });
    });
  }

  joinRoom(room: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_room', { room });
    }
  }

  setEmergencyRoom(emergencyId: string | null) {
    this.currentEmergencyId = emergencyId;
    if (emergencyId && this.socket && this.socket.connected) {
      this.joinRoom(`emergency:${emergencyId}`);
    }
  }

  on(eventName: string, handler: EventHandler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
    this.eventHandlers.get(eventName)!.add(handler);
  }

  off(eventName: string, handler: EventHandler) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.currentAmbulanceId = null;
    this.currentEmergencyId = null;
    this.eventHandlers.clear();
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

export const socketService = new SocketService();
