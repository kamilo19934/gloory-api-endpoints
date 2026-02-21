import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoHighLevelController } from './gohighlevel.controller';
import { GoHighLevelProxyService } from './gohighlevel-proxy.service';
import { ClientsModule } from '../clients/clients.module';
import { GHLCalendar } from './entities/ghl-calendar.entity';
import { GHLBranch } from './entities/ghl-branch.entity';

@Module({
  imports: [ClientsModule, TypeOrmModule.forFeature([GHLCalendar, GHLBranch])],
  controllers: [GoHighLevelController],
  providers: [GoHighLevelProxyService],
  exports: [GoHighLevelProxyService],
})
export class GoHighLevelProxyModule {}
