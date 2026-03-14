import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ghl_oauth_companies')
export class GHLOAuthCompany {
  @PrimaryColumn()
  companyId: string;

  @Column()
  companyName: string;

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
