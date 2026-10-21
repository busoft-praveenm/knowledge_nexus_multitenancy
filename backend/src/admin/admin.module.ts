import { Global, Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { RlsStateService } from './rls-state.service';

@Global()
@Module({
  controllers: [AdminController],
  providers: [RlsStateService],
  exports: [RlsStateService],
})
export class AdminModule {}
