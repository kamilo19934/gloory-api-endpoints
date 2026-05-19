import { IsString } from 'class-validator';

export class GetContactStateDto {
  @IsString()
  user_id: string;
}
