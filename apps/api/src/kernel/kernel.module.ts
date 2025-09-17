import { Module, Global } from '@nestjs/common';
import { EventBusService } from './services/event-bus.service';
import { ContractService } from './services/contract.service';
import { HookService } from './services/hook.service';
import { PluginRuntimeService } from './services/plugin-runtime.service';

@Global()
@Module({
  providers: [
    EventBusService,
    ContractService,
    HookService,
    PluginRuntimeService,
  ],
  exports: [
    EventBusService,
    ContractService,
    HookService,
    PluginRuntimeService,
  ],
})
export class KernelModule {}
