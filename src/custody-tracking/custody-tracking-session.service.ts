import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Gestiona sesiones activas de tracking para custodia.
 * Solo permite 1 usuario activo por custodia.
 */
@Injectable()
export class CustodyTrackingSessionService {
  private readonly logger = new Logger(CustodyTrackingSessionService.name);
  private activeSessions = new Map<number, {
    custodyId: number;
    userId: number;
    startTime: Date;
    lastUpdateTime: Date;
    sessionId: string;
  }>();

  constructor(private prisma: PrismaService) {}

  async startSession(custodyId: number, userId: number): Promise<{
    sessionId: string;
    success: boolean;
    message: string;
  }> {
    try {
      const userActiveSession = Array.from(this.activeSessions.values()).find(
        s => s.userId === userId && s.custodyId !== custodyId
      );

      if (userActiveSession) {
        throw new HttpException(
          'El usuario ya tiene un rastreo activo en otra custodia. Finaliza ese rastreo antes de iniciar uno nuevo.',
          HttpStatus.CONFLICT
        );
      }

      const activeCustodyInDb = await this.prisma.custody.findFirst({
        where: {
          trackingActivo: true,
          usuarioTrackingActivo: userId,
          id: { not: custodyId }
        },
        select: { id: true }
      });

      if (activeCustodyInDb) {
        throw new HttpException(
          'El usuario ya tiene un rastreo activo en otra custodia. Finaliza ese rastreo antes de iniciar uno nuevo.',
          HttpStatus.CONFLICT
        );
      }

      const activeLogisticsInDb = await this.prisma.logistics.findFirst({
        where: {
          trackingActivo: true,
          usuarioTrackingActivo: userId
        },
        select: { id: true }
      });

      if (activeLogisticsInDb) {
        throw new HttpException(
          'El usuario ya tiene un rastreo activo en logística. Finaliza ese rastreo antes de iniciar custodia.',
          HttpStatus.CONFLICT
        );
      }

      const existingSession = Array.from(this.activeSessions.values()).find(
        s => s.custodyId === custodyId && s.userId !== userId
      );

      if (existingSession) {
        throw new HttpException(
          `Custodia ya esta activa por usuario ID: ${existingSession.userId}. Solo un usuario puede rastrear a la vez.`,
          HttpStatus.CONFLICT
        );
      }

      const userSession = Array.from(this.activeSessions.values()).find(
        s => s.userId === userId && s.custodyId === custodyId
      );

      if (userSession) {
        return {
          sessionId: userSession.sessionId,
          success: true,
          message: 'Sesion ya activa'
        };
      }

      const sessionId = `${custodyId}-${userId}-${Date.now()}`;
      const session = {
        custodyId,
        userId,
        startTime: new Date(),
        lastUpdateTime: new Date(),
        sessionId
      };

      this.activeSessions.set(custodyId, session);

      await this.prisma.custody.update({
        where: { id: custodyId },
        data: {
          trackingActivo: true,
          usuarioTrackingActivo: userId,
          sessionIdTracking: sessionId,
          fechaInicioTracking: new Date()
        }
      });

      this.logger.log(`Sesion custodia iniciada: ${sessionId}`);

      return {
        sessionId,
        success: true,
        message: 'Tracking custodia iniciado'
      };
    } catch (error) {
      this.logger.error(`Error iniciando sesion custodia: ${error.message}`);
      throw error;
    }
  }

  async endSession(custodyId: number, sessionId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(custodyId);

      if (!session || session.sessionId !== sessionId) {
        throw new HttpException('Sesion no valida', HttpStatus.BAD_REQUEST);
      }

      this.activeSessions.delete(custodyId);

      await this.prisma.custody.update({
        where: { id: custodyId },
        data: {
          trackingActivo: false,
          usuarioTrackingActivo: null,
          sessionIdTracking: null,
          fechaCierreTracking: new Date()
        }
      });

      this.logger.log(`Sesion custodia cerrada: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error cerrando sesion custodia: ${error.message}`);
      throw error;
    }
  }

  hasActiveTracking(custodyId: number, userId: number): boolean {
    const session = this.activeSessions.get(custodyId);
    return session?.userId === userId && session.lastUpdateTime.getTime() > Date.now() - 5 * 60 * 1000;
  }

  updateLastActivity(custodyId: number, userId: number): void {
    const session = this.activeSessions.get(custodyId);
    if (session && session.userId === userId) {
      session.lastUpdateTime = new Date();
    }
  }

  cleanupExpiredSessions(): void {
    const now = Date.now();
    const expired: number[] = [];

    this.activeSessions.forEach((session, custodyId) => {
      if (now - session.lastUpdateTime.getTime() > 10 * 60 * 1000) {
        expired.push(custodyId);
      }
    });

    expired.forEach(custodyId => {
      const session = this.activeSessions.get(custodyId);
      this.activeSessions.delete(custodyId);
      this.logger.warn(`Sesion custodia expirada: ${custodyId}`);

      if (session) {
        this.prisma.custody.update({
          where: { id: custodyId },
          data: {
            trackingActivo: false,
            usuarioTrackingActivo: null,
            sessionIdTracking: null,
            fechaCierreTracking: new Date()
          }
        }).catch(err => this.logger.error(`Error limpiando sesion custodia expirada: ${err.message}`));
      }
    });
  }
}
