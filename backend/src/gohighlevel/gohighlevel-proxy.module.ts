import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoHighLevelController } from './gohighlevel.controller';
import { GoHighLevelProxyService } from './gohighlevel-proxy.service';
import { ClientsModule } from '../clients/clients.module';
import { GHLCalendar } from './entities/ghl-calendar.entity';
import { GHLBranch } from './entities/ghl-branch.entity';
import { GHLOAuthModule } from './oauth/ghl-oauth.module';

@Module({
  imports: [ClientsModule, TypeOrmModule.forFeature([GHLCalendar, GHLBranch]), GHLOAuthModule],
  controllers: [GoHighLevelController],
  providers: [GoHighLevelProxyService],
  exports: [GoHighLevelProxyService],
})
export class GoHighLevelProxyModule {}
