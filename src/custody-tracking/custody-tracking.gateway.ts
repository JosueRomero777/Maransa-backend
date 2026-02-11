import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { CustodyTrackingSessionService } from './custody-tracking-session.service';
import { PrismaService } from '../prisma/prisma.service';

interface CustodyTrackedUser {
  userId: number;
  custodyId: number;
  lat: number;
  lng: number;
  timestamp: number;
  sessionId: string;
}

interface CustodySpectator {
  userId: number;
  socketId: string;
  custodyId: number;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/custody-tracking'
})
export class CustodyTrackingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(CustodyTrackingGateway.name);

  @WebSocketServer()
  server: Server;

  private activeTrackers = new Map<number, CustodyTrackedUser>();
  private spectators = new Map<number, CustodySpectator[]>();
  private socketUserMap = new Map<string, { userId: number; custodyId: number }>();

  constructor(
    private custodyTrackingSessionService: CustodyTrackingSessionService,
    private prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Custody Tracking Gateway initialized');
    setInterval(() => {
      this.custodyTrackingSessionService.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado (custodia): ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado (custodia): ${client.id}`);

    const userInfo = this.socketUserMap.get(client.id);
    if (userInfo) {
      const { custodyId, userId } = userInfo;

      const activeTracker = this.activeTrackers.get(custodyId);
      if (activeTracker?.userId === userId) {
        this.logger.log(`Rastreador de custodia desconectado, tracking permanece activo para custodia ${custodyId}`);
      }

      const specs = this.spectators.get(custodyId) || [];
      this.spectators.set(
        custodyId,
        specs.filter(s => s.socketId !== client.id)
      );
    }

    this.socketUserMap.delete(client.id);
  }

  @SubscribeMessage('start_custody_tracking')
  async handleStartTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { custodyId: number; userId: number; token: string }
  ) {
    try {
      const { custodyId, userId } = payload;

      const session = await this.custodyTrackingSessionService.startSession(custodyId, userId);

      this.socketUserMap.set(client.id, { userId, custodyId });
      client.join(`custody:${custodyId}`);

      this.activeTrackers.set(custodyId, {
        userId,
        custodyId,
        lat: 0,
        lng: 0,
        timestamp: Date.now(),
        sessionId: session.sessionId
      });

      this.server.to(`custody:${custodyId}`).emit('custody_tracking_started', {
        userId,
        custodyId,
        timestamp: Date.now()
      });

      client.emit('custody_tracking_started_ack', {
        success: true,
        sessionId: session.sessionId,
        custodyId
      });

      return { success: true, sessionId: session.sessionId };
    } catch (error) {
      this.logger.error(`Error iniciando custodia tracking: ${error.message}`);
      client.emit('custody_tracking_error', { success: false, message: error.message });
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('update_custody_location')
  async handleUpdateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { custodyId: number; lat: number; lng: number; accuracy?: number }
  ) {
    try {
      const { custodyId, lat, lng, accuracy } = payload;
      const userInfo = this.socketUserMap.get(client.id);

      if (!userInfo) {
        return { success: false, error: 'No session found' };
      }

      const { userId } = userInfo;

      if (!this.custodyTrackingSessionService.hasActiveTracking(custodyId, userId)) {
        return { success: false, error: 'No active tracking session' };
      }

      this.activeTrackers.set(custodyId, {
        userId,
        custodyId,
        lat,
        lng,
        timestamp: Date.now(),
        sessionId: ''
      });

      this.custodyTrackingSessionService.updateLastActivity(custodyId, userId);

      this.prisma.custody.update({
        where: { id: custodyId },
        data: {
          ubicacionActualLat: lat,
          ubicacionActualLng: lng,
          ultimaActualizacion: new Date(),
          historialUbicaciones: await this.getUpdatedHistory(custodyId, lat, lng)
        }
      }).catch(err => this.logger.error(`Error guardando ubicacion custodia: ${err.message}`));

      this.server.to(`custody:${custodyId}`).emit('custody_location_updated', {
        userId,
        custodyId,
        lat,
        lng,
        accuracy,
        timestamp: Date.now()
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error actualizando ubicacion custodia: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('join_custody_tracking')
  async handleJoinTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { custodyId: number; userId: number }
  ) {
    try {
      const { custodyId, userId } = payload;

      this.socketUserMap.set(client.id, { userId, custodyId });
      client.join(`custody:${custodyId}`);

      const specs = this.spectators.get(custodyId) || [];
      specs.push({ userId, socketId: client.id, custodyId });
      this.spectators.set(custodyId, specs);

      const currentLocation = this.activeTrackers.get(custodyId);
      const dbData = await this.prisma.custody.findUnique({
        where: { id: custodyId },
        select: {
          ubicacionActualLat: true,
          ubicacionActualLng: true,
          historialUbicaciones: true,
          usuarioTrackingActivo: true,
          trackingActivo: true,
          sessionIdTracking: true
        }
      });

      const trackerUser = dbData?.usuarioTrackingActivo
        ? await this.prisma.user.findUnique({
            where: { id: dbData.usuarioTrackingActivo },
            select: { id: true, name: true, email: true }
          })
        : null;

      if (!dbData?.trackingActivo) {
        return { success: false, error: 'No hay tracking activo para esta custodia' };
      }

      client.emit('custody_spectator_joined_ack', {
        custodyId,
        sessionId: dbData?.sessionIdTracking,
        currentLocation: currentLocation || {
          lat: dbData?.ubicacionActualLat,
          lng: dbData?.ubicacionActualLng,
          timestamp: Date.now()
        },
        activeTracker: dbData?.usuarioTrackingActivo,
        activeTrackerUser: trackerUser,
        totalSpectators: specs.length
      });

      client.emit('custody_current_location', {
        custodyId,
        currentLocation: currentLocation || {
          lat: dbData?.ubicacionActualLat,
          lng: dbData?.ubicacionActualLng,
          timestamp: Date.now()
        },
        activeTracker: dbData?.usuarioTrackingActivo,
        activeTrackerUser: trackerUser,
        spectators: specs.length
      });

      this.server.to(`custody:${custodyId}`).emit('custody_spectator_joined', {
        userId,
        custodyId,
        totalSpectators: specs.length
      });

      return { success: true, spectators: specs.length };
    } catch (error) {
      this.logger.error(`Error uniendose a custodia tracking: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('get_custody_current_location')
  handleGetCurrentLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { custodyId: number }
  ) {
    try {
      const { custodyId } = payload;
      const currentLocation = this.activeTrackers.get(custodyId);
      const specs = this.spectators.get(custodyId) || [];

      return {
        success: true,
        currentLocation: currentLocation || null,
        spectators: specs.length,
        isActive: !!currentLocation
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('stop_custody_tracking')
  async handleStopTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { custodyId: number; userId: number }
  ) {
    try {
      const { custodyId, userId } = payload;

      const activeTracker = this.activeTrackers.get(custodyId);

      if (!activeTracker || activeTracker.userId !== userId) {
        return { success: false, error: 'Not the active tracker' };
      }

      await this.custodyTrackingSessionService.endSession(custodyId, activeTracker.sessionId);
      this.activeTrackers.delete(custodyId);
      client.leave(`custody:${custodyId}`);

      this.server.to(`custody:${custodyId}`).emit('custody_tracking_stopped', {
        userId,
        custodyId,
        timestamp: Date.now()
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error deteniendo custodia tracking: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private async getUpdatedHistory(custodyId: number, lat: number, lng: number): Promise<any> {
    try {
      const current = await this.prisma.custody.findUnique({
        where: { id: custodyId },
        select: { historialUbicaciones: true }
      });

      const history = (current?.historialUbicaciones as any) || [];
      return [
        ...history,
        { lat, lng, timestamp: Date.now() }
      ];
    } catch {
      return [{ lat, lng, timestamp: Date.now() }];
    }
  }

  private notifyTrackingStopped(custodyId: number): void {
    this.server.to(`custody:${custodyId}`).emit('custody_tracking_stopped_by_system', {
      custodyId,
      timestamp: Date.now(),
      message: 'Custodia se desconecto'
    });
  }
}
