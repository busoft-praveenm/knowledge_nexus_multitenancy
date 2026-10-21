import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { RlsStateService } from '../admin/rls-state.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantContext } from '../common/tenant-context';
import { AgentService } from './agent.service';
import { AgentMode, Toolset } from './agent.types';
import { LlmClient } from './llm.client';
import { ScriptedAgentService } from './scripted-agent.service';
import { CuratedTools } from './tools/curated-tools';

class HistoryItem {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString() @MaxLength(8000)
  content: string;
}

class ChatDto {
  @IsString() @MinLength(1) @MaxLength(2000)
  message: string;

  @IsIn(['llm', 'scripted'])
  mode: AgentMode;

  @IsOptional() @IsIn(['sql', 'curated'])
  toolset?: Toolset;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => HistoryItem)
  history?: HistoryItem[];

  /** Demo control: run this one request with the RLS policy on (default) or off. */
  @IsOptional() @IsIn(['on', 'off'])
  rls?: 'on' | 'off';
}

@Controller('agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(
    private readonly llmAgent: AgentService,
    private readonly scripted: ScriptedAgentService,
    private readonly llm: LlmClient,
    private readonly rls: RlsStateService,
  ) {}

  @Get('status')
  async status() {
    return { llm: await this.llm.health(), examples: ScriptedAgentService.examples, curatedTools: CuratedTools.names };
  }

  /**
   * The real security policy is switched to the requested state for the duration of this
   * request only, then restored (even if the agent or the LLM fails) — the same mechanism the
   * Attack Lab uses, so the same prompt can be compared with RLS on and off.
   */
  @Post('chat')
  chat(@CurrentUser() user: TenantContext, @Body() dto: ChatDto) {
    const run = () =>
      dto.mode === 'llm'
        ? this.llmAgent.chat(user, dto.message, dto.history ?? [], dto.toolset ?? 'sql')
        : this.scripted.chat(user, dto.message, dto.toolset ?? 'sql');
    return this.rls.runWithState(dto.rls !== 'off', run);
  }
}
