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
import { Logger, UseGuards, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TrackingSessionService } from './tracking-session.service';
import { PrismaService } from '../prisma/prisma.service';

interface TrackedUser {
  userId: number;
  logisticsId: number;
  lat: number;
  lng: number;
  timestamp: number;
  sessionId: string;
}

interface Spectator {
  userId: number;
  socketId: string;
  logisticsId: number;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/tracking'
})
export class TrackingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TrackingGateway.name);

  @WebSocketServer()
  server: Server;

  // Mapa de usuarios activos: logisticsId -> TrackedUser
  private activeTrackers = new Map<number, TrackedUser>();
  
  // Mapa de espectadores: logisticsId -> Spectator[]
  private spectators = new Map<number, Spectator[]>();

  // Mapa de socketId a info del usuario
  private socketUserMap = new Map<string, { userId: number; logisticsId: number }>();

  constructor(
    private trackingSessionService: TrackingSessionService,
    private prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('🚀 WebSocket Tracking Gateway initialized');
    
    // Limpiar sesiones expiradas cada 5 minutos
    setInterval(() => {
      this.trackingSessionService.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  }

  handleConnection(client: Socket) {
    this.logger.log(`✓ Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`✗ Cliente desconectado: ${client.id}`);
    
    // Buscar y limpiar usuario rastreador
    const userInfo = this.socketUserMap.get(client.id);
    if (userInfo) {
      const { logisticsId, userId } = userInfo;
      
      // Si era el rastreador activo, detener tracking
      const activeTracker = this.activeTrackers.get(logisticsId);
      if (activeTracker?.userId === userId) {
        this.logger.log(`Rastreador desconectado, tracking permanece activo para logística ${logisticsId}`);
      }

      // Remover de espectadores
      const specs = this.spectators.get(logisticsId) || [];
      this.spectators.set(
        logisticsId,
        specs.filter(s => s.socketId !== client.id)
      );
    }

    this.socketUserMap.delete(client.id);
  }

  /**
   * Inicia sesión de tracking
   */
  @SubscribeMessage('start_tracking')
  async handleStartTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { logisticsId: number; userId: number; token: string }
  ) {
    try {
      const { logisticsId, userId } = payload;

      this.logger.log(`▶️ start_tracking: logistics=${logisticsId}, user=${userId}`);

      // Iniciar sesión
      const session = await this.trackingSessionService.startSession(logisticsId, userId);

      // Registrar socket
      this.socketUserMap.set(client.id, { userId, logisticsId });

      // Unirse a sala de logística
      client.join(`tracking:${logisticsId}`);

      // Registrar como rastreador activo
      this.activeTrackers.set(logisticsId, {
        userId,
        logisticsId,
        lat: 0,
        lng: 0,
        timestamp: Date.now(),
        sessionId: session.sessionId
      });

      // Notificar a todos en la sala
      this.server.to(`tracking:${logisticsId}`).emit('tracking_started', {
        userId,
        logisticsId,
        timestamp: Date.now(),
        message: `Usuario ${userId} comenzó rastreo`
      });

      client.emit('tracking_started_ack', {
        success: true,
        sessionId: session.sessionId,
        logisticsId
      });

      return { success: true, sessionId: session.sessionId };

    } catch (error) {
      this.logger.error(`Error iniciando tracking: ${error.message}`);
      client.emit('tracking_error', {
        success: false,
        message: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Actualiza ubicación en tiempo real
   */
  @SubscribeMessage('update_location')
  async handleUpdateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { logisticsId: number; lat: number; lng: number; accuracy?: number }
  ) {
    try {
      const { logisticsId, lat, lng, accuracy } = payload;
      const userInfo = this.socketUserMap.get(client.id);

      if (!userInfo) {
        return { success: false, error: 'No session found' };
      }

      const { userId } = userInfo;

      // Verificar que el usuario tiene rastreo activo
      if (!this.trackingSessionService.hasActiveTracking(logisticsId, userId)) {
        return { success: false, error: 'No active tracking session' };
      }

      // Actualizar ubicación
      this.activeTrackers.set(logisticsId, {
        userId,
        logisticsId,
        lat,
        lng,
        timestamp: Date.now(),
        sessionId: ''
      });

      // Actualizar último acceso en servicio de sesión
      this.trackingSessionService.updateLastActivity(logisticsId, userId);

      // Guardar en BD (de forma asincrónica, sin bloquear)
      this.prisma.logistics.update({
        where: { id: logisticsId },
        data: {
          ubicacionActualLat: lat,
          ubicacionActualLng: lng,
          ultimaActualizacion: new Date(),
          // Agregar a historial
          historialUbicaciones: await this.getUpdatedHistory(logisticsId, lat, lng)
        }
      }).catch(err => this.logger.error(`Error guardando ubicación: ${err.message}`));

      // Broadcast a espectadores en tiempo real
      this.server.to(`tracking:${logisticsId}`).emit('location_updated', {
        userId,
        logisticsId,
        lat,
        lng,
        accuracy,
        timestamp: Date.now()
      });

      return { success: true };

    } catch (error) {
      this.logger.error(`Error actualizando ubicación: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Usuario se une como espectador
   */
  @SubscribeMessage('join_tracking')
  async handleJoinTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { logisticsId: number; userId: number }
  ) {
    try {
      const { logisticsId, userId } = payload;

      this.logger.log(`👁️ Usuario ${userId} se unió como espectador a logística ${logisticsId}`);

      // Registrar socket
      this.socketUserMap.set(client.id, { userId, logisticsId });

      // Unirse a sala
      client.join(`tracking:${logisticsId}`);

      // Agregar a espectadores
      const specs = this.spectators.get(logisticsId) || [];
      specs.push({ userId, socketId: client.id, logisticsId });
      this.spectators.set(logisticsId, specs);

      // Obtener ubicación actual
      const currentLocation = this.activeTrackers.get(logisticsId);
      const dbData = await this.prisma.logistics.findUnique({
        where: { id: logisticsId },
        select: {
          ubicacionActualLat: true,
          ubicacionActualLng: true,
          historialUbicaciones: true,
          usuarioTrackingActivo: true,
          sessionIdTracking: true,
          trackingActivo: true
        }
      });

      const trackerUser = dbData?.usuarioTrackingActivo
        ? await this.prisma.user.findUnique({
            where: { id: dbData.usuarioTrackingActivo },
            select: { id: true, name: true, email: true }
          })
        : null;

      // Verificar si hay tracking activo
      if (!dbData?.trackingActivo) {
        return { success: false, error: 'No hay tracking activo para esta logística' };
      }

      // Enviar confirmación al espectador que se unió
      client.emit('spectator_joined_ack', {
        logisticsId,
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

      // Enviar ubicación actual al espectador (mantener por compatibilidad)
      client.emit('current_location', {
        logisticsId,
        currentLocation: currentLocation || {
          lat: dbData?.ubicacionActualLat,
          lng: dbData?.ubicacionActualLng,
          timestamp: Date.now()
        },
        activeTracker: dbData?.usuarioTrackingActivo,
        activeTrackerUser: trackerUser,
        spectators: specs.length
      });

      // Notificar a otros que un espectador se unió
      this.server.to(`tracking:${logisticsId}`).emit('spectator_joined', {
        userId,
        logisticsId,
        totalSpectators: specs.length
      });

      return { success: true, spectators: specs.length };

    } catch (error) {
      this.logger.error(`Error uniéndose como espectador: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene ubicación actual
   */
  @SubscribeMessage('get_current_location')
  handleGetCurrentLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { logisticsId: number }
  ) {
    try {
      const { logisticsId } = payload;
      const currentLocation = this.activeTrackers.get(logisticsId);
      const specs = this.spectators.get(logisticsId) || [];

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

  /**
   * Detiene tracking
   */
  @SubscribeMessage('stop_tracking')
  async handleStopTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { logisticsId: number; userId: number }
  ) {
    try {
      const { logisticsId, userId } = payload;

      const activeTracker = this.activeTrackers.get(logisticsId);

      if (!activeTracker || activeTracker.userId !== userId) {
        return { success: false, error: 'Not the active tracker' };
      }

      // Detener sesión
      await this.trackingSessionService.endSession(logisticsId, activeTracker.sessionId);
      
      // Remover rastreador activo
      this.activeTrackers.delete(logisticsId);

      // Dejar sala
      client.leave(`tracking:${logisticsId}`);

      // Notificar a todos
      this.server.to(`tracking:${logisticsId}`).emit('tracking_stopped', {
        userId,
        logisticsId,
        timestamp: Date.now()
      });

      this.logger.log(`⏹️ Tracking detenido: logistics=${logisticsId}, user=${userId}`);

      return { success: true };

    } catch (error) {
      this.logger.error(`Error deteniendo tracking: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper: actualiza historial de ubicaciones
   */
  private async getUpdatedHistory(
    logisticsId: number,
    lat: number,
    lng: number
  ): Promise<any> {
    try {
      const current = await this.prisma.logistics.findUnique({
        where: { id: logisticsId },
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

  /**
   * Notifica que tracking se detuvo
   */
  private notifyTrackingStopped(logisticsId: number): void {
    this.server.to(`tracking:${logisticsId}`).emit('tracking_stopped_by_system', {
      logisticsId,
      timestamp: Date.now(),
      message: 'Rastreador se desconectó'
    });
  }
}
