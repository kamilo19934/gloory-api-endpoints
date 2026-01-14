import { Module, Global } from '@nestjs/common';
import { HealthAtomService } from './healthatom.service';

@Global()
@Module({
  providers: [HealthAtomService],
  exports: [HealthAtomService],
})
export class HealthAtomModule {}
