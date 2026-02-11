import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Gestiona sesiones activas de tracking
 * Solo permite 1 usuario activo por logística
 */
@Injectable()
export class TrackingSessionService {
  private readonly logger = new Logger(TrackingSessionService.name);
  private activeSessions = new Map<number, {
    logisticsId: number;
    userId: number;
    startTime: Date;
    lastUpdateTime: Date;
    sessionId: string;
  }>();

  constructor(private prisma: PrismaService) {}

  /**
   * Inicia una sesión de tracking para un usuario
   * Solo permite una sesión activa por logística
   */
  async startSession(logisticsId: number, userId: number): Promise<{
    sessionId: string;
    success: boolean;
    message: string;
  }> {
    try {
      const userActiveSession = Array.from(this.activeSessions.values()).find(
        s => s.userId === userId && s.logisticsId !== logisticsId
      );

      if (userActiveSession) {
        throw new HttpException(
          'El usuario ya tiene un rastreo activo en otra logística. Finaliza ese rastreo antes de iniciar uno nuevo.',
          HttpStatus.CONFLICT
        );
      }

      const activeLogisticsInDb = await this.prisma.logistics.findFirst({
        where: {
          trackingActivo: true,
          usuarioTrackingActivo: userId,
          id: { not: logisticsId }
        },
        select: { id: true }
      });

      if (activeLogisticsInDb) {
        throw new HttpException(
          'El usuario ya tiene un rastreo activo en otra logística. Finaliza ese rastreo antes de iniciar uno nuevo.',
          HttpStatus.CONFLICT
        );
      }

      const activeCustodyInDb = await this.prisma.custody.findFirst({
        where: {
          trackingActivo: true,
          usuarioTrackingActivo: userId
        },
        select: { id: true }
      });

      if (activeCustodyInDb) {
        throw new HttpException(
          'El usuario ya tiene un rastreo activo en custodia. Finaliza ese rastreo antes de iniciar logística.',
          HttpStatus.CONFLICT
        );
      }

      // Verificar si hay otra sesión activa
      const existingSession = Array.from(this.activeSessions.values()).find(
        s => s.logisticsId === logisticsId && s.userId !== userId
      );

      if (existingSession) {
        throw new HttpException(
          `Tracking ya está activo por usuario ID: ${existingSession.userId}. Solo un usuario puede rastrear a la vez.`,
          HttpStatus.CONFLICT
        );
      }

      // Verificar si el usuario ya tiene una sesión abierta
      const userSession = Array.from(this.activeSessions.values()).find(
        s => s.userId === userId && s.logisticsId === logisticsId
      );

      if (userSession) {
        return {
          sessionId: userSession.sessionId,
          success: true,
          message: 'Sesión ya activa'
        };
      }

      // Crear nueva sesión
      const sessionId = `${logisticsId}-${userId}-${Date.now()}`;
      const session = {
        logisticsId,
        userId,
        startTime: new Date(),
        lastUpdateTime: new Date(),
        sessionId
      };

      this.activeSessions.set(logisticsId, session);

      // Guardar en BD
      await this.prisma.logistics.update({
        where: { id: logisticsId },
        data: {
          trackingActivo: true,
          usuarioTrackingActivo: userId,
          sessionIdTracking: sessionId,
          fechaInicioTracking: new Date()
        }
      });

      this.logger.log(`✓ Sesión iniciada: ${sessionId}`);

      return {
        sessionId,
        success: true,
        message: 'Tracking iniciado'
      };

    } catch (error) {
      this.logger.error(`Error iniciando sesión: ${error.message}`);
      throw error;
    }
  }

  /**
   * Termina una sesión de tracking
   */
  async endSession(logisticsId: number, sessionId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(logisticsId);

      if (!session || session.sessionId !== sessionId) {
        throw new HttpException('Sesión no válida', HttpStatus.BAD_REQUEST);
      }

      this.activeSessions.delete(logisticsId);

      // Actualizar BD
      await this.prisma.logistics.update({
        where: { id: logisticsId },
        data: {
          trackingActivo: false,
          usuarioTrackingActivo: null,
          sessionIdTracking: null,
          fechaCierreTracking: new Date()
        }
      });

      this.logger.log(`✓ Sesión cerrada: ${sessionId}`);

    } catch (error) {
      this.logger.error(`Error cerrando sesión: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene la sesión activa para una logística
   */
  getActiveSession(logisticsId: number): any | null {
    return this.activeSessions.get(logisticsId) || null;
  }

  /**
   * Verifica si un usuario tiene permiso de rastreo activo
   */
  hasActiveTracking(logisticsId: number, userId: number): boolean {
    const session = this.activeSessions.get(logisticsId);
    return session?.userId === userId && session.lastUpdateTime.getTime() > Date.now() - 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Actualiza el timestamp de última actualización
   */
  updateLastActivity(logisticsId: number, userId: number): void {
    const session = this.activeSessions.get(logisticsId);
    if (session && session.userId === userId) {
      session.lastUpdateTime = new Date();
    }
  }

  /**
   * Obtiene todas las sesiones activas
   */
  getActiveSessions(): any[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Limpia sesiones expiradas (sin actividad en > 10 minutos)
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    const expired: number[] = [];

    this.activeSessions.forEach((session, logisticsId) => {
      if (now - session.lastUpdateTime.getTime() > 10 * 60 * 1000) {
        expired.push(logisticsId);
      }
    });

    expired.forEach(logisticsId => {
      const session = this.activeSessions.get(logisticsId);
      this.activeSessions.delete(logisticsId);
      this.logger.warn(`Sesión expirada limpiada: ${logisticsId}`);

      if (session) {
        this.prisma.logistics.update({
          where: { id: logisticsId },
          data: {
            trackingActivo: false,
            usuarioTrackingActivo: null,
            sessionIdTracking: null,
            fechaCierreTracking: new Date()
          }
        }).catch(err => this.logger.error(`Error limpiando sesión expirada: ${err.message}`));
      }
    });
  }
}
