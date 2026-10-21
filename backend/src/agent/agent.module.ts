import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { LlmClient } from './llm.client';
import { ScriptedAgentService } from './scripted-agent.service';
import { CuratedTools } from './tools/curated-tools';
import { RunSqlTool } from './tools/run-sql.tool';

@Module({
  controllers: [AgentController],
  providers: [AgentService, ScriptedAgentService, LlmClient, RunSqlTool, CuratedTools],
  exports: [RunSqlTool, CuratedTools, ScriptedAgentService],
})
export class AgentModule {}
