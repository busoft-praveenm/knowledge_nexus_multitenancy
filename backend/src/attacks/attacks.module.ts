import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { AttacksController } from './attacks.controller';
import { AttacksService } from './attacks.service';

@Module({ imports: [AgentModule], controllers: [AttacksController], providers: [AttacksService] })
export class AttacksModule {}
