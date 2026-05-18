import { IsString } from 'class-validator';

export class GetContactStateDto {
  @IsString()
  contact_id: string;
}
