import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ghl_oauth_locations')
export class GHLOAuthLocation {
  @PrimaryColumn()
  locationId: string;

  @Column()
  locationName: string;

  @Column()
  companyId: string;

  @Column({ type: 'text' })
  accessToken: string;

  @Column({ type: 'text' })
  refreshToken: string;

  @Column()
  tokenExpiry: Date;

  @Column('simple-array')
  scopes: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
