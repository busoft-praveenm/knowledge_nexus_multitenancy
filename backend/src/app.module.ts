import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AgentModule } from './agent/agent.module';
import { AttacksModule } from './attacks/attacks.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { envValidationSchema } from './config/env.validation';
import { DataModule } from './data/data.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envValidationSchema }),
    DatabaseModule,
    AuthModule,
    AuditModule,
    AdminModule,
    DataModule,
    AgentModule,
    AttacksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
