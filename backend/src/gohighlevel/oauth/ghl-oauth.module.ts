import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GHLOAuthService } from './ghl-oauth.service';
import { GHLOAuthController } from './ghl-oauth.controller';
import { GHLOAuthCompany } from './entities/ghl-oauth-company.entity';
import { GHLOAuthLocation } from './entities/ghl-oauth-location.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GHLOAuthCompany, GHLOAuthLocation])],
  controllers: [GHLOAuthController],
  providers: [GHLOAuthService],
  exports: [GHLOAuthService],
})
export class GHLOAuthModule {}
